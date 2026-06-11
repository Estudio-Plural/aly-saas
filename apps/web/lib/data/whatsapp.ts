// Stats de mensajes de WhatsApp — solo servidor.
import { sql } from "@/lib/db";

export type WhatsappStats = {
  total: number;
  today: number;
  sent: number;
};

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
