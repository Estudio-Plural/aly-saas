// Rutas del canal WhatsApp (Elysia). La lógica vive en canal.ts; acá solo se
// cablean las dependencias reales y los detalles HTTP.

import { Elysia } from "elysia";
import { sql } from "../db";
import { processQuestion } from "../engine";
import { crearCanal } from "./canal";
import { sendWhatsAppText } from "./meta-cloud-api";
import { appSecretsDelEntorno } from "./meta-webhook";
import { crearStorePostgres } from "./store";

export const canal = crearCanal({
  store: crearStorePostgres(sql, Number(process.env.WA_DB_TIMEOUT_MS ?? 5_000)),
  procesar: processQuestion,
  enviar: sendWhatsAppText,
  appSecrets: () => appSecretsDelEntorno(),
  verifyToken: () => process.env.META_VERIFY_TOKEN ?? "",
  leerEnv: (nombre) => process.env[nombre],
  pipelineTimeoutMs: Number(process.env.WA_PIPELINE_TIMEOUT_MS ?? 60_000),
});

export const whatsappRoutes = new Elysia()
  .get("/api/webhook/meta", async ({ query, set }) => {
    const r = await canal.verificar(query as Record<string, string | undefined>);
    set.status = r.status;
    set.headers["content-type"] = "text/plain";
    return r.body;
  })
  .post(
    "/api/webhook/meta",
    async ({ body, request, set }) => {
      const raw = typeof body === "string" ? body : "";
      const r = await canal.recibir(raw, request.headers.get("x-hub-signature-256"));
      set.status = r.status;
      return r.body;
    },
    {
      // `parse` a nivel de ruta: el cuerpo llega como string con los BYTES
      // EXACTOS que Meta firmó (sin esto no se puede verificar la firma).
      parse: async ({ request }) => await request.text(),
    },
  );
// El estado del entorno para el panel (GET /api/whatsapp/estado/:workspaceId) vive en
// app.ts, detrás de ENGINE_TOKEN: acá solo queda el webhook, que se autentica con la
// firma de Meta.
