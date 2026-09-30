-- 013 — Canal WhatsApp directo con Meta Cloud API (Fase 3).
--
-- Tres piezas, que conviene no confundir (mismo modelo que Aly/Tranqui):
--   * La CONEXIÓN es por workspace: qué número de Meta atiende a qué programa y
--     en qué punto está el checklist para conectarlo.
--   * La SESIÓN rota (70 min de inactividad → conversación nueva); el
--     CONSENTIMIENTO no rota: quien aceptó no vuelve a aceptar.
--   * La IDEMPOTENCIA es por mensaje (wamid): Meta reintenta ante cualquier
--     != 200 y sin esto un fallo parcial duplica respuestas.
--
-- ⚠️ TOKENS: esta tabla NO guarda el token de Graph. Guarda el NOMBRE de la
-- variable de entorno del engine que lo tiene (`token_env`, p. ej.
-- META_TOKEN_APAPACHAR), igual que MetaBots.ts en Aly. Motivos: la DB se copia
-- a laptops y backups; el engine es el único que necesita el token; y cifrar
-- en la base exigiría igual una llave en el entorno. El CHECK limita el nombre
-- a `META_TOKEN_*` para que desde el panel no se pueda apuntar a otra variable
-- (DATABASE_URL, OPENROUTER_API_KEY) y hacer que el engine la mande a Graph.
--
-- Datos de perfil: solo existen tras aceptar (users_data.profile). Al rechazar
-- se borra la fila de wa_sessions y no queda rastro de la persona.
-- Idempotente.

-- ============================================================================
-- CONEXIÓN POR WORKSPACE
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_connections (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  phone_number_id TEXT UNIQUE,
  display_number TEXT,
  waba_id TEXT,
  token_env TEXT,
  -- Pasos manuales marcados por Plural: {"app_publicada": {"hecho": true, "at": "...", "por": "..."}, ...}
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Prueba de vida: lo escribe el engine, nunca el panel.
  last_inbound_at TIMESTAMPTZ,
  last_reply_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_connections_token_env_check'
  ) THEN
    ALTER TABLE whatsapp_connections
      ADD CONSTRAINT whatsapp_connections_token_env_check
      CHECK (token_env IS NULL OR token_env ~ '^META_TOKEN_[A-Z0-9_]{1,64}$');
  END IF;
END $$;

COMMENT ON TABLE whatsapp_connections IS 'Número de WhatsApp (Meta Cloud API) de cada workspace + checklist de conexión';
COMMENT ON COLUMN whatsapp_connections.token_env IS 'NOMBRE de la variable de entorno del engine con el token de Graph (nunca el token)';
COMMENT ON COLUMN whatsapp_connections.last_reply_at IS 'Último mensaje real recibido Y respondido: es lo único que habilita el estado Activo';

-- Estado global del webhook (una sola URL para todos los workspaces).
CREATE TABLE IF NOT EXISTS wa_webhook_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_verified_at TIMESTAMPTZ,
  last_post_at TIMESTAMPTZ,
  last_bad_signature_at TIMESTAMPTZ
);
INSERT INTO wa_webhook_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SESIONES POR PERSONA
-- ============================================================================

CREATE TABLE IF NOT EXISTS wa_sessions (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- Teléfono (E.164 sin +) o BSUID ("CO.xxxx"). sender_kind dice cuál.
  identidad TEXT NOT NULL,
  sender_kind TEXT NOT NULL CHECK (sender_kind IN ('phone', 'bsuid')),
  conversation_id TEXT NOT NULL,
  onboarding_state TEXT NOT NULL DEFAULT 'nuevo',
  consent TEXT NOT NULL DEFAULT 'pendiente' CHECK (consent IN ('pendiente', 'aceptado')),
  consent_at TIMESTAMPTZ,
  last_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Load-bearing: sin él el upsert no tiene conflicto y cada mensaje abriría
  -- una conversación nueva (lección de Aly).
  UNIQUE (workspace_id, identidad)
);

CREATE INDEX IF NOT EXISTS idx_wa_sessions_workspace ON wa_sessions(workspace_id, consent);

COMMENT ON TABLE wa_sessions IS 'Sesión de WhatsApp por persona: conversación vigente, onboarding y consentimiento';

-- ============================================================================
-- IDEMPOTENCIA POR WAMID
-- ============================================================================

CREATE TABLE IF NOT EXISTS wa_processed_messages (
  wamid TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  -- en_curso: un intento lo está atendiendo (o murió: se retoma pasados unos minutos)
  -- pendiente_envio: la respuesta ya se generó pero no terminó de salir → el
  --   reintento de Meta la REENVÍA sin regenerar
  -- hecho: entregado
  estado TEXT NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso', 'pendiente_envio', 'hecho')),
  salidas JSONB,           -- solo mientras está pendiente; se limpia al entregar
  enviadas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_processed_created ON wa_processed_messages(created_at);

-- ============================================================================
-- PERFIL (solo tras aceptar)
-- ============================================================================

ALTER TABLE users_data ADD COLUMN IF NOT EXISTS sender_kind TEXT;
ALTER TABLE users_data ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN users_data.profile IS 'Respuestas a las preguntas de perfil opcionales del onboarding de WhatsApp';

-- ============================================================================
-- RLS (mismo patrón que 001: aislamiento por app.workspace_id)
-- ============================================================================

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_processed_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_whatsapp_connections') THEN
    CREATE POLICY workspace_isolation_whatsapp_connections ON whatsapp_connections FOR ALL
      USING (workspace_id::text = current_setting('app.workspace_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_wa_sessions') THEN
    CREATE POLICY workspace_isolation_wa_sessions ON wa_sessions FOR ALL
      USING (workspace_id::text = current_setting('app.workspace_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_wa_processed_messages') THEN
    CREATE POLICY workspace_isolation_wa_processed_messages ON wa_processed_messages FOR ALL
      USING (workspace_id::text = current_setting('app.workspace_id', true));
  END IF;
END $$;
