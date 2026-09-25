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

export async function listConversations(
  workspaceId: string
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

  return rows.map((row) => ({
    conversationId: row.conversation_id,
    clientNumber: row.client_number,
    userName:
      row.user_name ??
      (row.client_number === WEB_PREVIEW_NUMBER ? "Vista previa web" : null),
    isWebPreview: row.client_number === WEB_PREVIEW_NUMBER,
    lastMessage: row.last_message,
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
    supervision: row.analysis?.version === 1 ? row.analysis : null,
  }));
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
