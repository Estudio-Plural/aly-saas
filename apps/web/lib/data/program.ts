// Prompt núcleo + storyboard del programa conversacional — solo servidor.
// Viven en workspace_configs.core_prompt / workspace_configs.storyboard.
// NULL en DB → defaults comportamentales (lib/workspaces.ts), mismo patrón
// que prompts/capabilities en el engine.
import { sql } from "@/lib/db";
import {
  DEFAULT_CORE_PROMPT,
  DEFAULT_STORYBOARD,
  listStoryboardAttachments,
  type CorePrompt,
  type Storyboard,
  type StoryboardAttachment,
  type StoryboardMomentKey,
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

async function upsertStoryboard(
  workspaceId: string,
  storyboard: Storyboard
): Promise<void> {
  await sql`
    INSERT INTO workspace_configs (workspace_id, storyboard)
    VALUES (${workspaceId}, ${sql.json(storyboard)})
    ON CONFLICT (workspace_id) DO UPDATE SET storyboard = EXCLUDED.storyboard
  `;
}

/** Guarda los textos de los 4 momentos preservando los adjuntos existentes. */
export async function saveStoryboard(
  workspaceId: string,
  texts: Omit<Storyboard, "attachments">
): Promise<void> {
  const current = await getStoryboard(workspaceId);
  await upsertStoryboard(workspaceId, {
    ...texts,
    ...(current.attachments ? { attachments: current.attachments } : {}),
  });
}

/** Agrega un material a un momento del storyboard y devuelve el storyboard actualizado. */
export async function addStoryboardAttachment(
  workspaceId: string,
  moment: StoryboardMomentKey,
  attachment: StoryboardAttachment
): Promise<Storyboard> {
  const current = await getStoryboard(workspaceId);
  const updated: Storyboard = {
    ...current,
    attachments: {
      ...current.attachments,
      [moment]: [...(current.attachments?.[moment] ?? []), attachment],
    },
  };
  await upsertStoryboard(workspaceId, updated);
  return updated;
}

/** Saca un material del storyboard; devuelve el adjunto (para borrar el archivo) o null. */
export async function removeStoryboardAttachment(
  workspaceId: string,
  attachmentId: string
): Promise<StoryboardAttachment | null> {
  const current = await getStoryboard(workspaceId);
  const found = listStoryboardAttachments(current).find(
    ({ attachment }) => attachment.id === attachmentId
  );
  if (!found) return null;

  const attachments = { ...current.attachments };
  attachments[found.moment] = (attachments[found.moment] ?? []).filter(
    (att) => att.id !== attachmentId
  );
  await upsertStoryboard(workspaceId, { ...current, attachments });
  return found.attachment;
}

export async function getStoryboardAttachment(
  workspaceId: string,
  attachmentId: string
): Promise<StoryboardAttachment | null> {
  const storyboard = await getStoryboard(workspaceId);
  return (
    listStoryboardAttachments(storyboard).find(
      ({ attachment }) => attachment.id === attachmentId
    )?.attachment ?? null
  );
}
