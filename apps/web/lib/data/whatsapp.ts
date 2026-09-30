// Canal WhatsApp (Meta Cloud API directo, migración 013) — solo servidor.
import { sql } from "@/lib/db";
import type { ChecklistGuardado, ConexionWhatsapp, PasoManualId } from "@/lib/whatsapp-checklist";

export type WhatsappStats = {
  total: number;
  today: number;
  sent: number;
};

/** Legacy (tabla whatsapp_messages de Kapso, nunca poblada). */
export async function getWhatsappStats(workspaceId: string): Promise<WhatsappStats> {
  const [row] = await sql<WhatsappStats[]>`
    SELECT
      count(*)::int AS total,
      (count(*) FILTER (WHERE created_at::date = CURRENT_DATE))::int AS today,
      (count(*) FILTER (WHERE direction = 'outbound'))::int AS sent
    FROM whatsapp_messages
    WHERE workspace_id = ${workspaceId}
  `;
  return row;
}

type ConexionRow = {
  phone_number_id: string | null;
  display_number: string | null;
  waba_id: string | null;
  token_env: string | null;
  checklist: ChecklistGuardado | null;
  enabled: boolean;
  last_inbound_at: Date | null;
  last_reply_at: Date | null;
  last_error: string | null;
  last_error_at: Date | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function getWhatsappConnection(workspaceId: string): Promise<ConexionWhatsapp | null> {
  const rows = await sql<ConexionRow[]>`
    SELECT phone_number_id, display_number, waba_id, token_env, checklist, enabled,
           last_inbound_at, last_reply_at, last_error, last_error_at
    FROM whatsapp_connections WHERE workspace_id = ${workspaceId}
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    phoneNumberId: r.phone_number_id,
    displayNumber: r.display_number,
    wabaId: r.waba_id,
    tokenEnv: r.token_env,
    checklist: r.checklist ?? {},
    enabled: r.enabled,
    lastInboundAt: iso(r.last_inbound_at),
    lastReplyAt: iso(r.last_reply_at),
    lastError: r.last_error,
    lastErrorAt: iso(r.last_error_at),
  };
}

export async function getWebhookVerificadoAt(): Promise<string | null> {
  const rows = await sql<{ last_verified_at: Date | null }[]>`
    SELECT last_verified_at FROM wa_webhook_state WHERE id = 1
  `;
  return iso(rows[0]?.last_verified_at ?? null);
}

/** Cifras agregadas para el cliente: nunca transcripciones ni identidades. */
export type CifrasCanal = {
  personasAceptaron: number;
  conversaciones7d: number;
  mensajes7d: number;
};

export async function getCifrasCanal(workspaceId: string): Promise<CifrasCanal> {
  const [s] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM wa_sessions WHERE workspace_id = ${workspaceId} AND consent = 'aceptado'
  `;
  // Turnos de personas con sesión de WhatsApp (el preview web no cuenta).
  const [m] = await sql<{ conversaciones: number; mensajes: number }[]>`
    SELECT count(DISTINCT ui.conversation_id)::int AS conversaciones,
           (count(*) FILTER (WHERE ui.role = 'user'))::int AS mensajes
    FROM users_interactions ui
    WHERE ui.workspace_id = ${workspaceId}
      AND ui.timestamp > NOW() - interval '7 days'
      AND EXISTS (SELECT 1 FROM wa_sessions s WHERE s.workspace_id = ui.workspace_id AND s.identidad = ui.client_number)
  `;
  return {
    personasAceptaron: s?.n ?? 0,
    conversaciones7d: m?.conversaciones ?? 0,
    mensajes7d: m?.mensajes ?? 0,
  };
}

export class PhoneNumberIdEnUso extends Error {}

export async function saveWhatsappConnection(
  workspaceId: string,
  data: {
    phoneNumberId: string | null;
    displayNumber: string | null;
    wabaId: string | null;
    tokenEnv: string | null;
    enabled: boolean;
    pasos: Partial<Record<PasoManualId, boolean>>;
    por: string;
  },
): Promise<ConexionWhatsapp> {
  const actual = await getWhatsappConnection(workspaceId);
  const ahora = new Date().toISOString();
  const checklist: ChecklistGuardado = { ...(actual?.checklist ?? {}) };
  for (const [id, hecho] of Object.entries(data.pasos) as [PasoManualId, boolean][]) {
    const previo = checklist[id];
    // Conserva la fecha original si el paso ya estaba hecho.
    checklist[id] = hecho
      ? { hecho: true, at: previo?.hecho ? previo.at : ahora, por: previo?.hecho ? previo.por : data.por }
      : { hecho: false, at: null, por: null };
  }

  // Cambiar de número invalida la prueba de vida: era de OTRO número.
  const cambioNumero = actual && actual.phoneNumberId !== data.phoneNumberId;

  try {
    await sql`
      INSERT INTO whatsapp_connections
        (workspace_id, phone_number_id, display_number, waba_id, token_env, checklist, enabled)
      VALUES
        (${workspaceId}, ${data.phoneNumberId}, ${data.displayNumber}, ${data.wabaId}, ${data.tokenEnv},
         ${sql.json(checklist)}, ${data.enabled})
      ON CONFLICT (workspace_id) DO UPDATE SET
        phone_number_id = EXCLUDED.phone_number_id,
        display_number = EXCLUDED.display_number,
        waba_id = EXCLUDED.waba_id,
        token_env = EXCLUDED.token_env,
        checklist = EXCLUDED.checklist,
        enabled = EXCLUDED.enabled,
        last_inbound_at = CASE WHEN ${!!cambioNumero} THEN NULL ELSE whatsapp_connections.last_inbound_at END,
        last_reply_at = CASE WHEN ${!!cambioNumero} THEN NULL ELSE whatsapp_connections.last_reply_at END,
        updated_at = NOW()
    `;
  } catch (e: any) {
    if (e?.code === "23505") throw new PhoneNumberIdEnUso("Ese phone_number_id ya está conectado a otro programa");
    throw e;
  }
  return (await getWhatsappConnection(workspaceId))!;
}
