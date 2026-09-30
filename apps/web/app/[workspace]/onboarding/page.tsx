import { workspaceDePagina } from "@/lib/sesion";
import { getActiveFlowSteps } from "@/lib/data/onboarding";
import { getStoryboard } from "@/lib/data/program";
import { OnboardingClient } from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const { workspace } = await workspaceDePagina(workspaceSlug);

  const [steps, storyboard] = await Promise.all([
    getActiveFlowSteps(workspace.id),
    getStoryboard(workspace.id),
  ]);
  return (
    <OnboardingClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initialSteps={steps}
      initialStoryboard={storyboard}
    />
  );
}
