// Rutas del engine (Elysia). Separado de index.ts para poder testear los
// handlers con app.handle(Request) sin abrir un puerto.

import { createHash, timingSafeEqual } from "node:crypto";
import { Elysia, t } from "elysia";
import { processQuestion } from "./engine";
import { isLlmConfigured } from "./engine/openrouter";
import { runSupervisor, type SupervisorReport } from "./supervisor";
import { runWeeklyReportsFromEnv } from "./operar";

export interface AppOptions {
  /** Token de SUPERVISOR_TOKEN. Sin token, /internal/* queda cerrado (503). */
  supervisorToken?: string;
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

  return new Elysia()
    .get("/health", () => ({ ok: true, llm: isLlmConfigured() }))
    .post(
      "/api/rag/doQuestion",
      async ({ body }) =>
        processQuestion({
          question: body.userQuestion,
          userNumber: body.userNumber,
          conversationId: body.conversationId,
          workspaceId: body.workspaceId,
          language: body.language ?? "es",
        }),
      {
        body: t.Object({
          userQuestion: t.String(),
          userNumber: t.String(),
          conversationId: t.String(),
          workspaceId: t.String(),
          language: t.Optional(t.String()),
        }),
      },
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
