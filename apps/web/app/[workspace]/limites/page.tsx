import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getDesign } from "@/lib/data/design";
import { BoundariesClient } from "./boundaries-client";

export const dynamic = "force-dynamic";

/** «Qué no hace el asistente» (migración 012). */
export default async function LimitsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const design = await getDesign(workspace.id);
  return (
    <BoundariesClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initial={design.boundaries}
    />
  );
}
