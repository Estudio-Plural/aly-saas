/// <reference types="bun-types" />
// Aislamiento entre organizaciones (Fase 0). Corre contra una base Postgres de prueba:
//   cd apps/web && TEST_DATABASE_URL=postgresql://localhost:5432/aly_saas_acceso bun test
// Crea sus propias orgs/programas (prefijo `t-acceso-`) y los borra al final.
//
// Qué prueba:
//  · la firma de la puerta (válida, adulterada, vencida, producción sin secreto);
//  · que un cliente de la org A no lee ni escribe NADA de la org B por NINGUNA ruta de
//    app/api/** (descubre las rutas solas: una ruta nueva entra en el barrido sin tocar esto);
//  · que sin identidad todo da 401;
//  · que un cliente no ve transcripciones y el equipo Plural sí.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import path from "node:path";

const DB = process.env.TEST_DATABASE_URL ?? "postgresql://localhost:5432/aly_saas_acceso";
if (/\/aly_saas$/.test(DB)) throw new Error("No corras los tests contra la base compartida aly_saas");
process.env.DATABASE_URL = DB;
process.env.GATE_SECRET = "secreto-de-prueba";
process.env.PLURAL_DOMAINS = "estudio-plural.co";
delete process.env.DEV_USER_EMAIL;

const { sql } = await import("@/lib/db");
const auth = await import("@/lib/auth");
const { listConversations } = await import("@/lib/data/conversations");

const R = randomUUID().slice(0, 8);
const ORG_A = `t-acceso-a-${R}`;
const ORG_B = `t-acceso-b-${R}`;
const SLUG_A = `t-acceso-a-${R}`;
const SLUG_B = `t-acceso-b-${R}`;
const CLIENTE_A = `ana-${R}@org-a.test`;
const CLIENTE_B = `beto-${R}@org-b.test`;
const PLURAL = `equipo-${R}@estudio-plural.co`;
const CONV_B = `conv-b-${R}`;
let WS_A = "";
let WS_B = "";
let DOC_B = "";

function headersDe(email: string, opts: { ts?: number; sig?: string } = {}): Headers {
  const ts = String(opts.ts ?? Date.now());
  const rol = email.endsWith("@estudio-plural.co") ? "plural" : "cliente";
  const sig = opts.sig ?? auth.firmarIdentidad("secreto-de-prueba", email, "uid", rol, ts);
  return new Headers({
    "x-plural-user-email": email,
    "x-plural-user-id": "uid",
    "x-plural-user-role": rol,
    "x-plural-user-ts": ts,
    "x-plural-user-sig": sig,
  });
}

async function snapshotB() {
  const [ws] = await sql`SELECT slug, name, assistant_name, org_id, whatsapp_phone_number, kapso_connection_status FROM workspaces WHERE id = ${WS_B}`;
  const docs = await sql`SELECT id, name, routing_hint FROM documents WHERE workspace_id = ${WS_B} ORDER BY id`;
  const msgs = await sql`SELECT id, message, status FROM users_interactions WHERE workspace_id = ${WS_B} ORDER BY id`;
  const cfg = await sql`SELECT flag_rules, core_prompt, storyboard, boundaries, help_routes, welcome FROM workspace_configs WHERE workspace_id = ${WS_B}`;
  const flows = await sql`SELECT definition FROM onboarding_flows WHERE workspace_id = ${WS_B}`;
  const miembros = await sql`SELECT email, rol FROM org_members WHERE org_id = ${ORG_B} ORDER BY email`;
  const cd = await sql`SELECT conversation_id, summary, reviewed_at, reviewed_by FROM conversations_data WHERE workspace_id = ${WS_B}`;
  const protocolo = await sql`SELECT * FROM alert_protocols WHERE workspace_id = ${WS_B}`;
  const wa = await sql`SELECT phone_number_id, token_env, checklist FROM whatsapp_connections WHERE workspace_id = ${WS_B}`;
  return JSON.stringify({ ws, docs, msgs, cfg, flows, miembros, cd, protocolo, wa });
}

