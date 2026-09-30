// Implementación SQL del SupervisorStore (postgres.js, misma DB que apps/web).
// El análisis vive en conversations_data (la misma fila que escribe el
// "Reiniciar" del preview), con las columnas de la migración 010.

import { sql } from "../db";
import {
  DEFAULT_CORE_PROMPT,
  DEFAULT_STORYBOARD,
  type CorePrompt,
  type Storyboard,
} from "../config/identity";
import type {
  AlertChannel,
  FlagRule,
  IdleConversation,
  SaveAnalysisInput,
  SupervisorMessage,
  SupervisorStore,
  WorkspaceContext,
} from "./types";

export const DEFAULT_SUPERVISOR_MODEL = "openai/gpt-4o-mini";

/**
 * Criterio de selección (espejo en TS: `needsSupervision` en job.ts):
 * ≥ 2 mensajes, el último hace ≥ idleMinutes, y sin análisis o con un
 * análisis que no cubre el último mensaje. Las más viejas primero.
 */
async function listIdleConversations(
  idleMinutes: number,
  limit: number,
): Promise<IdleConversation[]> {
  const rows = await sql<
    {
      workspace_id: string;
      conversation_id: string;
      client_number: string;
      messages_count: number;
      last_message_at: Date;
      analyzed_through: Date | null;
    }[]
  >`
    SELECT
      ui.workspace_id,
      ui.conversation_id,
      (ARRAY_AGG(ui.client_number ORDER BY ui.timestamp DESC))[1] AS client_number,
      COUNT(*)::int AS messages_count,
      MAX(ui.timestamp) AS last_message_at,
      cd.analyzed_through
    FROM users_interactions ui
    LEFT JOIN conversations_data cd
      ON cd.workspace_id = ui.workspace_id AND cd.conversation_id = ui.conversation_id
    GROUP BY ui.workspace_id, ui.conversation_id, cd.analyzed_through
    HAVING COUNT(*) >= 2
      AND MAX(ui.timestamp) <= NOW() - make_interval(mins => ${idleMinutes})
      -- date_trunc: Postgres guarda µs y el Date de JS solo ms; sin esto el
      -- analyzed_through guardado desde JS quedaría siempre "antes" del último
      -- mensaje y la conversación se re-analizaría en cada corrida.
      AND (cd.analyzed_through IS NULL
           OR cd.analyzed_through < date_trunc('milliseconds', MAX(ui.timestamp)))
    ORDER BY MAX(ui.timestamp) ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    workspaceId: r.workspace_id,
    conversationId: r.conversation_id,
    clientNumber: r.client_number,
    messagesCount: r.messages_count,
    lastMessageAt: r.last_message_at,
    analyzedThrough: r.analyzed_through,
  }));
}

async function getMessages(
  workspaceId: string,
  conversationId: string,
): Promise<SupervisorMessage[]> {
  const rows = await sql<{ id: string; role: string; message: string; timestamp: Date }[]>`
    SELECT id, role, message, timestamp
    FROM users_interactions
    WHERE workspace_id = ${workspaceId} AND conversation_id = ${conversationId}
    ORDER BY timestamp ASC, created_at ASC
  `;
  return rows.map((r) => ({ id: r.id, role: r.role, text: r.message, timestamp: r.timestamp }));
}

async function getWorkspaceContext(workspaceId: string): Promise<WorkspaceContext | null> {
  const rows = await sql<
    {
      slug: string;
      name: string;
      flag_rules: FlagRule[] | null;
      core_prompt: CorePrompt | null;
      storyboard: Storyboard | null;
      model_preferences: Record<string, string> | null;
      p_responsible: string | null;
      p_channel: AlertChannel | null;
      p_target: string | null;
      p_hours: number | null;
      p_active: boolean | null;
    }[]
  >`
    SELECT w.slug, w.name, c.flag_rules, c.core_prompt, c.storyboard, c.model_preferences,
           p.responsible_name AS p_responsible, p.channel AS p_channel,
           p.channel_target AS p_target, p.response_time_hours AS p_hours, p.active AS p_active
    FROM workspaces w
    LEFT JOIN workspace_configs c ON c.workspace_id = w.id
    LEFT JOIN alert_protocols p ON p.workspace_id = w.id
    WHERE w.id = ${workspaceId}
  `;
  const row = rows[0];
  if (!row) return null;
  const prefs = row.model_preferences ?? {};
  return {
    workspaceId,
    slug: row.slug,
    name: row.name,
    rules: Array.isArray(row.flag_rules) ? row.flag_rules : [],
    core: { ...DEFAULT_CORE_PROMPT, ...(row.core_prompt ?? {}) },
    storyboard: { ...DEFAULT_STORYBOARD, ...(row.storyboard ?? {}) },
    model:
      prefs.supervisor ?? prefs.chat ?? process.env.OPENROUTER_MODEL ?? DEFAULT_SUPERVISOR_MODEL,
    protocol:
      row.p_active === null
        ? null
        : {
            responsibleName: row.p_responsible,
            channel: row.p_channel,
            channelTarget: row.p_target,
            responseTimeHours: row.p_hours,
            active: row.p_active,
          },
  };
}

/**
 * Upsert con guard de idempotencia: nunca pisa un análisis que ya cubre el
 * mismo último mensaje o uno posterior (dos corridas en paralelo, o el
 * "Reiniciar" del preview ganándole al job).
 */
async function saveAnalysis(input: SaveAnalysisInput): Promise<boolean> {
  const { conversation: conv, analysis } = input;
  const rows = await sql<{ id: string }[]>`
    INSERT INTO conversations_data
      (workspace_id, conversation_id, user_number, conversation_date, summary, keywords,
       flags, flag_severity, messages_count, analysis, analyzed_at, analyzed_through)
    VALUES
      (${conv.workspaceId}, ${conv.conversationId}, ${conv.clientNumber}, CURRENT_DATE,
       ${analysis.summary}, ${analysis.keywords}::text[], ${input.flagsText}, ${input.flagSeverity},
       ${conv.messagesCount}, ${sql.json(JSON.parse(JSON.stringify(analysis)))}, NOW(),
       ${input.analyzedThrough})
    ON CONFLICT (workspace_id, conversation_id) DO UPDATE SET
      summary = EXCLUDED.summary,
      keywords = EXCLUDED.keywords,
      flags = EXCLUDED.flags,
      flag_severity = EXCLUDED.flag_severity,
      messages_count = EXCLUDED.messages_count,
      analysis = EXCLUDED.analysis,
      analyzed_at = EXCLUDED.analyzed_at,
      analyzed_through = EXCLUDED.analyzed_through,
      reviewed_at = CASE WHEN ${input.resetReview} THEN NULL ELSE conversations_data.reviewed_at END,
      reviewed_by = CASE WHEN ${input.resetReview} THEN NULL ELSE conversations_data.reviewed_by END
    WHERE conversations_data.analyzed_through IS NULL
       OR conversations_data.analyzed_through < EXCLUDED.analyzed_through
    RETURNING id
  `;
  return rows.length > 0;
}

export const sqlSupervisorStore: SupervisorStore = {
  listIdleConversations,
  getMessages,
  getWorkspaceContext,
  saveAnalysis,
};
