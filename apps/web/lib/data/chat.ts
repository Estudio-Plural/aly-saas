// Persistencia del chat de prueba (web preview) — solo servidor.
// Los mensajes viven en users_interactions con client_number = 'web-preview'.
import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import type { ChatMessage } from "@/lib/workspaces";

export const WEB_PREVIEW_NUMBER = "web-preview";

type InteractionRow = {
  id: string;
  role: "user" | "assistant";
  message: string;
  timestamp: Date;
};

function toChatMessage(row: InteractionRow): ChatMessage {
  return {
    id: row.id,
    text: row.message,
    sender: row.role,
    timestamp: row.timestamp.toISOString(),
  };
}

/** Conversación abierta actual del preview web (si existe). */
export async function getOpenConversationId(workspaceId: string): Promise<string | null> {
  const rows = await sql<{ conversation_id: string }[]>`
    SELECT conversation_id
    FROM users_interactions
    WHERE workspace_id = ${workspaceId}
      AND client_number = ${WEB_PREVIEW_NUMBER}
      AND status = 'open'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows.length ? rows[0].conversation_id : null;
}

export async function getConversationMessages(
  workspaceId: string,
  conversationId: string
): Promise<ChatMessage[]> {
  const rows = await sql<InteractionRow[]>`
    SELECT id, role, message, timestamp
    FROM users_interactions
    WHERE workspace_id = ${workspaceId} AND conversation_id = ${conversationId}
    ORDER BY timestamp ASC, created_at ASC
  `;
  return rows.map(toChatMessage);
}

export function newConversationId(): string {
  return `web-${randomUUID()}`;
}

export async function appendMessages(
  workspaceId: string,
  conversationId: string,
  messages: { role: "user" | "assistant"; text: string }[]
): Promise<ChatMessage[]> {
  const inserted: ChatMessage[] = [];
  for (const msg of messages) {
    const [row] = await sql<InteractionRow[]>`
      INSERT INTO users_interactions (workspace_id, conversation_id, client_number, role, message, status)
      VALUES (${workspaceId}, ${conversationId}, ${WEB_PREVIEW_NUMBER}, ${msg.role}, ${msg.text}, 'open')
      RETURNING id, role, message, timestamp
    `;
    inserted.push(toChatMessage(row));
  }
  return inserted;
}

/** Cierra la conversación abierta del preview (la próxima arranca de cero). */
export async function closeOpenConversation(workspaceId: string): Promise<void> {
  await sql`
    UPDATE users_interactions
    SET status = 'closed'
    WHERE workspace_id = ${workspaceId}
      AND client_number = ${WEB_PREVIEW_NUMBER}
      AND status = 'open'
  `;
}