beforeAll(async () => {
  await sql`INSERT INTO orgs (id, nombre) VALUES (${ORG_A}, 'Org A de prueba'), (${ORG_B}, 'Org B de prueba')`;
  await sql`INSERT INTO org_members (org_id, email, rol) VALUES (${ORG_A}, ${CLIENTE_A}, 'admin'), (${ORG_B}, ${CLIENTE_B}, 'miembro')`;
  const [a] = await sql`INSERT INTO workspaces (slug, name, assistant_name, owner_user_id, org_id) VALUES (${SLUG_A}, 'Programa A', 'Aly', 'test', ${ORG_A}) RETURNING id`;
  const [b] = await sql`INSERT INTO workspaces (slug, name, assistant_name, owner_user_id, org_id) VALUES (${SLUG_B}, 'Programa B', 'Aly', 'test', ${ORG_B}) RETURNING id`;
  WS_A = a.id;
  WS_B = b.id;
  for (const id of [WS_A, WS_B]) {
    await sql`INSERT INTO workspace_configs (workspace_id, flag_rules) VALUES (${id}, ${sql.json([{ id: "1", description: "Regla original", severity: "high" }])})`;
    await sql`INSERT INTO onboarding_flows (workspace_id, name, definition, is_active) VALUES (${id}, 'x', ${sql.json({ steps: [] })}, true)`;
  }
  const [d] = await sql`INSERT INTO documents (workspace_id, name, storage_path, text_content, routing_hint) VALUES (${WS_B}, 'secreto-b.txt', '/nonexistent', 'texto secreto de B', 'original') RETURNING id`;
  DOC_B = d.id;
  await sql`INSERT INTO users_interactions (workspace_id, conversation_id, client_number, role, message) VALUES
    (${WS_B}, ${CONV_B}, '+573001112233', 'user', 'MENSAJE PRIVADO DE UNA PERSONA'),
    (${WS_B}, ${CONV_B}, '+573001112233', 'assistant', 'respuesta del asistente')`;
  const analisis = {
    version: 1, summary: "Resumen del supervisor", keywords: [], momentoAlcanzado: null,
    cumplioCriterioExito: { value: true, evidence: [{ messageIndex: 0, messageId: "m1" }] },
    flags: [{
      ruleId: "1", ruleDescription: "Riesgo", severity: "HIGH",
      detail: "La persona dijo MENSAJE PRIVADO", evidence: [{ messageIndex: 0, messageId: "m1", fragment: "MENSAJE PRIVADO" }],
    }],
    discardedFlags: 0, model: "x",
  };
  await sql`INSERT INTO conversations_data (workspace_id, conversation_id, user_number, summary, flags, flag_severity, analysis)
    VALUES (${WS_B}, ${CONV_B}, '+573001112233', 'Resumen de la conversación', 'Alerta', 'high', ${sql.json(analisis)})`;
});

afterAll(async () => {
  await sql`DELETE FROM workspaces WHERE org_id IN (${ORG_A}, ${ORG_B})`;
  await sql`DELETE FROM orgs WHERE id IN (${ORG_A}, ${ORG_B})`;
  await sql.end();
});

// ---------------------------------------------------------------- firma de la puerta
describe("identidad firmada por la puerta", () => {
  test("firma válida → correo", () => {
    expect(auth.correoDe(headersDe(CLIENTE_A))).toBe(CLIENTE_A);
  });
  test("firma adulterada → nadie", () => {
    expect(auth.correoDe(headersDe(CLIENTE_A, { sig: "x".repeat(43) }))).toBeNull();
  });
  test("correo cambiado con la firma de otro → nadie", () => {
    const h = headersDe(CLIENTE_A);
    h.set("x-plural-user-email", PLURAL);
    expect(auth.correoDe(h)).toBeNull();
  });
  test("firma de hace más de 5 minutos → nadie", () => {
    expect(auth.correoDe(headersDe(CLIENTE_A, { ts: Date.now() - 6 * 60e3 }))).toBeNull();
  });
  test("sin GATE_SECRET y con PLURAL_REQUIRE_GATE=1 → nadie, ni DEV_USER_EMAIL", () => {
    const antes = process.env.GATE_SECRET;
    delete process.env.GATE_SECRET;
    process.env.PLURAL_REQUIRE_GATE = "1";
    process.env.DEV_USER_EMAIL = PLURAL;
    try {
      expect(auth.correoDe(new Headers({ "x-plural-user-email": PLURAL }))).toBeNull();
      expect(auth.correoDe(new Headers())).toBeNull();
    } finally {
      process.env.GATE_SECRET = antes;
      delete process.env.PLURAL_REQUIRE_GATE;
      delete process.env.DEV_USER_EMAIL;
    }
  });
  test("rol plural por dominio; cliente por membresía", async () => {
    const p = await auth.accesoPorCorreo(PLURAL);
    expect(p.esPlural).toBe(true);
    const a = await auth.accesoPorCorreo(CLIENTE_A);
    expect(a.esPlural).toBe(false);
    expect(a.orgs.map((o) => o.id)).toEqual([ORG_A]);
  });
});

