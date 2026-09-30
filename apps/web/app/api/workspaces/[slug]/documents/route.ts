import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { resolverWorkspace } from "@/lib/api-acceso";
import { listDocuments, createDocument } from "@/lib/data/documents";
import { saveUpload, extractTextWithReport } from "@/lib/uploads";
import type { UploadReview } from "@/lib/workspaces";
import { enrichDocument } from "@/lib/enrichment";
import { indexDocument } from "@/lib/embeddings";

type Params = { params: Promise<{ slug: string }> };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (lo que promete la UI)
// Solo formatos de los que se puede leer el texto: un archivo que el asistente
// no puede leer no le sirve a nadie.
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".markdown", ".csv"];

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;
  const documents = await listDocuments(workspace.id);
  return NextResponse.json({ documents });
}

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;

  const formData = await request.formData().catch(() => null);
  const files = formData?.getAll("files").filter((f): f is File => f instanceof File) ?? [];
  if (!files.length) {
    return NextResponse.json({ error: "No se recibieron archivos" }, { status: 400 });
  }

  const created = [];
  const rejected: string[] = [];
  // Revisión al subir: qué se pudo leer y qué quedó afuera.
  const reviews: UploadReview[] = [];

  for (const file of files) {
    const ext = file.name.includes(".")
      ? `.${file.name.split(".").pop()!.toLowerCase()}`
      : "";
    if (ext === ".doc" || ext === ".docx") {
      rejected.push(`${file.name} (Word todavía no se puede leer: guárdalo como PDF)`);
      continue;
    }
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      rejected.push(`${file.name} (usa PDF, TXT o MD)`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      rejected.push(`${file.name} (supera 10 MB)`);
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const docId = randomUUID();
    const storagePath = await saveUpload(workspace.id, docId, file.name, buffer);
    const extraction = await extractTextWithReport(file.name, file.type, buffer);
    const textContent = extraction.text;

    // Metadatos automáticos (el usuario no-code no completa nada a mano)
    const metadata = textContent
      ? await enrichDocument(workspace.id, file.name, textContent)
      : null;

    const doc = await createDocument({
      workspaceId: workspace.id,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      storagePath,
      textContent,
      summary: metadata?.summary ?? null,
      keywords: metadata?.keywords ?? [],
      themeCategory: metadata?.theme ?? null,
      routingHint: metadata?.routing ?? null,
    });

    // Embeddings para el RAG del engine (fail-silent: sin pgvector o sin
    // OpenRouter el retrieval cae al texto plano)
    let fragments: number | null = null;
    if (textContent) {
      fragments = await indexDocument({
        workspaceId: workspace.id,
        documentId: doc.id,
        documentName: file.name,
        text: textContent,
        themeCategory: metadata?.theme ?? null,
      });
    }
    created.push(doc);
    reviews.push({
      documentId: doc.id,
      name: file.name,
      readable: Boolean(textContent),
      totalChars: extraction.totalChars,
      omittedChars: extraction.omittedChars,
      fragments,
      headings: textContent ? (textContent.match(/^#{1,6}\s+\S/gm) ?? []).length : 0,
    });
  }

  return NextResponse.json(
    { documents: created, rejected, reviews },
    { status: created.length ? 201 : 400 }
  );
}
