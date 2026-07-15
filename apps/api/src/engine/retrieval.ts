// Retrieval — Fase 0: PUENTE al texto plano de `documents` (sin pgvector).
// Trae el texto de los documentos del workspace y arma el bloque de contexto.
// En Fase 2 esto se reemplaza por búsqueda vectorial per-workspace (pgvector),
// manteniendo la MISMA interfaz {context, chunks} que consume el pipeline.

import { sql } from "../db";

const MAX_CONTEXT_CHARS = 16000;

export interface ChunkSource {
  documentName: string;
  text: string;
}

export interface RetrievalResult {
  context: string;
  chunks: ChunkSource[];
}

export async function retrieveContext(workspaceId: string): Promise<RetrievalResult> {
  try {
    const rows = await sql<{ name: string; text_content: string }[]>`
      SELECT name, text_content
      FROM documents
      WHERE workspace_id = ${workspaceId}
        AND text_content IS NOT NULL
        AND length(trim(text_content)) > 0
      ORDER BY created_at ASC
    `;

    const chunks: ChunkSource[] = rows.map((r) => ({
      documentName: r.name,
      text: r.text_content,
    }));

    let context = chunks
      .map((c) => `[${c.documentName}]\n${c.text}`)
      .join("\n\n---\n\n");

    if (context.length > MAX_CONTEXT_CHARS) {
      context = context.slice(0, MAX_CONTEXT_CHARS) + "\n\n[... contexto truncado ...]";
    }

    console.log(
      `🔍 Retrieval (documents bridge): ${chunks.length} docs, ${context.length} chars`,
    );
    return { context, chunks };
  } catch (error) {
    console.error("❌ Error in retrieveContext:", error);
    return { context: "", chunks: [] };
  }
}
