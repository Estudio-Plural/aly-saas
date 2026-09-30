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

/** Texto plano para inyectar al chat (TXT/MD/CSV y PDF, capado). */
export async function extractTextContent(
  fileName: string,
  mimeType: string,
  data: Buffer,
  maxChars = MAX_TEXT_CHARS
): Promise<string | null> {
  return (await extractTextWithReport(fileName, mimeType, data, maxChars)).text;
}

/** Tope de texto que se guarda por documento. */
export const MAX_TEXT_CHARS = 20000;

/**
 * Igual que extractTextContent, pero informa cuánto texto había y cuánto se
 * omitió por el tope: la revisión al subir en «Material» lo muestra.
 */
export async function extractTextWithReport(
  fileName: string,
  mimeType: string,
  data: Buffer,
  maxChars = MAX_TEXT_CHARS
): Promise<{ text: string | null; totalChars: number; omittedChars: number }> {
  const full = await extractFullText(fileName, mimeType, data);
  if (!full) return { text: null, totalChars: 0, omittedChars: 0 };
  return {
    text: full.slice(0, maxChars),
    totalChars: full.length,
    omittedChars: Math.max(0, full.length - maxChars),
  };
}

async function extractFullText(
  fileName: string,
  mimeType: string,
  data: Buffer
): Promise<string | null> {
  const ext = path.extname(fileName).toLowerCase();

  const isText =
    mimeType.startsWith("text/") || [".txt", ".md", ".markdown", ".csv"].includes(ext);
  if (isText) {
    const text = data.toString("utf8");
    return text.trim() ? text : null;
  }

  if (ext === ".pdf" || mimeType === "application/pdf") {
    try {
      const { extractText } = await import("unpdf");
      const { text } = await extractText(new Uint8Array(data), { mergePages: true });
      const cleaned = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      return cleaned || null;
    } catch (error) {
      // PDF escaneado/corrupto: se guarda igual, solo sin texto para el chat
      console.error(`[uploads] No se pudo extraer texto de ${fileName}:`, error);
      return null;
    }
  }

  return null;
}
