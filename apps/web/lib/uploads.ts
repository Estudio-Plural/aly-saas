// Almacenamiento local de archivos subidos (apps/web/.uploads, gitignoreado).
// En producción esto se reemplaza por Supabase Storage manteniendo storage_path.
import path from "path";
import fs from "fs/promises";

const UPLOADS_ROOT = path.join(process.cwd(), ".uploads");

function safeFileName(name: string): string {
  return name.replace(/[/\\]/g, "_").slice(0, 200);
}

function resolveStoragePath(storagePath: string): string {
  const full = path.resolve(UPLOADS_ROOT, storagePath);
  if (!full.startsWith(path.resolve(UPLOADS_ROOT) + path.sep)) {
    throw new Error("storage_path inválido");
  }
  return full;
}

/** Guarda el archivo y devuelve el storage_path relativo. */
export async function saveUpload(
  workspaceId: string,
  docId: string,
  fileName: string,
  data: Buffer
): Promise<string> {
  const storagePath = path.join(workspaceId, `${docId}__${safeFileName(fileName)}`);
  const full = resolveStoragePath(storagePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return storagePath;
}

export async function readUpload(storagePath: string): Promise<Buffer> {
  return fs.readFile(resolveStoragePath(storagePath));
}

export async function removeUpload(storagePath: string): Promise<void> {
  await fs.rm(resolveStoragePath(storagePath), { force: true });
}

export async function removeWorkspaceUploads(workspaceId: string): Promise<void> {
  await fs.rm(path.join(UPLOADS_ROOT, workspaceId), { recursive: true, force: true });
}

/** Texto plano para inyectar al chat (solo formatos de texto, capado). */
export function extractTextContent(
  fileName: string,
  mimeType: string,
  data: Buffer,
  maxChars = 20000
): string | null {
  const ext = path.extname(fileName).toLowerCase();
  const isText =
    mimeType.startsWith("text/") || [".txt", ".md", ".markdown", ".csv"].includes(ext);
  if (!isText) return null;
  return data.toString("utf8").slice(0, maxChars);
}
