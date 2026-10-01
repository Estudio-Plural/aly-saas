import { workspaceDePagina } from "@/lib/sesion";
import { getDesign, getProgramProgress } from "@/lib/data/design";
import { nextAfterDesignStep } from "@/lib/design";
import { HelpRoutesClient } from "./help-routes-client";

export const dynamic = "force-dynamic";

/** «Rutas de ayuda» (migración 012). */
export default async function HelpRoutesPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const { workspace } = await workspaceDePagina(workspaceSlug);

  const [design, progress] = await Promise.all([
    getDesign(workspace.id),
    getProgramProgress(workspace),
  ]);
  return (
    <HelpRoutesClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initial={design.help_routes}
      next={nextAfterDesignStep("routes", progress)}
    />
  );
}
