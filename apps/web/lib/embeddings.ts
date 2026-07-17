// Embeddings de documentos (RAG real con pgvector) — solo servidor.
// Al subir un documento se trocea (chunking) y cada chunk se embebe vía
// OpenRouter y se guarda en vector_aly.aly_general_knowledge. La búsqueda
// vectorial la hace el engine (apps/api/src/engine/retrieval.ts) al responder.
//
// Fail-silent total (misma filosofía que lib/enrichment.ts): si falta la API
// key, no está pgvector/la tabla, o OpenRouter falla, el upload sigue igual —
// el retrieval del engine cae al puente de texto plano.
import { sql } from "@/lib/db";

// 3072 dims = vector(3072) en la tabla. Si se cambia el modelo, la dimensión
// debe seguir siendo 3072 (se valida antes de insertar).
const EMBEDDING_MODEL =
  process.env.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-large";
const EMBEDDING_DIMS = 3072;
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;
const EMBED_BATCH = 64;

/** Trocea el texto por párrafos hasta ~CHUNK_SIZE chars; los párrafos muy
 *  largos (p.ej. PDFs sin saltos) se cortan duro con solapamiento. */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of clean.split(/\n{2,}/)) {
    if (paragraph.length > CHUNK_SIZE) {
      flush();
      const step = CHUNK_SIZE - CHUNK_OVERLAP;
      for (let i = 0; i < paragraph.length; i += step) {
        chunks.push(paragraph.slice(i, i + CHUNK_SIZE).trim());
        if (i + CHUNK_SIZE >= paragraph.length) break;
      }
      continue;
    }
    if (current.length + paragraph.length + 2 > CHUNK_SIZE) flush();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  flush();
  return chunks.filter(Boolean);
}

async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      data?: { index: number; embedding: number[] }[];
    };
    const rows = data.data ?? [];
    if (rows.length !== batch.length) {
      throw new Error(`OpenRouter devolvió ${rows.length} embeddings para ${batch.length} chunks`);
    }
    rows.sort((a, b) => a.index - b.index);
    for (const row of rows) {
      if (row.embedding.length !== EMBEDDING_DIMS) {
        throw new Error(
          `Embedding de ${row.embedding.length} dims (la tabla espera ${EMBEDDING_DIMS}) — revisar OPENROUTER_EMBEDDING_MODEL`
        );
      }
      all.push(row.embedding);
    }
  }
  return all;
}

/**
 * Indexa (o re-indexa) un documento en el vector store: borra los chunks
 * anteriores e inserta los nuevos con su embedding. Devuelve la cantidad de
 * chunks indexados, o null si no se pudo (sin key / sin pgvector / error).
 */
export async function indexDocument(input: {
  workspaceId: string;
  documentId: string;
  documentName: string;
  text: string;
  themeCategory?: string | null;
}): Promise<number | null> {
  const chunks = chunkText(input.text);
  if (!chunks.length) return null;

  try {
    const embeddings = await embedTexts(chunks);
    if (!embeddings) return null;

    await sql.begin(async (tx) => {
      await tx`
        DELETE FROM vector_aly.aly_general_knowledge
        WHERE workspace_id = ${input.workspaceId} AND document_id = ${input.documentId}
      `;
      for (let i = 0; i < chunks.length; i++) {
        await tx`
          INSERT INTO vector_aly.aly_general_knowledge
            (workspace_id, document_id, document_name, chunk_index, text, embedding, theme_category)
          VALUES
            (${input.workspaceId}, ${input.documentId}, ${input.documentName},
             ${i}, ${chunks[i]}, ${JSON.stringify(embeddings[i])}::vector,
             ${input.themeCategory ?? null})
        `;
      }
    });
    console.log(`[embeddings] "${input.documentName}": ${chunks.length} chunks indexados`);
    return chunks.length;
  } catch (error) {
    console.error(`[embeddings] Falló el indexado de "${input.documentName}":`, error);
    return null;
  }
}

/** Limpia los chunks de un documento borrado. Fail-silent. */
export async function deleteDocumentEmbeddings(
  workspaceId: string,
  documentId: string
): Promise<void> {
  try {
    await sql`
      DELETE FROM vector_aly.aly_general_knowledge
      WHERE workspace_id = ${workspaceId} AND document_id = ${documentId}
    `;
  } catch (error) {
    console.error("[embeddings] Falló la limpieza de chunks:", error);
  }
}
