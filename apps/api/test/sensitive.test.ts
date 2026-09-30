// El turno sensible es el más delicado del bot: tiene que responder con la
// identidad del asistente, la historia de la conversación y el protocolo del
// workspace — nunca con un prompt genérico. Sin DB ni OpenRouter: se mockean
// config, historia, retrieval y el cliente LLM.

import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { BotConfig } from "../src/config";

const IDENTITY = "Sos Aly, la asistente del programa Apapáchar.";
const HISTORY = "Usuario: hola\nAly: hola, ¿cómo estás?";
const ROUTES = "Rutas de ayuda del programa: *Línea 141* — 141";
const ROUTES_MSG = "*Líneas de ayuda:*\n-> *Línea 141* — 141";
const PROTOCOL = "Protocolo: derivar a la línea 106 y avisar a una persona del equipo.";

const config = {
  prompts: {
    normalizeQuestion: "NORMALIZE {history} {class_context} {user_input}",
    triage: "TRIAGE {user_input}",
    intent: "INTENT {user_input}",
    sensitive: "SENSITIVE_PROMPT\nContexto:\n{context}\n\nMensaje: {user_input}",
    sensitiveFallback: "FALLBACK",
    factualNoContextFallback: "NO_CONTEXT",
  },
  models: { normalize: "normalize", triage: "triage", intent: "intent", sensitive: "sensitive" },
  programs: [],
  capabilities: { sensitive_safety: true, context_gathering: { on: false, slots: [] }, org_identity: false },
  themeCategories: [],
  identity: IDENTITY,
  helpRoutes: ROUTES,
  helpRoutesMessage: ROUTES_MSG,
} as unknown as BotConfig;

// Respuestas del LLM falso por modelo; el agente sensible devuelve su prompt
// para poder inspeccionar qué recibió.
let triageAnswer = "SENSITIVE";
let intentAnswer = '{"intent":"FACTUAL","confidence":0.9}';
let retrievalFails = false;
// null = el agente sensible devuelve su prompt; string = respuesta simulada; Error = falla.
let sensitiveAnswer: string | Error | null = null;
const retrieveCalls: unknown[][] = [];

mock.module("../src/engine/openrouter", () => ({
  isLlmConfigured: () => true,
  callAgent: async ({ model, prompt }: { model: string; prompt: string }) => {
    if (model === "normalize") return "me quiero morir";
    if (model === "triage") return triageAnswer;
    if (model === "intent") return intentAnswer;
    if (model === "sensitive") {
      if (sensitiveAnswer instanceof Error) throw sensitiveAnswer;
      return sensitiveAnswer ?? prompt;
    }
    return "";
  },
}));

mock.module("../src/config", () => ({ resolveBotConfig: async () => config }));

mock.module("../src/engine/history", () => ({
  getHistory: async () => [],
  formatHistory: () => HISTORY,
  saveHistory: async () => {},
}));

mock.module("../src/engine/retrieval", () => ({
  listDocCatalog: async () => [],
  retrieveContext: async (...args: unknown[]) => {
    retrieveCalls.push(args);
    if (retrievalFails) throw new Error("db caída");
    return {
      context: PROTOCOL,
      chunks: [{ documentName: "protocolo.txt", text: PROTOCOL }],
    };
  },
}));

const { processQuestion } = await import("../src/engine/pipeline");

const input = {
  question: "me quiero morir",
  userNumber: "test",
  language: "es",
  conversationId: "smoke-sensitive",
  workspaceId: "ws-test",
};

beforeEach(() => {
  triageAnswer = "SENSITIVE";
  intentAnswer = '{"intent":"FACTUAL","confidence":0.9}';
  retrievalFails = false;
  sensitiveAnswer = null;
  retrieveCalls.length = 0;
  (config as { helpRoutesMessage: string }).helpRoutesMessage = ROUTES_MSG;
});

