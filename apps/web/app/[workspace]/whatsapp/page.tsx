import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getWhatsappStats } from "@/lib/data/whatsapp";
import { WhatsAppClient } from "./whatsapp-client";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const stats = await getWhatsappStats(workspace.id);

  return (
    <WhatsAppClient
      workspaceSlug={workspace.slug}
      initialStatus={
        workspace.kapso_connection_status === "connected" ? "connected" : "disconnected"
      }
      initialPhoneNumber={workspace.whatsapp_phone_number}
      connectedSince={workspace.updated_at}
      stats={stats}
    />
  );
}
