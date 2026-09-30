import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getAlertProtocol, getCifras, getEstadoReporte } from "@/lib/data/operar";
import { parsePeriodo } from "@/lib/operar";
import { OperarClient } from "./operar-client";

export const dynamic = "force-dynamic";

export default async function OperarPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ periodo?: string | string[] }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  const periodo = parsePeriodo((await searchParams).periodo);
  const [{ hayReales, cifras }, protocolo, reporte] = await Promise.all([
    getCifras(workspace.id, periodo),
    getAlertProtocol(workspace.id),
    getEstadoReporte(workspace.id),
  ]);

  return (
    <OperarClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      periodo={periodo}
      hayReales={hayReales}
      cifras={cifras}
      protocoloActivo={protocolo?.active === true}
      reporte={reporte}
    />
  );
}
