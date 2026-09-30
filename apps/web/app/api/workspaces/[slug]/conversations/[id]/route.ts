import { NextResponse } from "next/server";
import { resolverWorkspace } from "@/lib/api-acceso";
import { puedeVerTranscripciones } from "@/lib/auth";
import { getConversationMessages } from "@/lib/data/chat";
import { TRANSCRIPCIONES_SOLO_PLURAL } from "@/lib/workspaces";

type Params = { params: Promise<{ slug: string; id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug, id } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;

  // El texto de los mensajes es de las personas: solo lo ve el equipo de Plural.
  if (!puedeVerTranscripciones(r.acceso)) {
    return NextResponse.json({ error: TRANSCRIPCIONES_SOLO_PLURAL }, { status: 403 });
  }

  const messages = await getConversationMessages(workspace.id, decodeURIComponent(id));
  return NextResponse.json({ messages });
}
