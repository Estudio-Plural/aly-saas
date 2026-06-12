-- ============================================================================
-- 005 — Metadatos automáticos de documentos + reglas de alerta por workspace
-- El usuario no-code no completa nada de esto a mano: los metadatos de
-- documentos los genera el LLM al subir, y las flag_rules se editan en una
-- UI simple (descripción en lenguaje natural + severidad).
-- ============================================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS keywords TEXT[];
ALTER TABLE documents ADD COLUMN IF NOT EXISTS theme_category TEXT;

COMMENT ON COLUMN documents.summary IS 'Resumen generado por LLM al subir el documento';
COMMENT ON COLUMN documents.theme_category IS 'Categoría corta generada por LLM (ej: precios, productos)';

-- Reglas del flagging system definidas por el dueño del workspace:
-- [{id, description, severity: high|medium|low}]
ALTER TABLE workspace_configs ADD COLUMN IF NOT EXISTS flag_rules JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN workspace_configs.flag_rules IS 'Reglas de alerta en lenguaje natural que el LLM evalúa al cerrar cada conversación';

-- Reglas iniciales para configs que todavía no definieron ninguna
-- (re-ejecutar el setup solo re-seedea workspaces con flag_rules vacías)
UPDATE workspace_configs
SET flag_rules = '[
  {"id": "1", "description": "El usuario tiene un problema con un pago o pide un reembolso", "severity": "high"},
  {"id": "2", "description": "El usuario pide hablar con una persona del equipo", "severity": "medium"},
  {"id": "3", "description": "El usuario quedó disconforme con la respuesta del asistente", "severity": "medium"}
]'::jsonb
WHERE flag_rules = '[]'::jsonb;
