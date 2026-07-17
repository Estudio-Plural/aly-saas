// Retrieval — Fase 0: PUENTE al texto plano de `documents` (sin pgvector).
// Trae el texto de los documentos del workspace y arma el bloque de contexto.
// Con ruteo de documentos (port del librarian doc-routing del legacy): si el
// doc-router eligió un subconjunto, solo esos docs entran al contexto.
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

/** Entrada del catálogo que ve el doc-router: nombre + cuándo consultarlo. */
export interface DocCatalogEntry {
  id: string;
  name: string;
  /** routing_hint editable por el usuario; si falta, el summary del enrichment */
  hint: string;
}

/** Catálogo liviano (sin text_content) para que el doc-router decida. */
export async function listDocCatalog(workspaceId: string): Promise<DocCatalogEntry[]> {
  try {
    const rows = await sql<
      { id: string; name: string; routing_hint: string | null; summary: string | null }[]
    >`
      SELECT id, name, routing_hint, summary
      FROM documents
      WHERE workspace_id = ${workspaceId}
        AND text_content IS NOT NULL
        AND length(trim(text_content)) > 0
      ORDER BY created_at ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      hint: r.routing_hint?.trim() || r.summary?.trim() || "",
    }));
  } catch (error) {
    console.error("❌ Error in listDocCatalog:", error);
    return [];
  }
}

/**
 * Contexto desde los documentos del workspace. `docIds` no-vacío → solo esos
 * documentos (decisión del doc-router); null/[] → todos (failsafe).
 */
export async function retrieveContext(
  workspaceId: string,
  docIds: string[] | null = null,
): Promise<RetrievalResult> {
  try {
    const filtered = docIds !== null && docIds.length > 0;
    const rows = filtered
      ? await sql<{ name: string; text_content: string }[]>`
          SELECT name, text_content
          FROM documents
          WHERE workspace_id = ${workspaceId}
            AND id = ANY(${docIds!}::uuid[])
            AND text_content IS NOT NULL
            AND length(trim(text_content)) > 0
          ORDER BY created_at ASC
        `
      : await sql<{ name: string; text_content: string }[]>`
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
      `🔍 Retrieval (documents bridge${filtered ? ", routed" : ""}): ${chunks.length} docs, ${context.length} chars`,
    );
    return { context, chunks };
  } catch (error) {
    console.error("❌ Error in retrieveContext:", error);
    return { context: "", chunks: [] };
  }
}
