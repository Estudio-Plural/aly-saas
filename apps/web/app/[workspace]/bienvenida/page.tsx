import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
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
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const design = await getDesign(workspace.id);
  return (
    <WelcomeClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initial={design.welcome}
    />
  );
}
