import { NextResponse } from "next/server";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { getDocumentWithPath, deleteDocument } from "@/lib/data/documents";
import { readUpload, removeUpload } from "@/lib/uploads";

type Params = { params: Promise<{ slug: string; id: string }> };

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
  return NextResponse.json({ ok: true });
}
