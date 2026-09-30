// El engine no se abre sin ENGINE_TOKEN: el panel (apps/web/lib/engine.ts) lo manda en
// `X-Engine-Token`. Excepciones con autenticación propia: webhook de Meta (firma),
// /internal/* (SUPERVISOR_TOKEN) y /health. Sin DB ni LLM: el pipeline se inyecta.

import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";

const cuerpo = {
  userQuestion: "hola",
  userNumber: "web",
  conversationId: "c1",
  workspaceId: "ws1",
};

function armar(engineToken: string | undefined) {
  const llamadas: unknown[] = [];
  const app = createApp({
    engineToken,
    supervisorToken: "super",
    supervise: async () => ({ ok: true }) as never,
    ask: (async (input: unknown) => {
      llamadas.push(input);
      return { answer: "ok", intent: "FACTUAL", confidence: 1, chunks: [] };
    }) as never,
    whatsappEstado: () => ({ tokenCargado: true }),
  });
  return { app, llamadas };
}

const post = (headers: Record<string, string> = {}, body: unknown = cuerpo) =>
  new Request("http://engine/api/rag/doQuestion", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("ENGINE_TOKEN", () => {
  test("doQuestion sin token → 401 y el pipeline no corre", async () => {
    const { app, llamadas } = armar("tok");
    expect((await app.handle(post())).status).toBe(401);
    expect(llamadas).toHaveLength(0);
  });

  test("token equivocado → 401", async () => {
    const { app, llamadas } = armar("tok");
    expect((await app.handle(post({ "x-engine-token": "otro" }))).status).toBe(401);
    expect(llamadas).toHaveLength(0);
  });

  test("sin token el cuerpo ni se valida (no revela el esquema)", async () => {
    const { app } = armar("tok");
    expect((await app.handle(post({}, { basura: 1 }))).status).toBe(401);
  });

  test("engine sin ENGINE_TOKEN configurado → cerrado (503)", async () => {
    const { app, llamadas } = armar("");
    expect((await app.handle(post({ "x-engine-token": "" }))).status).toBe(503);
    expect(llamadas).toHaveLength(0);
  });

  test("token correcto → responde; el modo efímero llega al pipeline", async () => {
    const { app, llamadas } = armar("tok");
    const res = await app.handle(post({ "x-engine-token": "tok" }, { ...cuerpo, ephemeral: true }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { answer: string }).answer).toBe("ok");
    expect(llamadas[0]).toMatchObject({ workspaceId: "ws1", ephemeral: true });
  });

  test("estado del canal para el panel también exige token", async () => {
    const { app } = armar("tok");
    const url = "http://engine/api/whatsapp/estado/ws1";
    expect((await app.handle(new Request(url))).status).toBe(401);
    const ok = await app.handle(new Request(url, { headers: { "x-engine-token": "tok" } }));
    expect(ok.status).toBe(200);
  });

  test("una ruta cualquiera sin token → 401 (cerrado por defecto)", async () => {
    const { app } = armar("tok");
    expect((await app.handle(new Request("http://engine/api/lo-que-sea"))).status).toBe(401);
  });

  test("/health, el webhook de Meta y /internal/* no usan ENGINE_TOKEN", async () => {
    const { app } = armar("tok");
    expect((await app.handle(new Request("http://engine/health"))).status).toBe(200);
    const meta = await app.handle(new Request("http://engine/api/webhook/meta?hub.mode=subscribe"));
    expect(await meta.text()).not.toContain("No autorizado");
    const interno = await app.handle(
      new Request("http://engine/internal/supervise", { method: "POST", headers: { authorization: "Bearer super" } }),
    );
    expect(interno.status).toBe(200);
  });
});