// ---------------------------------------------------------------- barrido de rutas
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const API = path.join(import.meta.dir, "..", "app", "api");

// Cuerpos válidos: si la ruta no filtrara, la escritura se haría de verdad.
const CUERPOS: Record<string, unknown> = {
  "workspaces/[slug]": { name: "HACKEADO", slug: "hackeado-" + R, assistant_name: "X" },
  "workspaces/[slug]/flags": { rules: [{ id: "9", description: "Regla inyectada", severity: "low" }] },
  "workspaces/[slug]/onboarding": { steps: [{ id: "1", type: "message", content: "inyectado" }] },
  "workspaces/[slug]/whatsapp": { phoneNumberId: "1234567890", displayNumber: "+57 300", tokenEnv: "META_TOKEN_INYECTADO" },
  "workspaces/[slug]/design": { help_routes: [{ id: "1", name: "Ruta inyectada", contact: "123" }] },
  "workspaces/[slug]/operar/protocolo": {
    responsibleName: "Intruso", channel: "email", channelTarget: "intruso@x.test", responseTimeHours: 1, active: true,
  },
  "workspaces/[slug]/documents/[id]": { routing_hint: "inyectado" },
  "workspaces/[slug]/program": {
    core_prompt: { mission: "inyectado", scope: "inyectado", success_criteria: "inyectado", key_actions: "inyectado" },
  },
  "workspaces/[slug]/chat": { type: "append", messages: [{ role: "user", text: "inyectado" }] },
  "workspaces/[slug]/extract": { question: "q", variable: "v", answer: "a" },
  "admin/orgs": { nombre: "Org inyectada " + R },
  "admin/orgs/[id]/members": { email: `intruso-${R}@x.test`, rol: "admin" },
  "admin/workspaces/[id]": { org_id: "t-no-existe" },
};

async function rutas() {
  const out: { ruta: string; mod: Record<string, Handler> }[] = [];
  for await (const f of new Bun.Glob("**/route.ts").scan(API)) {
    const ruta = path.dirname(f).split(path.sep).join("/");
    out.push({ ruta, mod: await import(path.join(API, f)) });
  }
  return out;
}

// Parámetros que apuntan a recursos de la org B.
function paramsB(ruta: string): Record<string, string> {
  const p: Record<string, string> = {};
  if (ruta.includes("[slug]")) p.slug = SLUG_B;
  if (ruta.includes("[id]")) {
    if (ruta.includes("documents")) p.id = DOC_B;
    else if (ruta.includes("conversations")) p.id = CONV_B;
    else if (ruta.startsWith("admin/orgs")) p.id = ORG_B;
    else if (ruta.startsWith("admin/workspaces")) p.id = WS_B;
    else p.id = "cualquiera";
  }
  return p;
}

function llamar(h: Handler, metodo: string, ruta: string, headers: Headers, params: Record<string, string>) {
  const url = new URL(`http://localhost/api/${ruta}`);
  if (ruta.endsWith("members") && metodo === "DELETE") url.searchParams.set("email", CLIENTE_B);
  const body = metodo === "GET" || metodo === "DELETE" ? undefined : JSON.stringify(CUERPOS[ruta] ?? {});
  if (body) headers.set("content-type", "application/json");
  return h(new Request(url, { method: metodo, headers, body }), { params: Promise.resolve(params) });
}

