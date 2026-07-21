import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { addStoryboardAttachment } from "@/lib/data/program";
import { saveUpload } from "@/lib/uploads";
import { STORYBOARD_MOMENT_LABELS, type StoryboardMomentKey } from "@/lib/workspaces";

type Params = { params: Promise<{ slug: string }> };

// Tope alineado a lo que WhatsApp acepta para media (16 MB)
const MAX_FILE_SIZE = 16 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".pdf", ".doc", ".docx",
  ".mp4", ".webm", ".mov",
  ".mp3", ".m4a", ".ogg", ".wav",
];

/** Sube un material a un momento del storyboard (queda disponible para el asistente). */
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const moment = formData?.get("moment");
  const file = formData?.get("file");

  if (
    typeof moment !== "string" ||
    !(moment in STORYBOARD_MOMENT_LABELS) ||
    !(file instanceof File)
  ) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const ext = file.name.includes(".")
    ? `.${file.name.split(".").pop()!.toLowerCase()}`
    : "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Formato no soportado (${ext || "sin extensión"})` },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "El archivo supera 16 MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  const storagePath = await saveUpload(workspace.id, id, file.name, buffer);

  const attachment = {
    id,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    storage_path: storagePath,
  };
  await addStoryboardAttachment(
    workspace.id,
    moment as StoryboardMomentKey,
    attachment
  );

  return NextResponse.json({ attachment }, { status: 201 });
}
