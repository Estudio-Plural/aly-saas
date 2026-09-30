// Inbox de conversaciones del workspace — solo servidor.
// Agrupa users_interactions por conversación y suma el análisis de
// conversations_data (summary/flags) y los datos del usuario (users_data).
import { sql } from "@/lib/db";
import { WEB_PREVIEW_NUMBER } from "@/lib/data/chat";
import type { ConversationSummary, ConversationSupervision } from "@/lib/workspaces";
import type { ConversationAnalysis } from "@/lib/enrichment";

type ConversationRow = {
  conversation_id: string;
  client_number: string;
  user_name: string | null;
  last_message: string;
  last_message_role: "user" | "assistant";
  messages_count: number;
  is_open: boolean;
  started_at: Date;
  last_at: Date;
  summary: string | null;
  keywords: string[] | null;
  flags: string | null;
  flag_severity: string | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  analysis: ConversationSupervision | null;
};

/** Número de WhatsApp enmascarado para quien no ve transcripciones: «Persona ···1234». */
export function maskNumber(number: string): string {
  const digits = number.replace(/\D/g, "");
  return digits.length >= 4 ? `Persona ···${digits.slice(-4)}` : "Persona";
}

/**
 * El análisis del supervisor para quien no ve transcripciones (rol cliente): solo qué regla
 * saltó y con qué severidad. Sin la evidencia textual (fragmentos de mensajes de la persona)
 * ni el detalle redactado por el analista, que puede parafrasearlos.
 */
export function supervisionSinTexto(s: ConversationSupervision): ConversationSupervision {
  return {
    ...s,
    cumplioCriterioExito: { value: s.cumplioCriterioExito.value, evidence: [] },
    flags: s.flags.map((f) => ({ ...f, detail: "", evidence: [] })),
  };
}

/**
 * Bandeja de conversaciones. Con `verTranscripciones: false` (rol cliente) NO sale el texto
 * de ningún mensaje ni el nombre/número de la persona: solo fecha, estado, alertas y resumen.
 */
export async function listConversations(
  workspaceId: string,
  opts: { verTranscripciones: boolean }
): Promise<ConversationSummary[]> {
  const rows = await sql<ConversationRow[]>`
    SELECT
      ui.conversation_id,
      ui.client_number,
      ud.name AS user_name,
      (ARRAY_AGG(ui.message ORDER BY ui.timestamp DESC, ui.created_at DESC))[1] AS last_message,
      (ARRAY_AGG(ui.role ORDER BY ui.timestamp DESC, ui.created_at DESC))[1] AS last_message_role,
      COUNT(*)::int AS messages_count,
      BOOL_OR(ui.status = 'open') AS is_open,
      MIN(ui.timestamp) AS started_at,
      MAX(ui.timestamp) AS last_at,
      cd.summary,
      cd.keywords,
      cd.flags,
      cd.flag_severity,
      cd.reviewed_at,
      cd.reviewed_by,
      cd.analysis
    FROM users_interactions ui
    LEFT JOIN users_data ud
      ON ud.workspace_id = ui.workspace_id AND ud.number = ui.client_number
    LEFT JOIN conversations_data cd
      ON cd.workspace_id = ui.workspace_id AND cd.conversation_id = ui.conversation_id
    WHERE ui.workspace_id = ${workspaceId}
    GROUP BY ui.conversation_id, ui.client_number, ud.name,
             cd.summary, cd.keywords, cd.flags, cd.flag_severity,
             cd.reviewed_at, cd.reviewed_by, cd.analysis
    ORDER BY MAX(ui.timestamp) DESC
  `;

  const ver = opts.verTranscripciones;
  return rows.map((row) => {
    const isWebPreview = row.client_number === WEB_PREVIEW_NUMBER;
    const supervision = row.analysis?.version === 1 ? row.analysis : null;
    return {
      conversationId: row.conversation_id,
      clientNumber: ver || isWebPreview ? row.client_number : maskNumber(row.client_number),
      userName: isWebPreview ? "Vista previa web" : ver ? row.user_name : null,
      isWebPreview,
      lastMessage: ver ? row.last_message : null,
      lastMessageRole: row.last_message_role,
      messagesCount: row.messages_count,
      isOpen: row.is_open,
      startedAt: row.started_at.toISOString(),
      lastAt: row.last_at.toISOString(),
      summary: row.summary,
      keywords: row.keywords ?? [],
      flags: row.flags,
      flagSeverity: row.flag_severity,
      reviewedAt: row.reviewed_at?.toISOString() ?? null,
      reviewedBy: row.reviewed_by,
      supervision: supervision && !ver ? supervisionSinTexto(supervision) : supervision,
    };
  });
}

/**
 * Guarda (o pisa) el análisis LLM de una conversación cerrada del preview.
 * Marca analyzed_through con el último mensaje para que el supervisor del
 * engine no la vuelva a analizar (ms, igual que el supervisor). El análisis
 * estructurado del supervisor queda obsoleto → analysis = NULL.
 */
export async function upsertConversationAnalysis(
  workspaceId: string,
  conversationId: string,
  userNumber: string,
  analysis: ConversationAnalysis,
  messagesCount: number
): Promise<void> {
  await sql`
    INSERT INTO conversations_data
      (workspace_id, conversation_id, user_number, conversation_date, summary, keywords, flags, flag_severity, messages_count,
       analysis, analyzed_at, analyzed_through)
    VALUES
      (${workspaceId}, ${conversationId}, ${userNumber}, CURRENT_DATE, ${analysis.summary}, ${analysis.keywords}::text[], ${analysis.flags}, ${analysis.flagSeverity}, ${messagesCount},
       NULL, NOW(),
       (SELECT date_trunc('milliseconds', MAX(timestamp)) FROM users_interactions
        WHERE workspace_id = ${workspaceId} AND conversation_id = ${conversationId}))
    ON CONFLICT (workspace_id, conversation_id) DO UPDATE SET
      summary = EXCLUDED.summary,
      keywords = EXCLUDED.keywords,
      flags = EXCLUDED.flags,
      flag_severity = EXCLUDED.flag_severity,
      messages_count = EXCLUDED.messages_count,
      conversation_date = EXCLUDED.conversation_date,
      analysis = EXCLUDED.analysis,
      analyzed_at = EXCLUDED.analyzed_at,
      analyzed_through = EXCLUDED.analyzed_through
  `;
}

/**
 * Marca (o desmarca) la alerta de una conversación como revisada. Solo
 * registra quién y cuándo: no contacta al usuario ni cierra la conversación.
 * Devuelve false si la conversación no tiene análisis.
 */
export async function setConversationReviewed(
  workspaceId: string,
  conversationId: string,
  reviewedBy: string | null
): Promise<{ reviewedAt: string | null; reviewedBy: string | null } | null> {
  const rows = await sql<{ reviewed_at: Date | null; reviewed_by: string | null }[]>`
    UPDATE conversations_data
    SET reviewed_at = ${reviewedBy ? sql`NOW()` : null},
        reviewed_by = ${reviewedBy}
    WHERE workspace_id = ${workspaceId} AND conversation_id = ${conversationId}
    RETURNING reviewed_at, reviewed_by
  `;
  const row = rows[0];
  if (!row) return null;
  return { reviewedAt: row.reviewed_at?.toISOString() ?? null, reviewedBy: row.reviewed_by };
}
