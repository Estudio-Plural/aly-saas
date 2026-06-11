import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getActiveFlowSteps } from "@/lib/data/onboarding";
import { getOpenConversationId, getConversationMessages } from "@/lib/data/chat";
import { isLlmConfigured } from "@/lib/llm";
import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const flowSteps = await getActiveFlowSteps(workspace.id);
  const conversationId = await getOpenConversationId(workspace.id);
  const messages = conversationId
    ? await getConversationMessages(workspace.id, conversationId)
    : [];

  return (
    <ChatClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      flowSteps={flowSteps}
      initialMessages={messages}
      llmConfigured={isLlmConfigured()}
    />
  );
}
