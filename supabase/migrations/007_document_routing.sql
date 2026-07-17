-- 007 — Ruteo de documentos (port del librarian doc-routing de Aly-legacy).
-- Cada documento lleva una descripción en lenguaje natural de CUÁNDO el
-- asistente debe consultarlo. Se genera automáticamente al subir (enrichment)
-- y el usuario puede editarla en la Base de Conocimiento. El engine la usa
-- para decidir qué documentos entran al contexto de cada pregunta.
-- Idempotente.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS routing_hint TEXT;

COMMENT ON COLUMN documents.routing_hint IS
  'Cuándo consultar este documento, en lenguaje natural. Auto-generado al subir, editable por el usuario. NULL → el engine usa summary como señal de ruteo.';
