-- 008 — Embeddings con text-embedding-3-large (3072 dims).
-- Convierte bases existentes cuya tabla vectorial se creó con vector(1536):
-- borra los chunks viejos (embeddings de otro modelo, incompatibles — re-indexar
-- con `cd apps/web && bun scripts/backfill-embeddings.ts`) y altera la columna.
-- El índice ivfflat se elimina: ivfflat/hnsw no soportan >2000 dims; a este
-- volumen el scan exacto es suficiente (si crece, evaluar HNSW sobre halfvec).
-- Idempotente; no-op si pgvector o la tabla no existen.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE NOTICE 'Saltando 008 (pgvector ausente)';
    RETURN;
  END IF;
  IF to_regclass('vector_aly.aly_general_knowledge') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'vector_aly.aly_general_knowledge'::regclass
      AND attname = 'embedding'
      AND format_type(atttypid, atttypmod) = 'vector(3072)'
  ) THEN
    RETURN; -- ya migrada
  END IF;

  DROP INDEX IF EXISTS vector_aly.idx_aly_general_knowledge_embedding;
  DELETE FROM vector_aly.aly_general_knowledge;
  ALTER TABLE vector_aly.aly_general_knowledge
    ALTER COLUMN embedding TYPE vector(3072);
END $$;
