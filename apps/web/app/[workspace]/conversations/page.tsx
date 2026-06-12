import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { listConversations } from "@/lib/data/conversations";
import { ConversationsClient } from "./conversations-client";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const conversations = await listConversations(workspace.id);

  return (
    <ConversationsClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      conversations={conversations}
    />
  );
}
