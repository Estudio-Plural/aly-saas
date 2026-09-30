import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getProgramProgress } from "@/lib/data/design";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");
  const progress = await getProgramProgress(workspace);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header: «Plural / {programa}» */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="container mx-auto flex h-14 items-center px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="flex flex-shrink-0 items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-neutral-900 flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="text-[15px] font-semibold text-neutral-900">Plural</span>
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="truncate text-sm font-medium text-neutral-700">
              {workspace.name}
            </span>
          </div>
        </div>
      </header>

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
