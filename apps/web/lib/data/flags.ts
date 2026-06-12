// Reglas del flagging system por workspace — solo servidor.
// Viven en workspace_configs.flag_rules: [{id, description, severity}]
import { sql } from "@/lib/db";
import type { FlagRule } from "@/lib/workspaces";

export async function getFlagRules(workspaceId: string): Promise<FlagRule[]> {
  const rows = await sql<{ flag_rules: FlagRule[] }[]>`
    SELECT flag_rules FROM workspace_configs WHERE workspace_id = ${workspaceId}
  `;
  return Array.isArray(rows[0]?.flag_rules) ? rows[0].flag_rules : [];
}

export async function saveFlagRules(
  workspaceId: string,
  rules: FlagRule[]
): Promise<void> {
  await sql`
    UPDATE workspace_configs
    SET flag_rules = ${sql.json(rules)}
    WHERE workspace_id = ${workspaceId}
  `;
}
