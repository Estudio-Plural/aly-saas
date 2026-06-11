-- Migración 003: app funcional en local
-- 1. Tabla `documents` (knowledge base — archivos subidos)
-- 2. onboarding_flows: graph_definition → definition ({steps: [...]} secuencial,
--    alineado con el builder real de la UI)
-- 3. RLS en las tablas que faltaban (workspaces, configs, flows, sessions, whatsapp)
-- 4. Seed: workspaces demo + apapachar con config y flujo de onboarding inicial
-- Fecha: 2026-06-11

-- ============================================================================
-- 1. DOCUMENTS (Knowledge base: metadata de archivos subidos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL, -- ruta relativa dentro del directorio de uploads
  text_content TEXT, -- contenido extraído (txt/md) para inyectar al contexto del chat
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id, created_at DESC);

COMMENT ON TABLE documents IS 'Archivos de la knowledge base. El binario vive en disco (local) o storage (prod); acá la metadata.';
COMMENT ON COLUMN documents.text_content IS 'Texto plano extraído del archivo (solo txt/md por ahora) — se inyecta al system prompt del chat hasta tener RAG con pgvector';

-- ============================================================================
-- 2. ONBOARDING FLOWS: definición secuencial {steps: [...]}
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'onboarding_flows' AND column_name = 'graph_definition'
  ) THEN
    ALTER TABLE onboarding_flows RENAME COLUMN graph_definition TO definition;
  END IF;
END $$;

COMMENT ON COLUMN onboarding_flows.definition IS
  '{steps: [{id, type: question|message|end, content, variable?}]} — pasos secuenciales del builder';

-- ============================================================================
-- 3. RLS EN TABLAS RESTANTES
-- ============================================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_workspaces') THEN
    CREATE POLICY workspace_isolation_workspaces
      ON workspaces FOR ALL
      USING (id = current_setting('app.workspace_id', true)::UUID);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_workspace_users') THEN
    CREATE POLICY workspace_isolation_workspace_users
      ON workspace_users FOR ALL
      USING (workspace_id = current_setting('app.workspace_id', true)::UUID);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_workspace_configs') THEN
    CREATE POLICY workspace_isolation_workspace_configs
      ON workspace_configs FOR ALL
      USING (workspace_id = current_setting('app.workspace_id', true)::UUID);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_onboarding_flows') THEN
    CREATE POLICY workspace_isolation_onboarding_flows
      ON onboarding_flows FOR ALL
      USING (workspace_id = current_setting('app.workspace_id', true)::UUID);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_onboarding_sessions') THEN
    CREATE POLICY workspace_isolation_onboarding_sessions
      ON onboarding_sessions FOR ALL
      USING (flow_id IN (
        SELECT id FROM onboarding_flows
        WHERE workspace_id = current_setting('app.workspace_id', true)::UUID
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_whatsapp_messages') THEN
    CREATE POLICY workspace_isolation_whatsapp_messages
      ON whatsapp_messages FOR ALL
      USING (workspace_id = current_setting('app.workspace_id', true)::UUID);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_documents') THEN
    CREATE POLICY workspace_isolation_documents
      ON documents FOR ALL
      USING (workspace_id = current_setting('app.workspace_id', true)::UUID);
  END IF;
END $$;

-- ============================================================================
-- 4. SEED (idempotente)
-- ============================================================================

INSERT INTO workspaces (slug, name, assistant_name, owner_user_id, subscription_status)
VALUES ('apapachar', 'Apapáchar', 'Apa', 'demo_user_001', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO workspace_configs (workspace_id)
SELECT id FROM workspaces WHERE slug IN ('demo', 'apapachar')
ON CONFLICT (workspace_id) DO NOTHING;

-- Flujo de onboarding inicial para cada workspace que no tenga ninguno
INSERT INTO onboarding_flows (workspace_id, name, definition, is_active)
SELECT
  w.id,
  'Onboarding inicial',
  '{"steps": [
    {"id": "1", "type": "question", "content": "¿Cómo te llamas?", "variable": "name"},
    {"id": "2", "type": "message", "content": "¡Hola {name}! Bienvenido a nuestro programa."},
    {"id": "3", "type": "end", "content": "Onboarding completado"}
  ]}'::jsonb,
  true
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM onboarding_flows f WHERE f.workspace_id = w.id);

-- Algunos usuarios finales y conversaciones de ejemplo en el workspace demo
-- (para que el dashboard muestre actividad; son datos reales en la DB, no mocks de UI)
INSERT INTO users_data (workspace_id, number, name, country, user_language)
SELECT w.id, v.number, v.name, 'AR', 'es'
FROM workspaces w,
  (VALUES
    ('+5491100000001', 'María Pérez'),
    ('+5491100000002', 'Julián Sosa'),
    ('+5491100000003', 'Carla Gómez')
  ) AS v(number, name)
WHERE w.slug = 'demo'
ON CONFLICT (workspace_id, number) DO NOTHING;

INSERT INTO users_interactions (workspace_id, conversation_id, client_number, role, message, status)
SELECT w.id, v.conversation_id, v.client_number, v.role, v.message, 'closed'
FROM workspaces w,
  (VALUES
    ('conv-seed-001', '+5491100000001', 'user', 'Hola, ¿qué horarios de atención tienen?'),
    ('conv-seed-001', '+5491100000001', 'assistant', '¡Hola María! Atendemos de lunes a viernes de 9 a 18hs.'),
    ('conv-seed-002', '+5491100000002', 'user', '¿Cómo me inscribo al curso?'),
    ('conv-seed-002', '+5491100000002', 'assistant', 'Te paso el link de inscripción. ¿Querés que te ayude con el formulario?')
  ) AS v(conversation_id, client_number, role, message)
WHERE w.slug = 'demo'
  AND NOT EXISTS (
    SELECT 1 FROM users_interactions ui
    WHERE ui.workspace_id = w.id AND ui.conversation_id = v.conversation_id AND ui.message = v.message
  );

INSERT INTO conversations_data (workspace_id, conversation_id, user_number, conversation_date, summary, messages_count)
SELECT w.id, v.conversation_id, v.user_number, CURRENT_DATE - 2, v.summary, 2
FROM workspaces w,
  (VALUES
    ('conv-seed-001', '+5491100000001', 'Consulta por horarios de atención, resuelta.'),
    ('conv-seed-002', '+5491100000002', 'Consulta por inscripción al curso, se envió link.')
  ) AS v(conversation_id, user_number, summary)
WHERE w.slug = 'demo'
ON CONFLICT (workspace_id, conversation_id) DO NOTHING;
