import { NextResponse } from "next/server";
import { z } from "zod";
import { saveWhatsappContactNumber, setWhatsappConnection } from "@/lib/data/workspaces";
import { noEncontrado, resolverWorkspace } from "@/lib/api-acceso";

type Params = { params: Promise<{ slug: string }> };

const connectSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .min(5)
    .max(30)
    .regex(/^\+?[0-9\s().-]+$/),
});

/**
 * La conexión directa con WhatsApp (Kapso) todavía no existe. El POST solo
 * guarda el número de la organización como contacto para avisarle cuando esté
 * lista; NO marca la conexión como activa.
 */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const body = await request.json().catch(() => null);
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Número inválido" }, { status: 400 });
  }

  const workspace = await saveWhatsappContactNumber(slug, parsed.data.phoneNumber, r.acceso);
  if (!workspace) return noEncontrado();
  return NextResponse.json({ workspace });
}

export async function DELETE(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const workspace = await setWhatsappConnection(slug, { status: "pending" }, r.acceso);
  if (!workspace) return noEncontrado();
  return NextResponse.json({ workspace });
}

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;
  return NextResponse.json({
    status: workspace.kapso_connection_status,
    phoneNumber: workspace.whatsapp_phone_number,
  });
}
