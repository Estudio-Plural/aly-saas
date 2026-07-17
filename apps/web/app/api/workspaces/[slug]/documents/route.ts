import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { listDocuments, createDocument } from "@/lib/data/documents";
import { saveUpload, extractTextContent } from "@/lib/uploads";
import { enrichDocument } from "@/lib/enrichment";
import { indexDocument } from "@/lib/embeddings";

type Params = { params: Promise<{ slug: string }> };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (lo que promete la UI)
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".markdown", ".csv", ".doc", ".docx"];

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
  const documents = await listDocuments(workspace.id);
  return NextResponse.json({ documents });
}

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const files = formData?.getAll("files").filter((f): f is File => f instanceof File) ?? [];
  if (!files.length) {
    return NextResponse.json({ error: "No se recibieron archivos" }, { status: 400 });
  }

  const created = [];
  const rejected: string[] = [];

  for (const file of files) {
    const ext = file.name.includes(".")
      ? `.${file.name.split(".").pop()!.toLowerCase()}`
      : "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      rejected.push(`${file.name} (formato no soportado)`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      rejected.push(`${file.name} (supera 10 MB)`);
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const docId = randomUUID();
    const storagePath = await saveUpload(workspace.id, docId, file.name, buffer);
    const textContent = await extractTextContent(file.name, file.type, buffer);

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
    if (textContent) {
      await indexDocument({
        workspaceId: workspace.id,
        documentId: doc.id,
        documentName: file.name,
        text: textContent,
        themeCategory: metadata?.theme ?? null,
      });
    }
    created.push(doc);
  }

  return NextResponse.json({ documents: created, rejected }, { status: created.length ? 201 : 400 });
}
