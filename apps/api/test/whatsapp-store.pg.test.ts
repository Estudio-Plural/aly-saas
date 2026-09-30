// La store de Postgres contra una base REAL (las queries de reserva usan
// ON CONFLICT … WHERE + xmax, que no se pueden probar con dobles).
//
// Se salta si no hay WA_TEST_DATABASE_URL. Nunca apuntarla a la base
// compartida `aly_saas` ni a la VPS: usa una base propia con las migraciones
// (p. ej. ALY_DB_NAME=aly_saas_canal ./scripts/db-setup.sh).
//
//   WA_TEST_DATABASE_URL=postgresql://localhost:5432/aly_saas_canal bun test whatsapp-store

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import postgres from "postgres";
import { crearStorePostgres } from "../src/whatsapp/store";
import { conexion, graphFalso, mensajeTexto, payload, postear, SECRETO } from "./whatsapp-fakes";
import { crearCanal } from "../src/whatsapp/canal";

const URL = process.env.WA_TEST_DATABASE_URL;
const d = URL && !/\/aly_saas$/.test(URL) ? describe : describe.skip;

d("store Postgres (base real de pruebas)", () => {
  const sql = postgres(URL ?? "", { onnotice: () => {}, max: 4 });
  const store = crearStorePostgres(sql as any);
  let ws = "";
  const pnid = `test-${Date.now()}`;

  beforeAll(async () => {
    const [w] = await sql<{ id: string }[]>`
      INSERT INTO workspaces (slug, name, owner_user_id) VALUES (${pnid}, 'Prueba canal', 'test') RETURNING id
    `;
    ws = w!.id;
    await sql`INSERT INTO whatsapp_connections (workspace_id, phone_number_id, token_env) VALUES (${ws}, ${pnid}, 'META_TOKEN_TEST')`;
  });

  afterAll(async () => {
    await sql`DELETE FROM wa_processed_messages WHERE wamid LIKE ${pnid + "%"}`;
    await sql`DELETE FROM workspaces WHERE id = ${ws}`;
    await sql.end();
  });

  test("reservar: nuevo → en_curso → pendiente (reanudar) → hecho (duplicado) → liberar", async () => {
    const w = `${pnid}-1`;
    expect(await store.reservar(w, ws)).toEqual({ tipo: "nuevo" });
    expect(await store.reservar(w, ws)).toEqual({ tipo: "en_curso" });
    await store.guardarPendiente(w, ["a", "b"], 1);
    expect(await store.reservar(w, ws)).toEqual({ tipo: "reanudar", salidas: ["a", "b"], enviadas: 1 });
    await store.marcarHecho(w);
    expect(await store.reservar(w, ws)).toEqual({ tipo: "duplicado" });
    await store.liberar(w);
    expect(await store.reservar(w, ws)).toEqual({ tipo: "nuevo" });
  });

  test("un en_curso abandonado (> 5 min) se retoma", async () => {
    const w = `${pnid}-2`;
    await store.reservar(w, ws);
    await sql`UPDATE wa_processed_messages SET updated_at = NOW() - interval '6 minutes' WHERE wamid = ${w}`;
    expect(await store.reservar(w, ws)).toEqual({ tipo: "nuevo" });
  });

  test("el token_env solo acepta META_TOKEN_*", async () => {
    let error = "";
    try {
      await sql`UPDATE whatsapp_connections SET token_env = 'DATABASE_URL' WHERE workspace_id = ${ws}`;
    } catch (e: any) {
      error = String(e?.message);
    }
    expect(error).toContain("whatsapp_connections_token_env_check");
  });

  test("de punta a punta: gate, rechazo sin rastro, aceptación y turno guardado", async () => {
    const graph = graphFalso();
    const canal = crearCanal({
      store,
      procesar: async (i) => {
        // Lo que hace el pipeline real: guardar el par en users_interactions.
        await sql`INSERT INTO users_interactions (workspace_id, conversation_id, client_number, role, message)
                  VALUES (${i.workspaceId}, ${i.conversationId}, ${i.userNumber}, 'user', ${i.question})`;
        return { answer: "respuesta" };
      },
      enviar: graph.enviar,
      appSecrets: () => [SECRETO],
      verifyToken: () => "v",
      leerEnv: (n) => (n === "META_TOKEN_TEST" ? "tok" : undefined),
    });
    const tel = "573001234567";
    const ids = (m: ReturnType<typeof mensajeTexto>) => ({ ...m, msg: { ...m.msg, id: `${pnid}-${m.msg.id}` } });

    await postear(canal, payload(ids(mensajeTexto("hola", { from: tel, pnid }))));
    await postear(canal, payload(ids(mensajeTexto("no", { from: tel, pnid }))));
    expect(await sql`SELECT 1 FROM wa_sessions WHERE workspace_id = ${ws}`).toHaveLength(0);
    expect(await sql`SELECT 1 FROM users_data WHERE workspace_id = ${ws}`).toHaveLength(0);

    await postear(canal, payload(ids(mensajeTexto("hola", { from: tel, pnid }))));
    await postear(canal, payload(ids(mensajeTexto("acepto", { from: tel, pnid }))));
    const r = await postear(canal, payload(ids(mensajeTexto("¿qué hago?", { from: tel, pnid }))));
    expect(r.status).toBe(200);

    const [s] = await sql<{ consent: string; onboarding_state: string; conversation_id: string }[]>`
      SELECT consent, onboarding_state, conversation_id FROM wa_sessions WHERE workspace_id = ${ws}`;
    expect(s).toMatchObject({ consent: "aceptado", onboarding_state: "listo" });
    const turnos = await sql`SELECT message FROM users_interactions WHERE workspace_id = ${ws} AND conversation_id = ${s!.conversation_id}`;
    expect(turnos.map((t) => t.message)).toEqual(["¿qué hago?"]);
    expect(await sql`SELECT sender_kind FROM users_data WHERE workspace_id = ${ws}`).toEqual([{ sender_kind: "phone" }]);

    const [c] = await sql<{ last_inbound_at: Date | null; last_reply_at: Date | null }[]>`
      SELECT last_inbound_at, last_reply_at FROM whatsapp_connections WHERE workspace_id = ${ws}`;
    expect(c!.last_inbound_at).not.toBeNull();
    expect(c!.last_reply_at).not.toBeNull();
    const [e] = await sql`SELECT last_post_at FROM wa_webhook_state WHERE id = 1`;
    expect(e!.last_post_at).not.toBeNull();
  });
});

// Sin base de pruebas, que quede visible que esto no corrió.
if (!URL) test.skip("store Postgres: definir WA_TEST_DATABASE_URL para correrlo", () => {});
