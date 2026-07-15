// Servidor del engine (Elysia/Bun). Expone el pipeline conversacional
// multi-tenant. La UI de Next le pega a POST /api/rag/doQuestion.
//
// Fase 0 local: sin auth (se agrega bearer + workspace ownership en Fase 3).

import { Elysia, t } from "elysia";
import { processQuestion } from "./engine";
import { isLlmConfigured } from "./engine/openrouter";

const port = Number(process.env.API_PORT ?? 8080);

const app = new Elysia()
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
  .listen(port);

console.log(`🚀 engine escuchando en http://localhost:${port}`);

export type App = typeof app;
