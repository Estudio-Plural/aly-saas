import { NextResponse } from "next/server";
import { resolverWorkspace } from "@/lib/api-acceso";
import { setConversationReviewed } from "@/lib/data/conversations";

type Params = { params: Promise<{ slug: string; id: string }> };

// Revisión de alertas: el equipo marca que ya vio la alerta de una
// conversación (reviewed_at/reviewed_by). No dispara ninguna acción sobre el
// usuario. El revisor es el correo de quien entra (lib/auth.ts).

async function setReviewed(request: Request, { params }: Params, reviewed: boolean) {
  const { slug, id } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { acceso, workspace } = r;

  const result = await setConversationReviewed(
    workspace.id,
    decodeURIComponent(id),
    reviewed ? acceso.email : null
  );
  if (!result) {
    return NextResponse.json(
      { error: "La conversación todavía no tiene análisis" },
      { status: 404 }
    );
  }
  return NextResponse.json(result);
}

/** Marca la alerta como revisada. */
export async function POST(request: Request, context: Params) {
  return setReviewed(request, context, true);
}

/** Vuelve la alerta a pendiente. */
export async function DELETE(request: Request, context: Params) {
  return setReviewed(request, context, false);
}
