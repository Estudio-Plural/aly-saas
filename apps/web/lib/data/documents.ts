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
  routing_hint: string | null;
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
    routing_hint: row.routing_hint,
  };
}

export async function listDocuments(workspaceId: string): Promise<DocumentRow[]> {
  const rows = await sql<DbDocument[]>`
    SELECT id, name, type, size, created_at, summary, keywords, theme_category, routing_hint
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
  routingHint: string | null;
}): Promise<DocumentRow> {
  const [row] = await sql<DbDocument[]>`
    INSERT INTO documents (workspace_id, name, type, size, storage_path, text_content, summary, keywords, theme_category, routing_hint)
    VALUES (${input.workspaceId}, ${input.name}, ${input.type}, ${input.size}, ${input.storagePath}, ${input.textContent}, ${input.summary}, ${input.keywords}::text[], ${input.themeCategory}, ${input.routingHint})
    RETURNING id, name, type, size, created_at, summary, keywords, theme_category, routing_hint
  `;
  return toDocument(row);
}

/** Actualiza el "cuándo consultarlo" de un documento (editable por el usuario). */
export async function updateDocumentRouting(
  workspaceId: string,
  id: string,
  routingHint: string | null
): Promise<DocumentRow | null> {
  const rows = await sql<DbDocument[]>`
    UPDATE documents
    SET routing_hint = ${routingHint}
    WHERE workspace_id = ${workspaceId} AND id = ${id}
    RETURNING id, name, type, size, created_at, summary, keywords, theme_category, routing_hint
  `;
  return rows.length ? toDocument(rows[0]) : null;
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
