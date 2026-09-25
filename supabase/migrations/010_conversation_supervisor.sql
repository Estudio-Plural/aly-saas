-- ============================================================================
-- 010 — Supervisor de conversaciones
-- El engine analiza solo las conversaciones inactivas (POST /internal/supervise
-- o intervalo opcional) y guarda en la misma fila de conversations_data:
--   analysis          JSONB con momento del storyboard, criterio de éxito y
--                     flags con evidencia verificada (índice + fragmento)
--   analyzed_at       cuándo corrió el análisis
--   analyzed_through  timestamp del último mensaje que cubrió (idempotencia:
--                     se re-analiza solo si llegaron mensajes posteriores)
--   reviewed_by       quién marcó la alerta como revisada (reviewed_at ya
--                     existía desde la 001, sin uso hasta ahora)
-- Idempotente.
-- ============================================================================

ALTER TABLE conversations_data
  ADD COLUMN IF NOT EXISTS analysis JSONB,
  ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS analyzed_through TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

COMMENT ON COLUMN conversations_data.analysis IS 'Análisis estructurado del supervisor (momento, criterio de éxito, flags con evidencia verificada)';
COMMENT ON COLUMN conversations_data.analyzed_through IS 'Último mensaje cubierto por el análisis; el supervisor re-analiza si hay mensajes posteriores';
COMMENT ON COLUMN conversations_data.reviewed_by IS 'Usuario que marcó la alerta como revisada';

-- Análisis previos a esta migración (seeds y "Reiniciar" del preview): se
-- asume que cubrían todo lo que había cuando se crearon. Sin esto el
-- supervisor re-analizaría (y pisaría) los análisis de las seeds.
UPDATE conversations_data
SET analyzed_through = created_at
WHERE analyzed_through IS NULL
  AND (summary IS NOT NULL OR flags IS NOT NULL);

-- Alertas pendientes de revisión (badge/filtro del inbox)
CREATE INDEX IF NOT EXISTS idx_conversations_data_pending
  ON conversations_data(workspace_id)
  WHERE flag_severity IS NOT NULL AND reviewed_at IS NULL;