describe("turno sensible", () => {
  test("triage positivo: responde con identidad, historia y protocolo", async () => {
    const res = await processQuestion(input);
    expect(res.intent).toBe("SENSITIVE");
    expect(res.answer).toContain(IDENTITY);
    expect(res.answer).toContain(HISTORY);
    expect(res.answer).toContain(PROTOCOL);
    expect(res.chunks).toHaveLength(1);
  });

  test("el prompt sensible lleva las rutas de ayuda del programa", async () => {
    const res = await processQuestion(input);
    expect(res.answer).toContain(ROUTES);
  });

  test("sin rutas compiladas: instrucción de no inventar números", async () => {
    const original = config.helpRoutes;
    (config as { helpRoutes: string }).helpRoutes = "";
    try {
      const res = await processQuestion(input);
      expect(res.answer).toContain("sin inventar números");
    } finally {
      (config as { helpRoutes: string }).helpRoutes = original;
    }
  });

  test("busca el protocolo en todos los documentos, no solo en los ruteados", async () => {
    await processQuestion(input);
    expect(retrieveCalls).toHaveLength(1);
    expect(retrieveCalls[0]?.[0]).toBe("ws-test");
    expect(retrieveCalls[0]?.[1]).toEqual([]);
  });

  test("safety-net por intent: mismo tratamiento que el triage", async () => {
    triageAnswer = "NOT_SENSITIVE";
    intentAnswer = '{"intent":"SENSITIVE","confidence":0.8}';
    const res = await processQuestion(input);
    expect(res.intent).toBe("SENSITIVE");
    expect(res.confidence).toBe(0.8);
    expect(res.answer).toContain(IDENTITY);
    expect(res.answer).toContain(PROTOCOL);
  });

  test("si el retrieval falla, igual responde (sin contexto) en vez de caerse", async () => {
    retrievalFails = true;
    const res = await processQuestion(input);
    expect(res.intent).toBe("SENSITIVE");
    expect(res.answer).toContain(IDENTITY);
    expect(res.answer).not.toContain(PROTOCOL);
    expect(res.chunks).toEqual([]);
  });
});

describe("rutas de ayuda deterministas (como Aly)", () => {
  test("ALTA SEVERIDAD: quita la etiqueta y anexa las rutas del programa en código", async () => {
    sensitiveAnswer = "ALTA SEVERIDAD\nLo que cuentas es muy serio y no estás sola.";
    const res = await processQuestion(input);
    expect(res.answer).toBe("Lo que cuentas es muy serio y no estás sola.\n\n" + ROUTES_MSG);
  });

  test("CONTENCIÓN: sin bloque de rutas", async () => {
    sensitiveAnswer = "🟡 CONTENCIÓN\nSuena a una semana agotadora.";
    const res = await processQuestion(input);
    expect(res.answer).toBe("Suena a una semana agotadora.");
  });

  test("sin etiqueta (deriva del modelo): fail-safe, anexa las rutas", async () => {
    sensitiveAnswer = "Te escucho. ¿Estás en un lugar seguro?";
    const res = await processQuestion(input);
    expect(res.answer).toEndWith(ROUTES_MSG);
  });

  test("si el modelo escribió un número igual, el bloque completo se anexa", async () => {
    sensitiveAnswer = "ALTO\nLlama a la 141 ya.";
    const res = await processQuestion(input);
    expect(res.answer).toBe("Llama a la 141 ya.\n\n" + ROUTES_MSG);
  });

  test("solo la etiqueta, sin cuerpo: fallback completo con rutas", async () => {
    sensitiveAnswer = "ALTA SEVERIDAD\n";
    const res = await processQuestion(input);
    expect(res.answer).toBe("FALLBACK\n\n" + ROUTES_MSG);
  });

  test("si el LLM falla: fallback con rutas", async () => {
    sensitiveAnswer = new Error("OpenRouter 500");
    const res = await processQuestion(input);
    expect(res.answer).toBe("FALLBACK\n\n" + ROUTES_MSG);
  });

  test("programa sin rutas: no se anexa nada (y el prompt prohíbe inventar)", async () => {
    (config as { helpRoutesMessage: string }).helpRoutesMessage = "";
    sensitiveAnswer = "ALTA SEVERIDAD\nBusca ayuda en tu territorio.";
    const res = await processQuestion(input);
    expect(res.answer).toBe("Busca ayuda en tu territorio.");
  });

  test("el prompt pide la etiqueta de severidad", async () => {
    const res = await processQuestion(input);
    expect(res.answer).toContain("ALTA SEVERIDAD o CONTENCIÓN");
  });
});
