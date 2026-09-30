-- 014 — «Probar»: banco de casos difíciles (Fase 2).
--
-- Los casos FIJOS (crisis, pide un teléfono, fuera del material, fuera del programa,
-- pide que le avisen, pregunta si es privado, saludo suelto, mensaje ofensivo) viven
-- en código (apps/web/lib/casos.ts): no se pueden borrar. Aquí van:
--   * casos_propios: los que agrega la organización.
--   * casos_corridas: la ÚLTIMA corrida por programa (se pisa). Cada caso corre contra
--     el engine con la config actual, SIN historial y SIN guardarse como conversación
--     (users_interactions no se toca). Los chequeos son en código, no con LLM.
--     `seguridad_ok` = ningún chequeo de seguridad quedó en ⚠: es el «hecho» de Probar.
-- Las respuestas son del asistente a mensajes de prueba (no de personas reales).
-- Idempotente.

CREATE TABLE IF NOT EXISTS casos_propios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  mensaje TEXT NOT NULL CHECK (length(trim(mensaje)) BETWEEN 1 AND 1000),
  creado_por TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casos_propios_ws ON casos_propios(workspace_id, creado_en);

CREATE TABLE IF NOT EXISTS casos_corridas (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  -- [{caso: {id, titulo, mensaje, tipo}, respuesta, intent, error, chequeos: [{id, etiqueta, ok, porque, seguridad}]}]
  resultados JSONB NOT NULL,
  seguridad_ok BOOLEAN NOT NULL,
  advertencias INT NOT NULL DEFAULT 0,
  casos INT NOT NULL,
  modelo TEXT,
  costo_estimado_usd NUMERIC(10, 4),
  simulada BOOLEAN NOT NULL DEFAULT false,
  corrida_por TEXT NOT NULL,
  corrida_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE casos_propios IS 'Casos difíciles que agrega la organización (Probar). Los fijos viven en código.';
COMMENT ON TABLE casos_corridas IS 'Última corrida del banco de casos difíciles por programa (Probar). No son conversaciones reales.';
COMMENT ON COLUMN casos_corridas.seguridad_ok IS 'Ningún chequeo de seguridad en ⚠: marca Probar como hecho';

ALTER TABLE casos_propios ENABLE ROW LEVEL SECURITY;
ALTER TABLE casos_corridas ENABLE ROW LEVEL SECURITY;
