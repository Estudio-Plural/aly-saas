// Prompt núcleo + storyboard del programa conversacional — solo servidor.
// Viven en workspace_configs.core_prompt / workspace_configs.storyboard.
// NULL en DB → defaults comportamentales (lib/workspaces.ts), mismo patrón
// que prompts/capabilities en el engine.
import { sql } from "@/lib/db";
import {
  DEFAULT_CORE_PROMPT,
  DEFAULT_STORYBOARD,
  type CorePrompt,
  type Storyboard,
} from "@/lib/workspaces";

export async function getCorePrompt(workspaceId: string): Promise<CorePrompt> {
  const rows = await sql<{ core_prompt: CorePrompt | null }[]>`
    SELECT core_prompt FROM workspace_configs WHERE workspace_id = ${workspaceId}
  `;
  return rows[0]?.core_prompt ?? DEFAULT_CORE_PROMPT;
}

export async function getStoryboard(workspaceId: string): Promise<Storyboard> {
  const rows = await sql<{ storyboard: Storyboard | null }[]>`
    SELECT storyboard FROM workspace_configs WHERE workspace_id = ${workspaceId}
  `;
  return rows[0]?.storyboard ?? DEFAULT_STORYBOARD;
}

export async function saveCorePrompt(
  workspaceId: string,
  corePrompt: CorePrompt
): Promise<void> {
  await sql`
    INSERT INTO workspace_configs (workspace_id, core_prompt)
    VALUES (${workspaceId}, ${sql.json(corePrompt)})
    ON CONFLICT (workspace_id) DO UPDATE SET core_prompt = EXCLUDED.core_prompt
  `;
}

export async function saveStoryboard(
  workspaceId: string,
  storyboard: Storyboard
): Promise<void> {
  await sql`
    INSERT INTO workspace_configs (workspace_id, storyboard)
    VALUES (${workspaceId}, ${sql.json(storyboard)})
    ON CONFLICT (workspace_id) DO UPDATE SET storyboard = EXCLUDED.storyboard
  `;
}
