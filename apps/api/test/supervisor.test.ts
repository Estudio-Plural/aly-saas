// Supervisor de conversaciones: selección de inactivas + idempotencia,
// verificación determinista de evidencia, severidad por regla, alertas HIGH
// sin texto de mensajes y endpoint interno protegido por token.
// Sin DB ni OpenRouter: store en memoria, LLM falso y notifier que captura.

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { DEFAULT_CORE_PROMPT, DEFAULT_STORYBOARD } from "../src/config/identity";
import type {
  AlertNotifier,
  FlagRule,
  HighAlert,
  IdleConversation,
  LlmCall,
  SaveAnalysisInput,
  SupervisorMessage,
  SupervisorStore,
  WorkspaceContext,
} from "../src/supervisor/types";

// Ningún test debe tocar Postgres: si algo se escapa al store SQL, explota.
mock.module("../src/db", () => ({
  sql: Object.assign(
    () => {
      throw new Error("DB no disponible en tests");
    },
    { json: (v: unknown) => v },
  ),
}));

const { needsSupervision, runSupervisor } = await import("../src/supervisor/job");
const { verifyAnalysis, fragmentInMessage } = await import("../src/supervisor/verify");
const { formatAlertMessage, telegramNotifier } = await import("../src/supervisor/notify");
const { createApp } = await import("../src/app");

