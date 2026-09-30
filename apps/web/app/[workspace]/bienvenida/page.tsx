import { workspaceDePagina } from "@/lib/sesion";
import { getDesign } from "@/lib/data/design";
import { WelcomeClient } from "./welcome-client";

export const dynamic = "force-dynamic";

/** «Bienvenida y consentimiento» (migración 012). */
export default async function WelcomePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const { workspace } = await workspaceDePagina(workspaceSlug);

  const design = await getDesign(workspace.id);
  return (
    <WelcomeClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initial={design.welcome}
    />
  );
}
