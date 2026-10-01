import { workspaceDePagina } from "@/lib/sesion";
import { getDesign, getProgramProgress } from "@/lib/data/design";
import { nextAfterDesignStep } from "@/lib/design";
import { BoundariesClient } from "./boundaries-client";

export const dynamic = "force-dynamic";

/** «Qué no hace el asistente» (migración 012). */
export default async function LimitsPage({
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
    <BoundariesClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initial={design.boundaries}
      next={nextAfterDesignStep("boundaries", progress)}
    />
  );
}
