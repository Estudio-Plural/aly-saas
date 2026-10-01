import { workspaceDePagina } from "@/lib/sesion";
import { puedeAdministrarOrg } from "@/lib/auth";
import { getProgramProgress } from "@/lib/data/design";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const { acceso, workspace } = await workspaceDePagina(workspaceSlug);
  const progress = await getProgramProgress(workspace);

  return (
    <SettingsClient
      initialWorkspace={workspace}
      // Borrar y crear asistentes: admin de la organización o equipo Plural.
      puedeAdministrar={puedeAdministrarOrg(acceso, workspace.org_id)}
      whatsappConectado={progress.connect}
    />
  );
}
