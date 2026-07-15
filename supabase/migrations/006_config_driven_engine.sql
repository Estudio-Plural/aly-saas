-- ============================================================================
-- 006 — Motor config-driven (Fase 0 de "motor real dentro del SaaS")
-- El pipeline de 16 nodos (Aly-legacy) deja de leer prompts/programs/estructura
-- de clases hardcodeadas y los lee de workspace_configs:
--   - prompts    : pasa de {system} (chat de juguete) al bundle completo del
--                  pipeline (campos _es/_en + compartidos). Ver el COMMENT.
--   - capabilities: los nodos "especiales" (sensibles / slot-filling / identidad)
--                  como flags, no como checks botId==="demo".
--   - programs   : partición del corpus para retrieval (Fase 0; Fase 2 migra a
--                  workspace_id junto con pgvector real).
-- Idempotente (ADD COLUMN IF NOT EXISTS): re-ejecutar el setup no rompe nada.
-- ============================================================================

ALTER TABLE workspace_configs
  ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL
  DEFAULT '{"sensitive_safety": true, "context_gathering": {"on": false, "slots": []}, "org_identity": false}'::jsonb;

ALTER TABLE workspace_configs
  ADD COLUMN IF NOT EXISTS programs JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN workspace_configs.capabilities IS
  'Flags de capacidades del pipeline: sensitive_safety (bool), context_gathering {on, slots[]}, org_identity (bool). Reemplazan los checks botId="demo" del Aly-legacy.';

COMMENT ON COLUMN workspace_configs.programs IS
  'Lista priorizada de programas del corpus para retrieval (ej ["apapachar","equimundo"]). Vacío = solo el corpus del propio workspace. Fase 2: migra a workspace_id.';

COMMENT ON COLUMN workspace_configs.prompts IS
  'Bundle de prompts del pipeline por workspace. Variantes por idioma: normalize/triage/librarian/factual/plan/ideate/sensitive/smalltalk/factual_no_context_fallback/org_profile con sufijo _es y _en. Compartidos (sin sufijo): intent, keyword_extraction, sensitive_message. Cualquier campo ausente cae al template default del engine. La key legacy "system" queda ignorada por el pipeline.';
