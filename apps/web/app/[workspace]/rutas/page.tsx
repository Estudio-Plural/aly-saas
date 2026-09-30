import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getDesign } from "@/lib/data/design";
import { HelpRoutesClient } from "./help-routes-client";

export const dynamic = "force-dynamic";

/** «Rutas de ayuda» (migración 012). */
export default async function HelpRoutesPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const design = await getDesign(workspace.id);
  return (
    <HelpRoutesClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initial={design.help_routes}
    />
  );
}