// ── Fixtures ──────────────────────────────────────────────────────────────
const NOW = new Date("2026-09-25T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

const RULES: FlagRule[] = [
  { id: "riesgo", description: "La persona menciona autolesión o riesgo", severity: "high" },
  { id: "humano", description: "Pide hablar con una persona del equipo", severity: "medium" },
  { id: "queja", description: "Quedó disconforme", severity: "low" },
];

const SENSITIVE = "a veces pienso en lastimarme, vivo en la calle Falsa 123";

function ctx(workspaceId: string): WorkspaceContext {
  return {
    workspaceId,
    slug: `slug-${workspaceId}`,
    name: "Apapáchar",
    rules: RULES,
    core: DEFAULT_CORE_PROMPT,
    storyboard: DEFAULT_STORYBOARD,
    model: "fake-model",
  };
}

function msgs(convId: string, lastMinutesAgo: number, texts: string[]): SupervisorMessage[] {
  return texts.map((text, i) => ({
    id: `${convId}-m${i}`,
    role: i % 2 === 0 ? "user" : "assistant",
    text,
    timestamp: minutesAgo(lastMinutesAgo + (texts.length - 1 - i)),
  }));
}

/** Store en memoria: la selección aplica el mismo criterio que el SQL. */
class MemoryStore implements SupervisorStore {
  messages = new Map<string, SupervisorMessage[]>();
  analyzedThrough = new Map<string, Date>();
  saves: SaveAnalysisInput[] = [];
  refuseSaves = false;

  add(workspaceId: string, convId: string, list: SupervisorMessage[], analyzedThrough?: Date) {
    this.messages.set(`${workspaceId}/${convId}`, list);
    if (analyzedThrough) this.analyzedThrough.set(`${workspaceId}/${convId}`, analyzedThrough);
  }

  async listIdleConversations(idleMinutes: number, limit: number) {
    const out: IdleConversation[] = [];
    for (const [key, list] of this.messages) {
      const [workspaceId, conversationId] = key.split("/") as [string, string];
      const conv: IdleConversation = {
        workspaceId,
        conversationId,
        clientNumber: "+0000",
        messagesCount: list.length,
        lastMessageAt: list[list.length - 1]!.timestamp,
        analyzedThrough: this.analyzedThrough.get(key) ?? null,
      };
      if (needsSupervision(conv, NOW, idleMinutes)) out.push(conv);
    }
    return out.slice(0, limit);
  }
  async getMessages(workspaceId: string, conversationId: string) {
    return this.messages.get(`${workspaceId}/${conversationId}`) ?? [];
  }
  async getWorkspaceContext(workspaceId: string) {
    return workspaceId === "ws-borrado" ? null : ctx(workspaceId);
  }
  async saveAnalysis(input: SaveAnalysisInput) {
    if (this.refuseSaves) return false;
    const key = `${input.conversation.workspaceId}/${input.conversation.conversationId}`;
    const prev = this.analyzedThrough.get(key);
    if (prev && prev >= input.analyzedThrough) return false; // mismo guard que el upsert
    this.analyzedThrough.set(key, input.analyzedThrough);
    this.saves.push(input);
    return true;
  }
}

/** LLM falso: responde según el conversation id que aparezca en el transcript. */
let llmCalls: string[] = [];
let llmReplies: Record<string, unknown> = {};
const fakeLlm: LlmCall = async ({ prompt }) => {
  llmCalls.push(prompt);
  for (const [marker, reply] of Object.entries(llmReplies)) {
    if (prompt.includes(marker)) {
      if (reply instanceof Error) throw reply;
      return typeof reply === "string" ? reply : JSON.stringify(reply);
    }
  }
  return JSON.stringify({ summary: "sin novedad", keywords: [], flags: [] });
};

let alerts: HighAlert[] = [];
const captureNotifier: AlertNotifier = {
  notify: async (alert) => {
    alerts.push(alert);
  },
};

const settings = { idleMinutes: 30, batchLimit: 20 };
let store: MemoryStore;
const deps = () => ({ store, llm: fakeLlm, notifier: captureNotifier, isLlmConfigured: () => true });

beforeEach(() => {
  store = new MemoryStore();
  llmCalls = [];
  llmReplies = {};
  alerts = [];
});

// ── Selección + idempotencia ─────────────────────────────────────────────
describe("selección de conversaciones inactivas", () => {
  const base: IdleConversation = {
    workspaceId: "ws",
    conversationId: "c",
    clientNumber: "+0",
    messagesCount: 4,
    lastMessageAt: minutesAgo(45),
    analyzedThrough: null,
  };

  test("criterio: inactiva, ≥2 mensajes y sin análisis al día", () => {
    expect(needsSupervision(base, NOW, 30)).toBe(true);
    expect(needsSupervision({ ...base, lastMessageAt: minutesAgo(10) }, NOW, 30)).toBe(false);
    expect(needsSupervision({ ...base, messagesCount: 1 }, NOW, 30)).toBe(false);
    expect(needsSupervision({ ...base, analyzedThrough: base.lastMessageAt }, NOW, 30)).toBe(false);
    expect(needsSupervision({ ...base, analyzedThrough: minutesAgo(60) }, NOW, 30)).toBe(true);
    expect(needsSupervision({ ...base, lastMessageAt: minutesAgo(10) }, NOW, 5)).toBe(true);
  });

  test("analiza solo las inactivas pendientes y la segunda corrida no hace nada", async () => {
    store.add("ws1", "conv-idle", msgs("conv-idle", 45, ["hola", "hola!", "gracias", "de nada"]));
    store.add("ws1", "conv-activa", msgs("conv-activa", 5, ["hola", "hola!"]));
    store.add("ws1", "conv-corta", msgs("conv-corta", 45, ["hola"]));
    const done = msgs("conv-al-dia", 45, ["hola", "hola!"]);
    store.add("ws1", "conv-al-dia", done, done[1]!.timestamp);
    const updated = msgs("conv-nuevos", 40, ["hola", "hola!", "volví", "¡qué bueno!"]);
    store.add("ws1", "conv-nuevos", updated, updated[1]!.timestamp);

    const first = await runSupervisor(settings, deps());
    expect(first.ran).toBe(true);
    expect(first.selected).toBe(2);
    expect(first.analyzed).toBe(2);
    expect(store.saves.map((s) => s.conversation.conversationId).sort()).toEqual([
      "conv-idle",
      "conv-nuevos",
    ]);
    expect(store.saves.every((s) => s.analyzedThrough.getTime() === s.conversation.lastMessageAt.getTime())).toBe(true);

    const callsAfterFirst = llmCalls.length;
    const second = await runSupervisor(settings, deps());
    expect(second.selected).toBe(0);
    expect(second.analyzed).toBe(0);
    expect(llmCalls.length).toBe(callsAfterFirst);
    expect(store.saves).toHaveLength(2);
  });

  test("si otro análisis más nuevo ya estaba guardado, no pisa ni notifica", async () => {
    store.add("ws1", "conv-x", msgs("conv-x", 45, [SENSITIVE, "te escucho"]));
    llmReplies[SENSITIVE] = {
      summary: "s",
      flags: [{ rule_id: "riesgo", detail: "d", evidencia: [{ mensaje: 0, fragmento: "pienso en lastimarme" }] }],
    };
    store.refuseSaves = true;
    const report = await runSupervisor(settings, deps());
    expect(report.results[0]?.outcome).toBe("stale");
    expect(alerts).toHaveLength(0);
  });

  test("un LLM caído en una conversación no frena las demás; sin LLM no corre", async () => {
    store.add("ws1", "conv-a", msgs("conv-a", 50, ["uno MARCA_FALLA", "dos"]));
    store.add("ws1", "conv-b", msgs("conv-b", 45, ["tres", "cuatro"]));
    llmReplies["MARCA_FALLA"] = new Error("OpenRouter 500");
    const report = await runSupervisor(settings, deps());
    expect(report.failed).toBe(1);
    expect(report.analyzed).toBe(1);
    expect(store.analyzedThrough.has("ws1/conv-a")).toBe(false); // se reintenta la próxima

    const off = await runSupervisor(settings, { ...deps(), isLlmConfigured: () => false });
    expect(off).toMatchObject({ ran: false, reason: "llm_not_configured" });
  });

  test("workspace inexistente → skipped, sin llamar al LLM", async () => {
    store.add("ws-borrado", "conv-z", msgs("conv-z", 45, ["a", "b"]));
    const report = await runSupervisor(settings, deps());
    expect(report.results[0]?.outcome).toBe("skipped");
    expect(llmCalls).toHaveLength(0);
  });
});

// ── Verificación de evidencia ────────────────────────────────────────────
describe("verificación determinista de evidencia", () => {
  const messages = msgs("c", 40, [
    "Hola, quiero hablar con   una PERSONA del equipo",
    "Claro, ya te paso con alguien",
    SENSITIVE,
  ]);

  test("fragmento inexistente en el mensaje citado → flag descartado y contado", () => {
    const analysis = verifyAnalysis(
      JSON.stringify({
        summary: "s",
        flags: [
          { rule_id: "riesgo", detail: "d", evidencia: [{ mensaje: 2, fragmento: "me quiero matar" }] },
          // fragmento real pero citado en el mensaje equivocado
          { rule_id: "humano", detail: "d", evidencia: [{ mensaje: 1, fragmento: "hablar con una persona" }] },
          { rule_id: "queja", detail: "d", evidencia: [] },
          { rule_id: "inventada", detail: "d", evidencia: [{ mensaje: 0, fragmento: "Hola" }] },
          { rule_id: "queja", detail: "d", evidencia: [{ mensaje: 99, fragmento: "Hola" }] },
        ],
      }),
      messages,
      RULES,
      "m",
    )!;
    expect(analysis.flags).toHaveLength(0);
    expect(analysis.discardedFlags).toBe(5);
  });

  test("fragmento textual (tolerando espacios y mayúsculas) → flag verificado con ids", () => {
    const analysis = verifyAnalysis(
      JSON.stringify({
        flags: [
          {
            rule_id: "humano",
            detail: "pide una persona",
            evidencia: [
              { mensaje: 0, fragmento: "hablar con una persona" },
              { mensaje: 0, fragmento: "no está en el mensaje" },
            ],
          },
        ],
      }),
      messages,
      RULES,
      "m",
    )!;
    expect(analysis.discardedFlags).toBe(0);
    expect(analysis.flags).toHaveLength(1);
    expect(analysis.flags[0]!.evidence).toEqual([
      { messageIndex: 0, messageId: "c-m0", fragment: "hablar con una persona" },
    ]);
  });

  test("fragmentos triviales no cuentan como evidencia", () => {
    expect(fragmentInMessage("a", "hola a todos")).toBe(false);
    expect(fragmentInMessage("  ", "hola")).toBe(false);
    expect(fragmentInMessage("HOLA a", "hola a todos")).toBe(true);
  });

  test("criterio de éxito sin mensajes válidos → false; momento fuera del storyboard → null", () => {
    const sinEvidencia = verifyAnalysis(
      JSON.stringify({ cumplio_criterio_exito: { valor: true, evidencia: [42] }, momento_alcanzado: "final" }),
      messages,
      RULES,
      "m",
    )!;
    expect(sinEvidencia.cumplioCriterioExito).toEqual({ value: false, evidence: [] });
    expect(sinEvidencia.momentoAlcanzado).toBeNull();

    const conEvidencia = verifyAnalysis(
      JSON.stringify({ cumplio_criterio_exito: { valor: true, evidencia: [1, "1", 0] }, momento_alcanzado: "next_steps" }),
      messages,
      RULES,
      "m",
    )!;
    expect(conEvidencia.cumplioCriterioExito.value).toBe(true);
    expect(conEvidencia.cumplioCriterioExito.evidence.map((e) => e.messageIndex)).toEqual([0, 1]);
    expect(conEvidencia.momentoAlcanzado).toBe("next_steps");
  });

  test("respuesta no-JSON → null (el job la cuenta como fallida)", () => {
    expect(verifyAnalysis("no sé", messages, RULES, "m")).toBeNull();
  });
});

// ── Severidad por regla ──────────────────────────────────────────────────
describe("severidad determinista", () => {
  test("sale de la regla aunque el LLM diga otra cosa; se ordena y agrega", async () => {
    const list = msgs("conv-sev", 45, ["quiero hablar con alguien del equipo", "ok", SENSITIVE, "te escucho"]);
    store.add("ws1", "conv-sev", list);
    llmReplies["quiero hablar con alguien"] = {
      summary: "s",
      flags: [
        { rule_id: "humano", severity: "HIGH", detail: "pide humano", evidencia: [{ mensaje: 0, fragmento: "hablar con alguien" }] },
        { rule_id: "riesgo", severity: "LOW", detail: "riesgo", evidencia: [{ mensaje: 2, fragmento: "pienso en lastimarme" }] },
      ],
    };
    await runSupervisor(settings, deps());
    const saved = store.saves[0]!;
    expect(saved.analysis.flags.map((f) => [f.ruleId, f.severity])).toEqual([
      ["riesgo", "HIGH"],
      ["humano", "MEDIUM"],
    ]);
    expect(saved.flagSeverity).toBe("HIGH");
    expect(saved.flagsText).toBe("HIGH-riesgo, MEDIUM-pide humano");
    expect(alerts.map((a) => a.ruleId)).toEqual(["riesgo"]); // MEDIUM no notifica
  });
});

// ── Notificación sin texto ───────────────────────────────────────────────
describe("notificación de alertas HIGH", () => {
  test("solo workspace + conversación + regla + severidad; nunca texto del mensaje", async () => {
    const list = msgs("conv-menor", 45, ["hola", "hola, ¿cómo estás?", SENSITIVE, "gracias por contarme"]);
    store.add("ws1", "conv-menor", list);
    llmReplies["calle Falsa"] = {
      summary: "La adolescente de calle Falsa 123 contó que piensa en lastimarse",
      keywords: ["riesgo"],
      flags: [
        {
          rule_id: "riesgo",
          detail: "dice que piensa en lastimarse y vive en calle Falsa 123",
          evidencia: [{ mensaje: 2, fragmento: "pienso en lastimarme, vivo en la calle Falsa 123" }],
        },
      ],
    };

    const sent: string[] = [];
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      sent.push(String(init?.body));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const telegram = telegramNotifier("TOKEN", "CHAT", fakeFetch);
    const both: AlertNotifier = {
      notify: async (a) => {
        alerts.push(a);
        await telegram.notify(a);
      },
    };

    const report = await runSupervisor(settings, { ...deps(), notifier: both });
    expect(report.notified).toBe(1);
    expect(Object.keys(alerts[0]!).sort()).toEqual(
      ["conversationId", "ruleDescription", "ruleId", "severity", "workspaceSlug"].sort(),
    );
    expect(alerts[0]).toMatchObject({ workspaceSlug: "slug-ws1", conversationId: "conv-menor", ruleId: "riesgo", severity: "HIGH" });

    expect(sent).toHaveLength(1);
    const body = JSON.parse(sent[0]!) as { chat_id: string; text: string };
    expect(body.chat_id).toBe("CHAT");
    expect(body.text).toContain("conv-menor");
    expect(body.text).toContain("slug-ws1");
    expect(body.text).toContain(RULES[0]!.description);
    for (const leak of ["lastimarme", "Falsa", "calle", "adolescente", "gracias por contarme"]) {
      expect(sent[0]!).not.toContain(leak);
    }
    // Y el análisis completo (con evidencia) sí queda en la DB para el equipo
    expect(store.saves[0]!.analysis.flags[0]!.evidence[0]!.messageIndex).toBe(2);
    expect(store.saves[0]!.resetReview).toBe(true);
  });

  test("re-análisis por mensajes nuevos: una alerta vieja no se re-notifica ni vuelve a pendiente", async () => {
    const list = msgs("conv-re", 40, [SENSITIVE, "te escucho", "hoy estoy mejor", "¡qué bueno!"]);
    store.add("ws1", "conv-re", list, list[1]!.timestamp); // ya analizada hasta el mensaje 1
    llmReplies["hoy estoy mejor"] = {
      summary: "s",
      flags: [{ rule_id: "riesgo", detail: "d", evidencia: [{ mensaje: 0, fragmento: "pienso en lastimarme" }] }],
    };
    await runSupervisor(settings, deps());
    expect(store.saves).toHaveLength(1);
    expect(store.saves[0]!.resetReview).toBe(false);
    expect(alerts).toHaveLength(0);
  });

  test("el formato no tiene de dónde sacar texto de usuario", () => {
    const text = formatAlertMessage({
      workspaceSlug: "apapachar",
      conversationId: "web-123",
      ruleId: "riesgo",
      ruleDescription: "La persona menciona autolesión o riesgo",
      severity: "HIGH",
    });
    expect(text).toContain("apapachar");
    expect(text).toContain("web-123");
    expect(text).toContain("HIGH");
  });
});

// ── Endpoint interno ─────────────────────────────────────────────────────
describe("POST /internal/supervise", () => {
  const fakeReport = {
    ran: true,
    selected: 0,
    analyzed: 0,
    failed: 0,
    discardedFlags: 0,
    notified: 0,
    results: [],
  };
  let runs = 0;
  const supervise = async () => {
    runs++;
    return fakeReport;
  };
  const call = (app: ReturnType<typeof createApp>, auth?: string) =>
    app.handle(
      new Request("http://localhost/internal/supervise", {
        method: "POST",
        headers: auth ? { authorization: auth } : {},
      }),
    );

  beforeEach(() => {
    runs = 0;
  });

  test("sin SUPERVISOR_TOKEN configurado queda cerrado (503)", async () => {
    const app = createApp({ supervisorToken: "", supervise });
    expect((await call(app, "Bearer algo")).status).toBe(503);
    expect(runs).toBe(0);
  });

  test("sin token o con token incorrecto → 401 y no corre", async () => {
    const app = createApp({ supervisorToken: "s3cret", supervise });
    expect((await call(app)).status).toBe(401);
    expect((await call(app, "Bearer otro")).status).toBe(401);
    expect((await call(app, "s3cret")).status).toBe(401); // sin esquema Bearer
    expect(runs).toBe(0);
  });

  test("con el token correcto corre y devuelve el reporte", async () => {
    const app = createApp({ supervisorToken: "s3cret", supervise });
    const res = await call(app, "Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fakeReport);
    expect(runs).toBe(1);
  });
});
