import { workspaceDePagina } from "@/lib/sesion";
import { getEstimado, getUltimaCorrida, listCasos, usaRespuestasSimuladas } from "@/lib/data/casos";
import { CasosClient } from "./casos-client";

export const dynamic = "force-dynamic";

/** Probar → Casos difíciles (migración 014). */
export default async function CasosPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const { workspace } = await workspaceDePagina(workspaceSlug);

  const casos = await listCasos(workspace.id);
  const [ultimaCorrida, estimado] = await Promise.all([
    getUltimaCorrida(workspace.id),
    getEstimado(workspace.id, casos),
  ]);

  return (
    <CasosClient
      workspaceSlug={workspace.slug}
      assistantName={workspace.assistant_name}
      initialCasos={casos}
      initialCorrida={ultimaCorrida}
      initialEstimado={estimado}
      simuladas={usaRespuestasSimuladas()}
    />
  );
}
