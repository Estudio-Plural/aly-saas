import { workspaceDePagina } from "@/lib/sesion";
import { getActiveFlowSteps } from "@/lib/data/onboarding";
import { getOpenConversationId, getConversationMessages } from "@/lib/data/chat";
import { getStoryboard } from "@/lib/data/program";
import { isLlmConfigured } from "@/lib/llm";
import { listStoryboardAttachments } from "@/lib/workspaces";
import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const { workspace } = await workspaceDePagina(workspaceSlug);

  const [flowSteps, conversationId, storyboard] = await Promise.all([
    getActiveFlowSteps(workspace.id),
    getOpenConversationId(workspace.id),
    getStoryboard(workspace.id),
  ]);
  const messages = conversationId
    ? await getConversationMessages(workspace.id, conversationId)
    : [];

  const llmConfigured = isLlmConfigured();
  if (!llmConfigured) {
    console.warn(
      "[chat] OPENROUTER_API_KEY no configurada (apps/web/.env.local): el chat de prueba no tiene LLM."
    );
  }

  return (
    <ChatClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      flowSteps={flowSteps}
      initialMessages={messages}
      llmConfigured={llmConfigured}
      storyboardAttachments={listStoryboardAttachments(storyboard).map(
        ({ attachment }) => attachment
      )}
    />
  );
}
