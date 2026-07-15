// Historial de conversación contra `users_interactions` (schema aly-saas:
// role = user | assistant). Portado de _getHistory/_saveHistory/_formatHistory
// del Aly-legacy — allá leía de debug_questions (pares Q/A); acá la tabla ya
// guarda filas role/message, así que se lee directo.

import { sql } from "../db";
import {
  GREETING_INSTRUCTION,
  HISTORY_HEADER,
  HISTORY_LIMIT,
  HISTORY_MESSAGE_TRUNCATE,
} from "./params";

export interface HistoryMessage {
  role: string; // "user" | "assistant"
  message: string;
}

/**
 * Últimos mensajes de la conversación en orden cronológico. Se descartan las
 * respuestas del asistente que fueron el fallback "sin info" (envenenan el
 * transcript: el modelo imita la negativa en los follow-ups).
 */
export async function getHistory(
  workspaceId: string,
  conversationId: string,
  noInfoFallback: string,
): Promise<HistoryMessage[]> {
  try {
    const rows = await sql<{ role: string; message: string }[]>`
      SELECT role, message
      FROM users_interactions
      WHERE workspace_id = ${workspaceId}
        AND conversation_id = ${conversationId}
      ORDER BY timestamp DESC
      LIMIT ${HISTORY_LIMIT * 2}
    `;

    const fallback = noInfoFallback.trim();
    return rows
      .reverse()
      .filter((r) => {
        if (r.role === "assistant" && fallback && r.message.trim().startsWith(fallback)) {
          return false;
        }
        return r.message.trim().length > 0;
      })
      .map((r) => ({ role: r.role, message: r.message }));
  } catch (error) {
    console.error("❌ Error fetching history:", error);
    return [];
  }
}

export function formatHistory(history: HistoryMessage[]): string {
  if (history.length === 0) return GREETING_INSTRUCTION;

  const formatted = history
    .map((h) => {
      const label = h.role === "user" ? "User" : "IA";
      const msg =
        h.role !== "user" && h.message.length > HISTORY_MESSAGE_TRUNCATE
          ? h.message.substring(0, HISTORY_MESSAGE_TRUNCATE) + "..."
          : h.message;
      return `${label}: ${msg}`;
    })
    .join("\n");

  return HISTORY_HEADER + formatted;
}

/** Guarda el par user + assistant (no bloqueante en el pipeline). */
export async function saveHistory(
  workspaceId: string,
  conversationId: string,
  clientNumber: string,
  question: string,
  answer: string,
): Promise<void> {
  try {
    const now = new Date();
    const iaNow = new Date(now.getTime() + 1); // +1ms → orden determinista

    await sql`
      INSERT INTO users_interactions
        (workspace_id, conversation_id, client_number, role, message, status, timestamp)
      VALUES
        (${workspaceId}, ${conversationId}, ${clientNumber}, 'user', ${question}, 'open', ${now}),
        (${workspaceId}, ${conversationId}, ${clientNumber}, 'assistant', ${answer}, 'open', ${iaNow})
    `;
  } catch (error) {
    console.error("❌ Error saving history:", error);
  }
}
