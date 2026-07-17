// Backfill de embeddings para documentos ya subidos (los nuevos se indexan
// solos al subir). Re-indexa TODOS los documentos con texto — es idempotente
// (borra e inserta los chunks de cada doc).
//
//   cd apps/web && bun scripts/backfill-embeddings.ts
//
// (bun carga .env.local solo y resuelve los paths de tsconfig)
import { sql } from "@/lib/db";
import { indexDocument } from "@/lib/embeddings";

const docs = await sql<
  { id: string; workspace_id: string; name: string; text_content: string; theme_category: string | null }[]
>`
  SELECT id, workspace_id, name, text_content, theme_category
  FROM documents
  WHERE text_content IS NOT NULL AND length(trim(text_content)) > 0
  ORDER BY created_at ASC
`;

console.log(`Documentos con texto: ${docs.length}`);
let ok = 0;
for (const doc of docs) {
  const chunks = await indexDocument({
    workspaceId: doc.workspace_id,
    documentId: doc.id,
    documentName: doc.name,
    text: doc.text_content,
    themeCategory: doc.theme_category,
  });
  if (chunks !== null) ok++;
}
console.log(`Listo: ${ok}/${docs.length} documentos indexados`);
await sql.end();
