-- Migración inicial: Schema multi-tenant para Aly SaaS
-- Compatible con Postgres local (pgvector opcional) y Supabase.
-- Fecha: 2026-06-01 (actualizada 2026-06-11: idempotente + pgvector opcional)

-- ============================================================================
-- EXTENSIONES
-- ============================================================================

-- pgvector es opcional en local: si no está disponible se omite la tabla
-- vectorial (el resto del schema funciona igual; RAG queda para producción).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector no disponible — se omite vector_aly.aly_general_knowledge';
END $$;

-- ============================================================================
-- WORKSPACES (Multi-tenant core)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  assistant_name TEXT NOT NULL DEFAULT 'Aly',
  owner_user_id TEXT NOT NULL, -- Clerk user ID
  subscription_status TEXT NOT NULL DEFAULT 'trial', -- trial | active | canceled | past_due
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id);

COMMENT ON TABLE workspaces IS 'Multi-tenant workspaces - cada workspace es un asistente customizado';
COMMENT ON COLUMN workspaces.subscription_status IS 'trial (14 días) | active (pago OK) | canceled (downgrade a free) | past_due (pago falló)';

-- ============================================================================
-- WORKSPACE USERS (Multi-user organizations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workspace_users (
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID
  role TEXT NOT NULL DEFAULT 'member', -- owner | admin | member
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_users_user_id ON workspace_users(user_id);

COMMENT ON TABLE workspace_users IS 'Relación N:M entre users y workspaces con roles';

-- ============================================================================
-- WORKSPACE CONFIGS (Prompts, categories, models por workspace)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workspace_configs (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  theme_categories JSONB NOT NULL DEFAULT '["marco_teorico","tips_facilitadores","mejores_practicas","rompehielos","conocimientos_generales","sensitive"]'::jsonb,
  model_preferences JSONB NOT NULL DEFAULT '{}'::jsonb, -- {chat: "...", triage: "...", ...}
  prompts JSONB NOT NULL DEFAULT '{}'::jsonb, -- {system: "...", factual_es: "...", ...}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workspace_configs IS 'Configuración dinámica de cada workspace (prompts, categorías, modelos)';
COMMENT ON COLUMN workspace_configs.theme_categories IS 'Categorías temáticas customizables para RAG filtering';
COMMENT ON COLUMN workspace_configs.model_preferences IS 'Override de modelos LLM por workspace';
COMMENT ON COLUMN workspace_configs.prompts IS 'Override de prompts por workspace (key "system" = system prompt del chat)';

-- ============================================================================
-- ONBOARDING FLOWS (Builder secuencial de pasos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS onboarding_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  graph_definition JSONB NOT NULL, -- ver migración 003: renombrada a "definition" {steps: [...]}
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_flows_workspace ON onboarding_flows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_flows_active ON onboarding_flows(workspace_id, is_active) WHERE is_active = true;

COMMENT ON TABLE onboarding_flows IS 'Flujos de onboarding conversacional (pasos secuenciales)';
COMMENT ON COLUMN onboarding_flows.is_active IS 'Solo 1 flow puede estar activo por workspace';

-- ============================================================================
-- ONBOARDING SESSIONS (Runtime state del onboarding)
-- ============================================================================

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES onboarding_flows(id) ON DELETE CASCADE,
  user_number TEXT NOT NULL, -- WhatsApp number
  state JSONB NOT NULL DEFAULT '{}'::jsonb, -- {current_step: "...", answers: {...}}
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_flow ON onboarding_sessions(flow_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user ON onboarding_sessions(user_number);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_pending ON onboarding_sessions(flow_id, user_number) WHERE completed_at IS NULL;

COMMENT ON TABLE onboarding_sessions IS 'Estado runtime de cada sesión de onboarding (por usuario)';
COMMENT ON COLUMN onboarding_sessions.state IS '{current_step: "1", answers: {name: "...", email: "..."}}';

-- ============================================================================
-- USERS DATA (Metadata de usuarios finales - WhatsApp)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  number TEXT NOT NULL, -- WhatsApp number (unique per workspace)
  name TEXT,
  country TEXT,
  gender TEXT,
  region TEXT,
  email TEXT,
  user_language TEXT DEFAULT 'es', -- es | en | pt
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, number)
);

CREATE INDEX IF NOT EXISTS idx_users_data_workspace ON users_data(workspace_id);
CREATE INDEX IF NOT EXISTS idx_users_data_number ON users_data(workspace_id, number);

COMMENT ON TABLE users_data IS 'Metadata de usuarios finales registrados (post-onboarding)';

-- ============================================================================
-- USERS INTERACTIONS (Historial de conversaciones)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  client_number TEXT NOT NULL,
  role TEXT NOT NULL, -- user | assistant
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open', -- open | closed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_interactions_workspace ON users_interactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_users_interactions_conversation ON users_interactions(workspace_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_users_interactions_client ON users_interactions(workspace_id, client_number);
CREATE INDEX IF NOT EXISTS idx_users_interactions_status ON users_interactions(workspace_id, status);

COMMENT ON TABLE users_interactions IS 'Historial completo de mensajes (input/output del bot)';

-- ============================================================================
-- CONVERSATIONS DATA (Resúmenes + flags del ConversationCloser)
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  user_number TEXT NOT NULL,
  conversation_date DATE,
  transcription TEXT,
  summary TEXT,
  keywords TEXT[],
  flags TEXT,
  flag_severity TEXT,
  messages_count INTEGER,
  session TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_data_workspace ON conversations_data(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_data_flags ON conversations_data(workspace_id, flag_severity) WHERE flag_severity IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_data_date ON conversations_data(workspace_id, conversation_date);

COMMENT ON TABLE conversations_data IS 'Análisis LLM de conversaciones cerradas (keywords, flags, summary)';
COMMENT ON COLUMN conversations_data.flags IS 'CSV de flags: HIGH-descripcion, MEDIUM-descripcion, ...';

-- ============================================================================
-- VECTOR STORE (Knowledge base con embeddings) — solo si pgvector existe
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS vector_aly;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE NOTICE 'Saltando vector_aly.aly_general_knowledge (pgvector ausente)';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS vector_aly.aly_general_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    document_name TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding vector(3072) NOT NULL, -- OpenAI text-embedding-3-large
    summary TEXT,
    keywords TEXT[],
    theme_category TEXT,
    project TEXT DEFAULT 'co', -- Legacy, deprecar
    program TEXT, -- Legacy (era bot_id), ahora usar workspace_id
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_aly_general_knowledge_workspace ON vector_aly.aly_general_knowledge(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_aly_general_knowledge_document ON vector_aly.aly_general_knowledge(workspace_id, document_id);
  CREATE INDEX IF NOT EXISTS idx_aly_general_knowledge_theme ON vector_aly.aly_general_knowledge(workspace_id, theme_category);

  -- Sin índice vectorial: ivfflat/hnsw no soportan >2000 dims (acá 3072).
  -- A este volumen el scan exacto es rápido y con recall perfecto; si el
  -- volumen crece, evaluar índice HNSW sobre halfvec(3072).

  ALTER TABLE vector_aly.aly_general_knowledge ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'vector_aly' AND policyname = 'workspace_isolation_aly_general_knowledge'
  ) THEN
    CREATE POLICY workspace_isolation_aly_general_knowledge
      ON vector_aly.aly_general_knowledge
      FOR ALL
      USING (workspace_id = current_setting('app.workspace_id', true)::UUID);
  END IF;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE users_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations_data ENABLE ROW LEVEL SECURITY;

-- Policies: solo acceder a filas del workspace actual
-- (el service_role / superuser bypasea RLS — OK para el backend)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_users_interactions') THEN
    CREATE POLICY workspace_isolation_users_interactions
      ON users_interactions FOR ALL
      USING (workspace_id = current_setting('app.workspace_id', true)::UUID);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_users_data') THEN
    CREATE POLICY workspace_isolation_users_data
      ON users_data FOR ALL
      USING (workspace_id = current_setting('app.workspace_id', true)::UUID);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_conversations_data') THEN
    CREATE POLICY workspace_isolation_conversations_data
      ON conversations_data FOR ALL
      USING (workspace_id = current_setting('app.workspace_id', true)::UUID);
  END IF;
END $$;

-- ============================================================================
-- FUNCIONES AUXILIARES
-- ============================================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE OR REPLACE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_workspace_configs_updated_at BEFORE UPDATE ON workspace_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_onboarding_flows_updated_at BEFORE UPDATE ON onboarding_flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_onboarding_sessions_updated_at BEFORE UPDATE ON onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_users_data_updated_at BEFORE UPDATE ON users_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- WORKSPACE DEMO (para MVP)
-- ============================================================================

INSERT INTO workspaces (slug, name, assistant_name, owner_user_id, subscription_status)
VALUES ('demo', 'Demo Workspace', 'Aly', 'demo_user_001', 'trial')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO workspace_configs (workspace_id)
SELECT id FROM workspaces WHERE slug = 'demo'
ON CONFLICT (workspace_id) DO NOTHING;
