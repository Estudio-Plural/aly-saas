import { redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { WhatsAppClient } from "./whatsapp-client";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  // La conexión directa (Kapso) todavía no existe: no hay bandera ni cliente
  // real que consultar. La pantalla muestra siempre el estado "en preparación"
  // y solo guarda el número de la organización como dato de contacto.
  return (
    <WhatsAppClient
      workspaceSlug={workspace.slug}
      initialPhoneNumber={workspace.whatsapp_phone_number}
    />
  );
}
