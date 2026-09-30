-- 012 — «Diseñar»: qué no hace el asistente, rutas de ayuda y bienvenida con
-- consentimiento. Tres columnas JSONB en workspace_configs. NULL = la
-- organización todavía no revisó esa sección (el panel lo muestra pendiente).
-- Idempotente.
--
-- ─── boundaries ─────────────────────────────────────────────────────────────
-- Reglas PROPIAS de la organización sobre lo que el asistente no hace:
--   {"rules": [{"id": "r1", "text": "No recomienda medicamentos ni dosis"}]}
-- Las reglas de SEGURIDAD (no inventa teléfonos, no nombra archivos, no promete
-- seguimiento, no dice que la conversación es privada, una sola oferta por
-- respuesta, marca lo propio como sugerencia) NO se guardan acá: viven en código
-- (apps/api/src/config/guardrails.ts y apps/web/lib/design.ts) y el engine las
-- compila SIEMPRE, exista o no esta fila.
--
-- ─── help_routes ────────────────────────────────────────────────────────────
-- Líneas y rutas de ayuda que el asistente puede dar (turno SENSITIVE):
--   [{"id": "h1",
--     "name": "Línea 106",                    -- nombre de la línea o servicio
--     "contact": "106 o WhatsApp 300 754 8933", -- teléfono o canal
--     "hours": "24 horas",                     -- horario ('' si no aplica)
--     "when": "Crisis emocional o ideas de hacerse daño",
--     "territory": "Bogotá"}]                  -- '' = todos los territorios
-- Vacío o NULL → el engine instruye no inventar números y pedir a la persona
-- buscar ayuda en su territorio.
--
-- ─── welcome ────────────────────────────────────────────────────────────────
-- Bienvenida, aviso de privacidad y preguntas de perfil (lo ejecuta el canal
-- de WhatsApp del lado servidor y el chat de prueba):
--   {"welcome_message": "¡Hola! Soy Aly…",
--    "privacy_notice": "texto EXACTO que escribe la organización",
--    "privacy_policy_url": "https://…" | "",
--    "profile_questions": [
--      {"id": "q1", "question": "¿En qué región vives?", "variable": "region",
--       "options": []},                                  -- [] = respuesta libre
--      {"id": "q2", "question": "¿Con qué género te identificas?",
--       "variable": "genero", "options": ["Mujer", "Hombre", "No binario",
--       "Prefiero no decir"]}]}
-- Reglas de aceptación FIJAS (no configurables, en código:
-- evaluateConsent en apps/web/lib/design.ts):
--   acepta  → «1», «sí», «si», «acepto», «sí, acepto», «estoy de acuerdo», «de acuerdo», «ok»…
--   rechaza → solo «2» o un mensaje que empieza con «no»
--   otra cosa → se repite la pregunta
-- Al rechazar no se guarda ningún dato de la persona.

ALTER TABLE workspace_configs
  ADD COLUMN IF NOT EXISTS boundaries JSONB,
  ADD COLUMN IF NOT EXISTS help_routes JSONB,
  ADD COLUMN IF NOT EXISTS welcome JSONB;
