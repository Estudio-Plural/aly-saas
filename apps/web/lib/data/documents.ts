// Queries de documentos (knowledge base) — solo servidor.
import { sql } from "@/lib/db";
import type { DocumentRow } from "@/lib/workspaces";

type DbDocument = {
  id: string;
  name: string;
  type: string;
  size: string | number; // BIGINT llega como string
  created_at: Date;
  summary: string | null;
  keywords: string[] | null;
  theme_category: string | null;
};

function toDocument(row: DbDocument): DocumentRow {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    size: Number(row.size),
    created_at: row.created_at.toISOString(),
    summary: row.summary,
    keywords: row.keywords ?? [],
    theme_category: row.theme_category,
  };
}

export async function listDocuments(workspaceId: string): Promise<DocumentRow[]> {
  const rows = await sql<DbDocument[]>`
    SELECT id, name, type, size, created_at, summary, keywords, theme_category
    FROM documents
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
  `;
  return rows.map(toDocument);
}

export async function createDocument(input: {
  workspaceId: string;
  name: string;
  type: string;
  size: number;
  storagePath: string;
  textContent: string | null;
  summary: string | null;
  keywords: string[];
  themeCategory: string | null;
}): Promise<DocumentRow> {
  const [row] = await sql<DbDocument[]>`
    INSERT INTO documents (workspace_id, name, type, size, storage_path, text_content, summary, keywords, theme_category)
    VALUES (${input.workspaceId}, ${input.name}, ${input.type}, ${input.size}, ${input.storagePath}, ${input.textContent}, ${input.summary}, ${input.keywords}::text[], ${input.themeCategory})
    RETURNING id, name, type, size, created_at, summary, keywords, theme_category
  `;
  return toDocument(row);
}

export async function getDocumentWithPath(
  workspaceId: string,
  id: string
): Promise<{ id: string; name: string; type: string; storage_path: string } | null> {
  const rows = await sql<{ id: string; name: string; type: string; storage_path: string }[]>`
    SELECT id, name, type, storage_path
    FROM documents
    WHERE workspace_id = ${workspaceId} AND id = ${id}
  `;
  return rows.length ? rows[0] : null;
}

/** Borra el documento y devuelve su storage_path para limpiar el archivo. */
export async function deleteDocument(
  workspaceId: string,
  id: string
): Promise<{ name: string; storage_path: string } | null> {
  const rows = await sql<{ name: string; storage_path: string }[]>`
    DELETE FROM documents
    WHERE workspace_id = ${workspaceId} AND id = ${id}
    RETURNING name, storage_path
  `;
  return rows.length ? rows[0] : null;
}

/** Texto de los documentos del workspace para inyectar al contexto del chat. */
export async function getKnowledgeText(
  workspaceId: string,
  maxChars = 12000
): Promise<{ name: string; text: string }[]> {
  const rows = await sql<{ name: string; text_content: string }[]>`
    SELECT name, text_content
    FROM documents
    WHERE workspace_id = ${workspaceId} AND text_content IS NOT NULL AND text_content <> ''
    ORDER BY created_at ASC
  `;
  const result: { name: string; text: string }[] = [];
  let used = 0;
  for (const row of rows) {
    if (used >= maxChars) break;
    const text = row.text_content.slice(0, maxChars - used);
    result.push({ name: row.name, text });
    used += text.length;
  }
  return result;
}
