import { workspaceDePagina } from "@/lib/sesion";
import { puedeVerTranscripciones } from "@/lib/auth";
import { listConversations } from "@/lib/data/conversations";
import { getFlagRules } from "@/lib/data/flags";
import { ConversationsClient } from "./conversations-client";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const { acceso, workspace } = await workspaceDePagina(workspaceSlug);

  const [conversations, flagRules] = await Promise.all([
    listConversations(workspace.id, { verTranscripciones: puedeVerTranscripciones(acceso) }),
    getFlagRules(workspace.id),
  ]);

  return (
    <ConversationsClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      conversations={conversations}
      initialFlagRules={flagRules}
      canSeeTranscripts={puedeVerTranscripciones(acceso)}
    />
  );
}
