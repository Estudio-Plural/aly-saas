import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceBySlug, setWhatsappConnection } from "@/lib/data/workspaces";

type Params = { params: Promise<{ slug: string }> };

const connectSchema = z.object({
  phoneNumber: z.string().trim().min(5).max(30),
});

/**
 * Conexión de WhatsApp. La integración real con Kapso es post-funding;
 * por ahora se persiste el estado de conexión en la DB (sobrevive reloads).
 */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Número inválido" }, { status: 400 });
  }

  const workspace = await setWhatsappConnection(slug, {
    status: "connected",
    phoneNumber: parsed.data.phoneNumber,
  });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ workspace });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await setWhatsappConnection(slug, { status: "pending" });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ workspace });
}

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
  return NextResponse.json({
    status: workspace.kapso_connection_status,
    phoneNumber: workspace.whatsapp_phone_number,
  });
}
