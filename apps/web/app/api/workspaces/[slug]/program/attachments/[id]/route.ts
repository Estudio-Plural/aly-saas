import { NextResponse } from "next/server";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import {
  getStoryboardAttachment,
  removeStoryboardAttachment,
} from "@/lib/data/program";
import { readUpload, removeUpload } from "@/lib/uploads";

type Params = { params: Promise<{ slug: string; id: string }> };

/** Sirve el material inline (para <img>/<video>/<audio> y visor de PDF del chat). */
export async function GET(_request: Request, { params }: Params) {
  const { slug, id } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const attachment = await getStoryboardAttachment(workspace.id, id);
  if (!attachment) {
    return NextResponse.json({ error: "Material no encontrado" }, { status: 404 });
  }

  try {
    const data = await readUpload(attachment.storage_path);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": attachment.type,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        "Cache-Control": "private, max-age=3600",
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

  const removed = await removeStoryboardAttachment(workspace.id, id);
  if (!removed) {
    return NextResponse.json({ error: "Material no encontrado" }, { status: 404 });
  }
  await removeUpload(removed.storage_path);
  return NextResponse.json({ ok: true });
}
