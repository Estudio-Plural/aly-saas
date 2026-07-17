import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import {
  getDocumentWithPath,
  deleteDocument,
  updateDocumentRouting,
} from "@/lib/data/documents";
import { readUpload, removeUpload } from "@/lib/uploads";
import { deleteDocumentEmbeddings } from "@/lib/embeddings";

type Params = { params: Promise<{ slug: string; id: string }> };

const patchSchema = z.object({
  routing_hint: z.string().trim().max(300),
});

/** Edita el "cuándo consultarlo" del documento (string vacío lo borra). */
export async function PATCH(request: Request, { params }: Params) {
  const { slug, id } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const doc = await updateDocumentRouting(
    workspace.id,
    id,
    parsed.data.routing_hint || null
  );
  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ document: doc });
}

/** Descarga el archivo original. */
export async function GET(_request: Request, { params }: Params) {
  const { slug, id } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const doc = await getDocumentWithPath(workspace.id, id);
  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  try {
    const data = await readUpload(doc.storage_path);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": doc.type,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "El archivo no está disponible en disco" },
      { status: 410 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { slug, id } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const deleted = await deleteDocument(workspace.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }
  await removeUpload(deleted.storage_path);
  await deleteDocumentEmbeddings(workspace.id, id);
  return NextResponse.json({ ok: true });
}
