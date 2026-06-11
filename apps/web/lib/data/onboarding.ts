// Queries del flujo de onboarding — solo servidor.
import { sql } from "@/lib/db";
import type { OnboardingStep } from "@/lib/workspaces";

export async function getActiveFlowSteps(workspaceId: string): Promise<OnboardingStep[]> {
  const rows = await sql<{ definition: { steps?: OnboardingStep[] } }[]>`
    SELECT definition
    FROM onboarding_flows
    WHERE workspace_id = ${workspaceId} AND is_active = true
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  return rows.length ? rows[0].definition.steps ?? [] : [];
}

export async function saveActiveFlowSteps(
  workspaceId: string,
  steps: OnboardingStep[]
): Promise<void> {
  const definition = sql.json({ steps });
  const updated = await sql`
    UPDATE onboarding_flows
    SET definition = ${definition}
    WHERE id = (
      SELECT id FROM onboarding_flows
      WHERE workspace_id = ${workspaceId} AND is_active = true
      ORDER BY updated_at DESC
      LIMIT 1
    )
    RETURNING id
  `;
  if (!updated.length) {
    await sql`
      INSERT INTO onboarding_flows (workspace_id, name, definition, is_active)
      VALUES (${workspaceId}, 'Onboarding inicial', ${sql.json({ steps })}, true)
    `;
  }
}
