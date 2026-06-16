import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";

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

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="container mx-auto flex h-14 items-center px-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-neutral-900 flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="text-[15px] font-semibold text-neutral-900">
                Plural{" "}
                <span className="text-neutral-600 font-normal">
                  Conversational System
                </span>
              </span>
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="text-sm text-neutral-700 font-medium">
              {workspace.name}
            </span>
          </div>
        </div>
      </header>

      {/* Layout con sidebar */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          <WorkspaceSidebar workspace={workspaceSlug} />
          {/* Main content */}
          <main className="flex-1 max-w-4xl">{children}</main>
        </div>
      </div>
    </div>
  );
}
