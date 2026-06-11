import { listWorkspaces } from "@/lib/data/workspaces";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const workspaces = await listWorkspaces();
  return <DashboardClient initialWorkspaces={workspaces} />;
}