describe("un cliente de la org A no toca nada de la org B", () => {
  test("hay rutas para barrer", async () => {
    expect((await rutas()).length).toBeGreaterThanOrEqual(15);
  });

  test("toda ruta con recursos de B responde 404 y B queda igual", async () => {
    const antes = await snapshotB();
    const fallas: string[] = [];
    for (const { ruta, mod } of await rutas()) {
      if (ruta === "workspaces") continue; // lista y creación: se prueban aparte
      for (const m of METODOS) {
        if (!mod[m]) continue;
        const res = await llamar(mod[m], m, ruta, headersDe(CLIENTE_A), paramsB(ruta));
        if (res.status !== 404) fallas.push(`${m} /api/${ruta} → ${res.status}`);
        const texto = await res.text();
        if (texto.includes("MENSAJE PRIVADO") || texto.includes("texto secreto de B") || texto.includes("Programa B")) {
          fallas.push(`${m} /api/${ruta} filtró datos de B`);
        }
      }
    }
    expect(fallas).toEqual([]);
    expect(await snapshotB()).toBe(antes);
  });

  test("control: un miembro de B sí lee su programa (el 404 de arriba no es por otra cosa)", async () => {
    const { GET } = await import("@/app/api/workspaces/[slug]/route");
    const ok = await GET(new Request("http://localhost", { headers: headersDe(CLIENTE_B) }), {
      params: Promise.resolve({ slug: SLUG_B }),
    });
    expect(ok.status).toBe(200);
    const docs = await import("@/app/api/workspaces/[slug]/documents/route");
    const d = await docs.GET(new Request("http://localhost", { headers: headersDe(CLIENTE_B) }), {
      params: Promise.resolve({ slug: SLUG_B }),
    });
    expect(await d.text()).toContain("secreto-b.txt");
  });

  test("GET /api/workspaces no lista programas de B", async () => {
    const { GET } = await import("@/app/api/workspaces/route");
    const res = await GET(new Request("http://localhost/api/workspaces", { headers: headersDe(CLIENTE_A) }));
    const { workspaces } = (await res.json()) as { workspaces: { slug: string; org_id: string }[] };
    expect(workspaces.map((w) => w.slug)).toContain(SLUG_A);
    expect(workspaces.every((w) => w.org_id === ORG_A)).toBe(true);
    const filtrado = await GET(
      new Request(`http://localhost/api/workspaces?org=${ORG_B}`, { headers: headersDe(CLIENTE_A) })
    );
    expect(((await filtrado.json()) as { workspaces: unknown[] }).workspaces).toEqual([]);
  });

  test("POST /api/workspaces en la org B → 403 y no crea nada", async () => {
    const { POST } = await import("@/app/api/workspaces/route");
    const res = await POST(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { ...Object.fromEntries(headersDe(CLIENTE_A)), "content-type": "application/json" },
        body: JSON.stringify({ name: "Intruso", org_id: ORG_B }),
      })
    );
    expect(res.status).toBe(403);
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM workspaces WHERE org_id = ${ORG_B}`;
    expect(n).toBe(1);
  });

  test("un cliente no administra organizaciones (404)", async () => {
    const { GET, POST } = await import("@/app/api/admin/orgs/route");
    expect((await GET(new Request("http://localhost", { headers: headersDe(CLIENTE_A) }))).status).toBe(404);
    const h = headersDe(CLIENTE_A);
    h.set("content-type", "application/json");
    const res = await POST(new Request("http://localhost", { method: "POST", headers: h, body: JSON.stringify({ nombre: "Nueva" }) }));
    expect(res.status).toBe(404);
  });

  test("slug inexistente y slug ajeno responden igual (no revela que existe)", async () => {
    const { GET } = await import("@/app/api/workspaces/[slug]/route");
    const ajeno = await GET(new Request("http://localhost", { headers: headersDe(CLIENTE_A) }), { params: Promise.resolve({ slug: SLUG_B }) });
    const inexistente = await GET(new Request("http://localhost", { headers: headersDe(CLIENTE_A) }), { params: Promise.resolve({ slug: "no-existe-" + R }) });
    expect(ajeno.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(await ajeno.text()).toBe(await inexistente.text());
  });
});

describe("sin identidad no entra nadie", () => {
  test("toda ruta responde 401", async () => {
    const fallas: string[] = [];
    for (const { ruta, mod } of await rutas()) {
      for (const m of METODOS) {
        if (!mod[m]) continue;
        const res = await llamar(mod[m], m, ruta, new Headers(), paramsB(ruta));
        if (res.status !== 401) fallas.push(`${m} /api/${ruta} → ${res.status}`);
      }
    }
    expect(fallas).toEqual([]);
  });
});

describe("transcripciones: solo el equipo Plural", () => {
  test("un cliente de B no ve el texto por la API", async () => {
    const { GET } = await import("@/app/api/workspaces/[slug]/conversations/[id]/route");
    const res = await GET(new Request("http://localhost", { headers: headersDe(CLIENTE_B) }), {
      params: Promise.resolve({ slug: SLUG_B, id: CONV_B }),
    });
    expect(res.status).toBe(403);
    const texto = await res.text();
    expect(texto).not.toContain("MENSAJE PRIVADO");
    expect(texto).toContain("solo las ve el equipo de Plural");
  });

  test("la bandeja del cliente trae resumen y alertas, sin texto ni teléfono", async () => {
    const lista = await listConversations(WS_B, { verTranscripciones: false });
    expect(lista).toHaveLength(1);
    expect(lista[0].lastMessage).toBeNull();
    expect(lista[0].summary).toBe("Resumen de la conversación");
    expect(lista[0].flagSeverity).toBe("high");
    expect(JSON.stringify(lista)).not.toContain("MENSAJE PRIVADO");
    expect(JSON.stringify(lista)).not.toContain("3001112233");
  });

  test("la evidencia textual del supervisor no le llega al cliente: solo regla y severidad", async () => {
    const [cliente] = await listConversations(WS_B, { verTranscripciones: false });
    expect(cliente.supervision?.flags[0].severity).toBe("HIGH");
    expect(cliente.supervision?.flags[0].ruleDescription).toBe("Riesgo");
    expect(cliente.supervision?.flags[0].evidence).toEqual([]);
    expect(cliente.supervision?.flags[0].detail).toBe("");
    expect(JSON.stringify(cliente)).not.toContain("MENSAJE PRIVADO");
    const [plural] = await listConversations(WS_B, { verTranscripciones: true });
    expect(plural.supervision?.flags[0].evidence[0].fragment).toBe("MENSAJE PRIVADO");
  });

  test("el equipo Plural sí ve la conversación", async () => {
    const { GET } = await import("@/app/api/workspaces/[slug]/conversations/[id]/route");
    const res = await GET(new Request("http://localhost", { headers: headersDe(PLURAL) }), {
      params: Promise.resolve({ slug: SLUG_B, id: CONV_B }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("MENSAJE PRIVADO");
  });
});

describe("permisos dentro de la org", () => {
  test("un cliente no conecta números de WhatsApp (403); Plural sí puede", async () => {
    const { PUT } = await import("@/app/api/workspaces/[slug]/whatsapp/route");
    const cuerpo = JSON.stringify({ phoneNumberId: null, displayNumber: "+57 300 000", wabaId: null, tokenEnv: null });
    const h = headersDe(CLIENTE_B);
    h.set("content-type", "application/json");
    const res = await PUT(new Request("http://localhost", { method: "PUT", headers: h, body: cuerpo }), {
      params: Promise.resolve({ slug: SLUG_B }),
    });
    expect(res.status).toBe(403);
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM whatsapp_connections WHERE workspace_id = ${WS_B}`;
    expect(n).toBe(0);
  });

  test("revisar una alerta registra el correo real de quien revisa", async () => {
    const { POST, DELETE } = await import("@/app/api/workspaces/[slug]/conversations/[id]/review/route");
    const ctx = { params: Promise.resolve({ slug: SLUG_B, id: CONV_B }) };
    const res = await POST(new Request("http://localhost", { method: "POST", headers: headersDe(CLIENTE_B) }), ctx);
    expect(res.status).toBe(200);
    const [row] = await sql`SELECT reviewed_by FROM conversations_data WHERE workspace_id = ${WS_B} AND conversation_id = ${CONV_B}`;
    expect(row.reviewed_by).toBe(CLIENTE_B);
    await DELETE(new Request("http://localhost", { method: "DELETE", headers: headersDe(CLIENTE_B) }), {
      params: Promise.resolve({ slug: SLUG_B, id: CONV_B }),
    });
  });

  test("un miembro (no admin) no borra el programa", async () => {
    const { DELETE } = await import("@/app/api/workspaces/[slug]/route");
    const res = await DELETE(new Request("http://localhost", { method: "DELETE", headers: headersDe(CLIENTE_B) }), {
      params: Promise.resolve({ slug: SLUG_B }),
    });
    expect(res.status).toBe(403);
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM workspaces WHERE id = ${WS_B}`;
    expect(n).toBe(1);
  });
});
