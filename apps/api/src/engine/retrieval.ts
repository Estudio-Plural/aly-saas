// Retrieval — Fase 2: búsqueda vectorial (pgvector) con failsafe al puente de
// texto plano de `documents`.
//
// Camino principal: la query normalizada se embebe (mismo modelo que el
// indexado en apps/web/lib/embeddings.ts) y se buscan los TOP_K chunks por
// similitud coseno en vector_aly.aly_general_knowledge, respetando el
// subconjunto que eligió el doc-router. Documentos con texto pero sin chunks
// indexados (upload con embeddings caídos) entran completos como failsafe.
//
// Fallbacks en cadena — el pipeline nunca se queda sin contexto por culpa del
// vector store: sin API key / OpenRouter caído / pgvector o tabla ausentes /
// cualquier error → puente de texto plano (comportamiento de Fase 0).

import { sql } from "../db";
import { embedQuery } from "./embeddings";

const MAX_CONTEXT_CHARS = 16000;
const TOP_K = 8;

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
 * Contexto para responder `query` desde los documentos del workspace.
 * `docIds` no-vacío → solo esos documentos (decisión del doc-router);
 * null/[] → todos (failsafe). Intenta búsqueda vectorial y cae al texto plano.
 */
export async function retrieveContext(
  workspaceId: string,
  docIds: string[] | null = null,
  query = "",
): Promise<RetrievalResult> {
  if (query.trim()) {
    const vector = await tryVectorRetrieve(workspaceId, docIds, query);
    if (vector) return vector;
  }
  return retrieveFullText(workspaceId, docIds);
}

/** Búsqueda vectorial. null → que el caller caiga al puente de texto plano. */
async function tryVectorRetrieve(
  workspaceId: string,
  docIds: string[] | null,
  query: string,
): Promise<RetrievalResult | null> {
  const embedding = await embedQuery(query);
  if (!embedding) return null;

  const filtered = docIds !== null && docIds.length > 0;
  const vec = JSON.stringify(embedding);

  try {
    const hits = filtered
      ? await sql<{ document_name: string; text: string; similarity: number }[]>`
          SELECT document_name, text, 1 - (embedding <=> ${vec}::vector) AS similarity
          FROM vector_aly.aly_general_knowledge
          WHERE workspace_id = ${workspaceId}
            AND document_id = ANY(${docIds!}::text[])
          ORDER BY embedding <=> ${vec}::vector
          LIMIT ${TOP_K}
        `
      : await sql<{ document_name: string; text: string; similarity: number }[]>`
          SELECT document_name, text, 1 - (embedding <=> ${vec}::vector) AS similarity
          FROM vector_aly.aly_general_knowledge
          WHERE workspace_id = ${workspaceId}
          ORDER BY embedding <=> ${vec}::vector
          LIMIT ${TOP_K}
        `;

    // Failsafe: documentos con texto pero sin chunks indexados (p.ej. el
    // upload corrió con OpenRouter caído) entran completos al contexto.
    const missing = filtered
      ? await sql<{ name: string; text_content: string }[]>`
          SELECT name, text_content
          FROM documents
          WHERE workspace_id = ${workspaceId}
            AND id = ANY(${docIds!}::uuid[])
            AND text_content IS NOT NULL
            AND length(trim(text_content)) > 0
            AND id::text NOT IN (
              SELECT DISTINCT document_id FROM vector_aly.aly_general_knowledge
              WHERE workspace_id = ${workspaceId}
            )
          ORDER BY created_at ASC
        `
      : await sql<{ name: string; text_content: string }[]>`
          SELECT name, text_content
          FROM documents
          WHERE workspace_id = ${workspaceId}
            AND text_content IS NOT NULL
            AND length(trim(text_content)) > 0
            AND id::text NOT IN (
              SELECT DISTINCT document_id FROM vector_aly.aly_general_knowledge
              WHERE workspace_id = ${workspaceId}
            )
          ORDER BY created_at ASC
        `;

    const chunks: ChunkSource[] = [
      ...hits.map((h) => ({ documentName: h.document_name, text: h.text })),
      ...missing.map((m) => ({ documentName: m.name, text: m.text_content })),
    ];
    if (!chunks.length) return { context: "", chunks: [] };

    let context = chunks
      .map((c) => `[${c.documentName}]\n${c.text}`)
      .join("\n\n---\n\n");
    if (context.length > MAX_CONTEXT_CHARS) {
      context = context.slice(0, MAX_CONTEXT_CHARS) + "\n\n[... contexto truncado ...]";
    }

    const sims = hits.map((h) => Number(h.similarity).toFixed(2)).join(", ");
    console.log(
      `🔍 Retrieval (vector${filtered ? ", routed" : ""}): ${hits.length} chunks [${sims}]` +
        (missing.length ? ` + ${missing.length} docs sin indexar` : "") +
        `, ${context.length} chars`,
    );
    return { context, chunks };
  } catch (error) {
    console.error("❌ Vector retrieval falló (fallback a texto plano):", error);
    return null;
  }
}

/** Puente de texto plano (Fase 0): el texto completo de los documentos. */
async function retrieveFullText(
  workspaceId: string,
  docIds: string[] | null,
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
