import { workspaceDePagina } from "@/lib/sesion";
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
  const { acceso, workspace } = await workspaceDePagina(workspaceSlug);

  const protocol = (await getAlertProtocol(workspace.id)) ?? EMPTY_PROTOCOL;
  return (
    <ProtocoloClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initialProtocol={protocol}
      esPlural={acceso.esPlural}
    />
  );
}
