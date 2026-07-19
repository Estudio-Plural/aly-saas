import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getCorePrompt } from "@/lib/data/program";
import { IdentityClient } from "./identity-client";

export const dynamic = "force-dynamic";

export default async function IdentityPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const corePrompt = await getCorePrompt(workspace.id);
  return (
    <IdentityClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initialCorePrompt={corePrompt}
    />
  );
}
