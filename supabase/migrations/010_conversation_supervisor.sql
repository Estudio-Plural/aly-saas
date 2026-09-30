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

-- ============================================================================
-- Operar (fase 4): protocolo ante riesgo + reporte semanal
-- ============================================================================

-- Protocolo ante riesgo por workspace. Sin protocolo activo el supervisor
-- igual marca flags y avisa al equipo de Plural, pero la organización no
-- recibe alertas: una alerta sin alguien que responda crea un deber que nadie
-- puede cumplir.
CREATE TABLE IF NOT EXISTS alert_protocols (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  responsible_name TEXT,               -- quién responde (persona o rol)
  channel TEXT,                        -- email | telegram | whatsapp
  channel_target TEXT,                 -- correo, chat id de Telegram o número del equipo
  response_time_hours INTEGER,         -- tiempo de respuesta comprometido
  active BOOLEAN NOT NULL DEFAULT false,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT alert_protocols_channel_check
    CHECK (channel IS NULL OR channel IN ('email', 'telegram', 'whatsapp')),
  CONSTRAINT alert_protocols_response_time_check
    CHECK (response_time_hours IS NULL OR response_time_hours BETWEEN 1 AND 720),
  -- Activo solo si está completo (quién, por dónde y en cuánto tiempo)
  CONSTRAINT alert_protocols_active_complete CHECK (
    NOT active OR (
      responsible_name IS NOT NULL AND channel IS NOT NULL
      AND channel_target IS NOT NULL AND response_time_hours IS NOT NULL
    )
  )
);

COMMENT ON TABLE alert_protocols IS 'Protocolo ante riesgo de la organización: sin protocolo activo no hay alertas para la org (Plural sí las recibe)';

ALTER TABLE alert_protocols ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alert_protocols_isolation ON alert_protocols;
CREATE POLICY alert_protocols_isolation ON alert_protocols
  USING (workspace_id::text = current_setting('app.workspace_id', true));

-- Destinatarios del reporte semanal: los miembros de la org con correo.
-- (IF NOT EXISTS: otra migración de acceso puede agregar la misma columna.)
ALTER TABLE workspace_users ADD COLUMN IF NOT EXISTS email TEXT;

-- Corridas del reporte semanal. Idempotencia: una fila por workspace y
-- semana; si ya se mandó, no se vuelve a mandar. Solo cifras agregadas
-- (sin identificadores de personas ni texto de mensajes).
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,            -- lunes de la semana reportada (zona del programa)
  summary JSONB NOT NULL,              -- cifras agregadas de la semana y la anterior
  status TEXT NOT NULL DEFAULT 'generated', -- generated | sent | failed
  recipients_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, week_start),
  CONSTRAINT weekly_reports_status_check CHECK (status IN ('generated', 'sent', 'failed'))
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS weekly_reports_isolation ON weekly_reports;
CREATE POLICY weekly_reports_isolation ON weekly_reports
  USING (workspace_id::text = current_setting('app.workspace_id', true));
