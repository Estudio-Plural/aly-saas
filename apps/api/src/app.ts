// Rutas del engine (Elysia). Separado de index.ts para poder testear los
// handlers con app.handle(Request) sin abrir un puerto.

import { createHash, timingSafeEqual } from "node:crypto";
import { Elysia, t } from "elysia";
import { processQuestion } from "./engine";
import { isLlmConfigured } from "./engine/openrouter";
import { runSupervisor, type SupervisorReport } from "./supervisor";
import { runWeeklyReportsFromEnv } from "./operar";
import { canal, whatsappRoutes } from "./whatsapp";

export interface AppOptions {
  /** Token de SUPERVISOR_TOKEN. Sin token, /internal/* queda cerrado (503). */
  supervisorToken?: string;
  /**
   * ENGINE_TOKEN: lo manda el panel (apps/web/lib/engine.ts) en `X-Engine-Token`.
   * Exigido en toda ruta que no sea el webhook de Meta (firma propia), /internal/*
   * (SUPERVISOR_TOKEN) ni /health. Sin token configurado, esas rutas quedan cerradas (503).
   */
  engineToken?: string;
  /** Pregunta al pipeline (inyectable en tests). */
  ask?: typeof processQuestion;
  /** Estado del entorno del canal para el panel (inyectable en tests). */
  whatsappEstado?: (workspaceId: string) => unknown;
  supervise?: () => Promise<SupervisorReport>;
  /** Corrida del reporte semanal (mismo token que el supervisor). */
  weeklyReport?: () => Promise<unknown>;
}

/** Comparación en tiempo constante (hash previo: iguala largos). */
export function tokenMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function createApp({
  supervisorToken = process.env.SUPERVISOR_TOKEN,
  engineToken = process.env.ENGINE_TOKEN,
  ask = processQuestion,
  whatsappEstado = (workspaceId) => canal.estadoEntorno(workspaceId),
  supervise = () => runSupervisor(),
  weeklyReport = () => runWeeklyReportsFromEnv(),
}: AppOptions = {}) {
  /** null si pasa; si no, el cuerpo de error (y deja el status puesto). */
  const guard = (authorization: string | undefined, set: { status?: number | string }) => {
    if (!supervisorToken) {
      set.status = 503;
      return { error: "Endpoints internos deshabilitados: falta SUPERVISOR_TOKEN" };
    }
    const auth = authorization ?? "";
    const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!given || !tokenMatches(given, supervisorToken)) {
      set.status = 401;
      return { error: "No autorizado" };
    }
    return null;
  };

  /** Rutas del panel → engine: `X-Engine-Token: <ENGINE_TOKEN>`. */
  const engineGuard = (given: string | undefined, set: { status?: number | string }) => {
    if (!engineToken) {
      set.status = 503;
      return { error: "Engine cerrado: falta ENGINE_TOKEN" };
    }
    if (!given || !tokenMatches(given.trim(), engineToken)) {
      set.status = 401;
      return { error: "No autorizado" };
    }
    return null;
  };

  // Cerrado por defecto: toda ruta nueva exige ENGINE_TOKEN salvo las que tienen su propia
  // autenticación (webhook de Meta: firma; /internal/*: SUPERVISOR_TOKEN) y /health.
  // Corre en onRequest, antes del ruteo y de validar el cuerpo: sin token no se revela nada.
  const publica = (path: string) =>
    path === "/health" || path === "/api/webhook/meta" || path.startsWith("/internal/");

  return new Elysia()
    .onRequest(({ request, set }) => {
      if (publica(new URL(request.url).pathname)) return;
      const denied = engineGuard(request.headers.get("x-engine-token") ?? undefined, set);
      if (denied) return denied;
    })
    // Canal WhatsApp (Meta Cloud API directo): GET/POST /api/webhook/meta
    .use(whatsappRoutes)
    .get("/health", () => ({ ok: true, llm: isLlmConfigured() }))
    .post(
      "/api/rag/doQuestion",
      async ({ body }) =>
        ask({
          question: body.userQuestion,
          userNumber: body.userNumber,
          conversationId: body.conversationId,
          workspaceId: body.workspaceId,
          language: body.language ?? "es",
          ephemeral: body.ephemeral === true,
        }),
      {
        body: t.Object({
          userQuestion: t.String(),
          userNumber: t.String(),
          conversationId: t.String(),
          workspaceId: t.String(),
          language: t.Optional(t.String()),
          // Banco de casos difíciles: sin historial ni persistencia.
          ephemeral: t.Optional(t.Boolean()),
        }),
      },
    )
    // Para el panel: qué ve el engine de su propio entorno del canal (booleanos, nunca secretos).
    .get(
      "/api/whatsapp/estado/:workspaceId",
      async ({ params }) => whatsappEstado(params.workspaceId),
    )
    // Dispara una corrida del supervisor. Interno: `Authorization: Bearer <SUPERVISOR_TOKEN>`.
    // La respuesta trae solo ids y conteos (nunca texto de conversaciones).
    .post("/internal/supervise", async ({ headers, set }) => {
      const denied = guard(headers.authorization, set);
      return denied ?? supervise();
    })
    // Reporte semanal: manda (o deja para descargar) el resumen de la última
    // semana completa. Idempotente. Respuesta: slugs y resultados, sin cifras.
    .post("/internal/weekly-report", async ({ headers, set }) => {
      const denied = guard(headers.authorization, set);
      return denied ?? weeklyReport();
    });
}
