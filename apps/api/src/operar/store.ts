// Implementación SQL del WeeklyStore (misma DB que apps/web).
import { hayConversacionesReales, leerDatosCifras } from "@aly-saas/operar";
import { sql } from "../db";
import type { WeeklyStatus, WeeklyStore } from "./weekly";

export const sqlWeeklyStore: WeeklyStore = {
  async listWorkspaces() {
    const rows = await sql<{ id: string; slug: string; name: string }[]>`
      SELECT id, slug, name FROM workspaces ORDER BY created_at ASC
    `;
    // Solo los que alguna vez tuvieron conversaciones reales
    const out = [];
    for (const r of rows) if (await hayConversacionesReales(sql, r.id)) out.push(r);
    return out;
  },
  leerDatos: (workspaceId, periodo) => leerDatosCifras(sql, workspaceId, periodo),
  async protocoloActivo(workspaceId) {
    const rows = await sql<{ active: boolean }[]>`
      SELECT active FROM alert_protocols WHERE workspace_id = ${workspaceId}
    `;
    return rows[0]?.active === true;
  },
  async destinatarios(workspaceId) {
    const rows = await sql<{ email: string }[]>`
      SELECT DISTINCT lower(trim(email)) AS email FROM workspace_users
      WHERE workspace_id = ${workspaceId} AND email IS NOT NULL AND trim(email) <> ''
    `;
    return rows.map((r) => r.email);
  },
  async getRun(workspaceId, weekStart) {
    const rows = await sql<{ status: WeeklyStatus }[]>`
      SELECT status FROM weekly_reports WHERE workspace_id = ${workspaceId} AND week_start = ${weekStart}
    `;
    return rows[0] ?? null;
  },
  async saveRun(run) {
    await sql`
      INSERT INTO weekly_reports (workspace_id, week_start, summary, status, recipients_count, sent_at)
      VALUES (${run.workspaceId}, ${run.weekStart}, ${sql.json(JSON.parse(JSON.stringify(run.summary)))},
              ${run.status}, ${run.recipientsCount}, ${run.status === "sent" ? new Date() : null})
      ON CONFLICT (workspace_id, week_start) DO UPDATE SET
        summary = EXCLUDED.summary,
        status = EXCLUDED.status,
        recipients_count = EXCLUDED.recipients_count,
        sent_at = EXCLUDED.sent_at
      WHERE weekly_reports.status <> 'sent'
    `;
  },
};
