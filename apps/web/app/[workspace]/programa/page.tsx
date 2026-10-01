import { workspaceDePagina } from "@/lib/sesion";
import { getDesign, getProgramProgress } from "@/lib/data/design";
import { nextAfterDesignStep } from "@/lib/design";
import { ProgramClient } from "./program-client";

export const dynamic = "force-dynamic";

/** «Tu programa»: identidad + momentos del programa en un solo formulario. */
export default async function ProgramPage({
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
  const next = nextAfterDesignStep("program", progress);
  return (
    <ProgramClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initialCore={design.core_prompt ?? {}}
      initialStoryboard={design.storyboard ?? {}}
      initiallySaved={Object.keys(design.core_prompt ?? {}).length > 0}
      next={{ label: next.label, href: `/${workspace.slug}/${next.path}` }}
    />
  );
}
