import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getDesign } from "@/lib/data/design";
import { welcomeToSteps } from "@/lib/design";
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
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const [design, conversationId, storyboard] = await Promise.all([
    getDesign(workspace.id),
    getOpenConversationId(workspace.id),
    getStoryboard(workspace.id),
  ]);
  const messages = conversationId
    ? await getConversationMessages(workspace.id, conversationId)
    : [];

  // La prueba arranca como en WhatsApp: bienvenida, aviso y consentimiento
  // («Bienvenida y consentimiento»). Sin bienvenida escrita, va directo al asistente.
  const welcome = design.welcome;
  const flowSteps =
    welcome?.welcome_message?.trim() && welcome.privacy_notice?.trim()
      ? welcomeToSteps(welcome)
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
