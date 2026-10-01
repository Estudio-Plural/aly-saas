import { workspaceDePagina } from "@/lib/sesion";
import { getDesign, getProgramProgress } from "@/lib/data/design";
import { nextAfterDesignStep } from "@/lib/design";
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

  const [design, progress] = await Promise.all([
    getDesign(workspace.id),
    getProgramProgress(workspace),
  ]);
  return (
    <WelcomeClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initial={design.welcome}
      next={nextAfterDesignStep("welcome", progress)}
    />
  );
}
