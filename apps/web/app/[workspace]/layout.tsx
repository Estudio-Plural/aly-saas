import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { DEMO_USER_EMAIL } from "@/lib/constants";

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
      <header className="border-b bg-white">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700" />
              <span className="text-xl font-semibold text-neutral-900">Aly SaaS</span>
            </Link>
            <span className="text-neutral-400">/</span>
            <span className="text-neutral-700 font-medium">
              {workspace.name}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-neutral-700">{DEMO_USER_EMAIL}</div>
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
