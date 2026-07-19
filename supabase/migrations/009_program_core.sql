-- 009 — Prompt núcleo + storyboard del programa conversacional.
-- Feedback de producto (2026-07): el asistente se define por una capa de
-- identidad (misión, alcance, criterio de éxito, acciones clave) y un arco
-- narrativo de 4 momentos, en vez de solo un guion paso a paso.
-- NULL = sin personalizar: los getters caen a los defaults comportamentales
-- en código (mismo patrón que prompts/capabilities). Idempotente.

ALTER TABLE workspace_configs
  ADD COLUMN IF NOT EXISTS core_prompt JSONB,
  ADD COLUMN IF NOT EXISTS storyboard JSONB;
