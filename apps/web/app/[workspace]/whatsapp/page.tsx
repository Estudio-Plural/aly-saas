import { workspaceDePagina } from "@/lib/sesion";
import { getCifrasCanal, getWebhookVerificadoAt, getWhatsappConnection } from "@/lib/data/whatsapp";
import { getEngineWhatsappEstado } from "@/lib/engine";
import { calcularChecklist } from "@/lib/whatsapp-checklist";
import { WhatsAppClient } from "./whatsapp-client";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const { vista } = await searchParams;
  const { acceso, workspace } = await workspaceDePagina(workspaceSlug);

  // Estado REAL: la conexión y la prueba de vida salen de la base; el token y
  // el app secret, de lo que el engine reporta de su propio entorno.
  const [conexion, entorno, verificadoAt, cifras] = await Promise.all([
    getWhatsappConnection(workspace.id),
    getEngineWhatsappEstado(workspace.id),
    getWebhookVerificadoAt(),
    getCifrasCanal(workspace.id),
  ]);
  const checklist = calcularChecklist(conexion, entorno, verificadoAt);

  const plural = acceso.esPlural;
  // Plural puede ver la pantalla tal como la ve la organización.
  const comoCliente = !plural || vista === "cliente";

  return (
    <WhatsAppClient
      workspaceSlug={workspace.slug}
      workspaceName={workspace.name}
      rol={comoCliente ? "cliente" : "plural"}
      puedeCambiarVista={plural}
      conexion={comoCliente ? null : conexion}
      displayNumber={conexion?.displayNumber ?? null}
      // Al cliente le llega solo el estado: ni pasos técnicos ni nombres de variables.
      checklist={comoCliente ? { ...checklist, pasos: [] } : checklist}
      engineResponde={entorno !== null}
      cifras={cifras}
    />
  );
}
