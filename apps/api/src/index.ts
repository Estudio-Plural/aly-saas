// Servidor del engine (Elysia/Bun). Expone el pipeline conversacional
// multi-tenant (la UI de Next le pega a POST /api/rag/doQuestion) y el
// disparador interno del supervisor de conversaciones.
//
// Autenticación (app.ts): todo exige ENGINE_TOKEN (X-Engine-Token, lo manda el
// panel) salvo /health, el webhook de Meta (firma) y /internal/* (SUPERVISOR_TOKEN).

import { createApp } from "./app";
import { startSupervisorInterval } from "./supervisor";
import { startWeeklyReportInterval } from "./operar";

const port = Number(process.env.API_PORT ?? 8080);

const app = createApp().listen(port);
startSupervisorInterval();
startWeeklyReportInterval();

console.log(`🚀 engine escuchando en http://localhost:${port}`);

export type App = typeof app;
