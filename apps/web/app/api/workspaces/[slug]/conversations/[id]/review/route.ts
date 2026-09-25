import { NextResponse } from "next/server";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { setConversationReviewed } from "@/lib/data/conversations";
import { DEMO_USER_ID } from "@/lib/constants";

type Params = { params: Promise<{ slug: string; id: string }> };

// Revisión de alertas: el equipo marca que ya vio la alerta de una
// conversación (reviewed_at/reviewed_by). No dispara ninguna acción sobre el
// usuario. Hasta que haya auth real, el revisor es el usuario demo.

async function setReviewed({ params }: Params, reviewed: boolean) {
  const { slug, id } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const result = await setConversationReviewed(
    workspace.id,
    decodeURIComponent(id),
    reviewed ? DEMO_USER_ID : null
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
export async function POST(_request: Request, context: Params) {
  return setReviewed(context, true);
}

/** Vuelve la alerta a pendiente. */
export async function DELETE(_request: Request, context: Params) {
  return setReviewed(context, false);
}
