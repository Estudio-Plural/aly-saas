/// <reference types="bun-types" />
// Corrida del banco de casos difíciles contra una base de prueba, con el engine
// MOCKEADO (sin LLM): cada caso va efímero, no se guarda como conversación, la
// corrida se guarda y decide el «hecho» de Probar.
//   cd apps/web && TEST_DATABASE_URL=postgresql://localhost:5432/aly_saas_v2 bun test tests/casos-corrida
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";

const DB = process.env.TEST_DATABASE_URL ?? "postgresql://localhost:5432/aly_saas_acceso";
if (/\/aly_saas$/.test(DB)) throw new Error("No corras los tests contra la base compartida aly_saas");
process.env.DATABASE_URL = DB;
delete process.env.CASOS_RESPUESTAS_SIMULADAS;

const llamadas: { question: string; ephemeral?: boolean }[] = [];
let respuestas: (q: string) => string | null = () => "Hola.";
mock.module("@/lib/engine", () => ({
  askEngine: async (p: { question: string; ephemeral?: boolean }) => {
    llamadas.push(p);
    const answer = respuestas(p.question);
    return answer === null ? null : { answer, intent: "FACTUAL", confidence: 1, chunks: [] };
  },
  getEngineWhatsappEstado: async () => null,
}));

const { sql } = await import("@/lib/db");
const { correrCasos, getUltimaCorrida, addCasoPropio } = await import("@/lib/data/casos");
const { getProgramProgress } = await import("@/lib/data/design");

const R = randomUUID().slice(0, 8);
const ORG = `t-casos-${R}`;
let WS = "";

beforeAll(async () => {
  await sql`INSERT INTO orgs (id, nombre) VALUES (${ORG}, 'Org casos')`;
  const [w] = await sql`INSERT INTO workspaces (slug, name, assistant_name, owner_user_id, org_id) VALUES (${ORG}, 'Casos', 'Aly', 'test', ${ORG}) RETURNING id`;
  WS = w.id;
  await sql`INSERT INTO workspace_configs (workspace_id, help_routes) VALUES (${WS}, ${sql.json([{ id: "1", name: "Línea 106", contact: "106", hours: "", when: "", territory: "" }])})`;
});

afterAll(async () => {
  await sql`DELETE FROM workspaces WHERE org_id = ${ORG}`;
  await sql`DELETE FROM orgs WHERE id = ${ORG}`;
  // Sin sql.end(): la conexión es global (lib/db) y la comparten los demás archivos de test.
});

const ws = () => ({ id: WS, assistant_name: "Aly", stats: { documents: 0 } });

describe("correr los casos", () => {
  test("una corrida sana: efímera, guardada y marca Probar como hecho", async () => {
    await addCasoPropio(WS, "Mi hijo no quiere ir al colegio", "ana@org.test");
    respuestas = (q) =>
      q.startsWith("Ya no puedo")
        ? "Lo que cuentas es serio. ¿Estás en un lugar seguro?\n\n*Líneas de ayuda:*\n-> *Línea 106* — 106"
        : "Te entiendo. ¿Qué parte te preocupa más?";
    const corrida = await correrCasos(ws(), "ana@org.test");

    expect(corrida.casos).toBe(9);
    expect(llamadas).toHaveLength(9);
    expect(llamadas.every((l) => l.ephemeral === true)).toBe(true);
    expect(corrida.seguridadOk).toBe(true);
    expect(corrida.resultados.find((r) => r.caso.tipo === "crisis")?.chequeos.find((c) => c.id === "rutas_en_crisis")?.ok).toBe(true);

    // No se guardó como conversación real.
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM users_interactions WHERE workspace_id = ${WS}`;
    expect(n).toBe(0);

    const guardada = await getUltimaCorrida(WS);
    expect(guardada?.corridaPor).toBe("ana@org.test");
    expect(guardada?.resultados).toHaveLength(9);
    expect((await getProgramProgress(ws())).test).toBe(true);
  });

  test("una respuesta que inventa un teléfono deja Probar pendiente; la corrida se pisa", async () => {
    llamadas.length = 0;
    respuestas = (q) => (q.includes("teléfono") ? "Llama a la línea 155." : "Hola, ¿en qué te ayudo?");
    const corrida = await correrCasos(ws(), "ana@org.test");
    expect(corrida.seguridadOk).toBe(false);
    const tel = corrida.resultados.find((r) => r.caso.tipo === "telefono")!;
    expect(tel.chequeos.find((c) => c.id === "telefono_inventado")?.ok).toBe(false);
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM casos_corridas WHERE workspace_id = ${WS}`;
    expect(n).toBe(1);
    expect((await getProgramProgress(ws())).test).toBe(false);
  });

  test("si el engine no responde, el caso queda con error y no cuenta como seguro", async () => {
    respuestas = () => null;
    const corrida = await correrCasos(ws(), "ana@org.test");
    expect(corrida.resultados.every((r) => r.error)).toBe(true);
    expect(corrida.seguridadOk).toBe(false);
  });
});
