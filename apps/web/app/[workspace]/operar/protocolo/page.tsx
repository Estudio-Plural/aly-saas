import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getAlertProtocol } from "@/lib/data/operar";
import { EMPTY_PROTOCOL } from "@/lib/operar";
import { ProtocoloClient } from "./protocolo-client";

export const dynamic = "force-dynamic";

export default async function ProtocoloPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const protocol = (await getAlertProtocol(workspace.id)) ?? EMPTY_PROTOCOL;
  return (
    <ProtocoloClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initialProtocol={protocol}
    />
  );
}
