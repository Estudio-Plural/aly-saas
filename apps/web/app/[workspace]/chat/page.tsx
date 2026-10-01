import { workspaceDePagina } from "@/lib/sesion";
import { getDesign, getProgramProgress } from "@/lib/data/design";
import { welcomeToSteps } from "@/lib/design";
import { getOpenConversationId, getConversationMessages } from "@/lib/data/chat";
import { getStoryboard } from "@/lib/data/program";
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

  // progress es solo lectura: decide si el siguiente paso es Situaciones difíciles o WhatsApp.
  const [design, conversationId, storyboard, progress] = await Promise.all([
    getDesign(workspace.id),
    getOpenConversationId(workspace.id),
    getStoryboard(workspace.id),
    getProgramProgress(workspace),
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

  return (
    <ChatClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      flowSteps={flowSteps}
      initialMessages={messages}
      testHecho={progress.test}
      storyboardAttachments={listStoryboardAttachments(storyboard).map(
        ({ attachment }) => attachment
      )}
    />
  );
}
