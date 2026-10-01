import { ReactNode } from "react";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { AppHeader } from "@/components/app-header";
import { workspaceDePagina } from "@/lib/sesion";
import { getProgramProgress } from "@/lib/data/design";
import { listWorkspaces } from "@/lib/data/workspaces";

export const dynamic = "force-dynamic";

const PORTAL_URL = process.env.PORTAL_URL ?? "https://suite.estudio-plural.co/app";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const { acceso, workspace } = await workspaceDePagina(workspaceSlug);
  // «Todos tus asistentes» solo si hay a dónde volver (la lista ya viene filtrada por acceso).
  const [progress, visibles] = await Promise.all([
    getProgramProgress(workspace),
    listWorkspaces(acceso),
  ]);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header: «Pl&ral IA Conversational / {asistente} para {programa}» */}
      <AppHeader
        email={acceso.email}
        esPlural={acceso.esPlural}
        portalUrl={PORTAL_URL}
        assistantName={workspace.assistant_name}
        programName={workspace.name}
        orgName={acceso.esPlural ? workspace.org_name : undefined}
        count={visibles.length}
      />

      {/* Layout con sidebar */}
      <div className="container mx-auto px-4 py-4 md:py-8">
        <div className="flex flex-col gap-4 md:flex-row md:gap-8">
          <WorkspaceSidebar workspace={workspace.slug} progress={progress} />
          {/* Main content */}
          <main className="min-w-0 flex-1 max-w-4xl">{children}</main>
        </div>
      </div>
    </div>
  );
}
