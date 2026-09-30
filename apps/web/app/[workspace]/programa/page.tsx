import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getDesign } from "@/lib/data/design";
import { ProgramClient } from "./program-client";

export const dynamic = "force-dynamic";

/** «Tu programa»: identidad + momentos del programa en un solo formulario. */
export default async function ProgramPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const design = await getDesign(workspace.id);
  return (
    <ProgramClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initialCore={design.core_prompt ?? {}}
      initialStoryboard={design.storyboard ?? {}}
    />
  );
}
