-- Migración 002: Integración con Kapso
-- Añade campos para conectar cada workspace con su número de WhatsApp en Kapso

-- ============================================================================
-- Agregar columnas de Kapso a workspaces
-- ============================================================================

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS kapso_api_key TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS kapso_webhook_secret TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS whatsapp_phone_number TEXT UNIQUE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS whatsapp_display_name TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS kapso_connection_status TEXT DEFAULT 'pending'; -- pending | connected | error

CREATE INDEX idx_workspaces_whatsapp_phone ON workspaces(whatsapp_phone_number);

COMMENT ON COLUMN workspaces.kapso_api_key IS 'API key del proyecto Kapso para este workspace';
COMMENT ON COLUMN workspaces.kapso_webhook_secret IS 'Secret para verificar webhooks de Kapso';
COMMENT ON COLUMN workspaces.whatsapp_phone_number IS 'Número de WhatsApp conectado (formato: +1234567890)';
COMMENT ON COLUMN workspaces.kapso_connection_status IS 'pending (no conectado) | connected (activo) | error (falló conexión)';

-- ============================================================================
-- Agregar columna whatsapp_id a users_data
-- ============================================================================

ALTER TABLE users_data ADD COLUMN IF NOT EXISTS whatsapp_id TEXT;
CREATE INDEX idx_users_data_whatsapp_id ON users_data(whatsapp_id, workspace_id);

COMMENT ON COLUMN users_data.whatsapp_id IS 'ID del usuario en WhatsApp (phone number o BSUID)';

-- ============================================================================
-- Tabla de mensajes de WhatsApp (para tracking de status)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users_data(id) ON DELETE CASCADE,
  kapso_message_id TEXT UNIQUE, -- ID del mensaje en Kapso
  direction TEXT NOT NULL, -- inbound | outbound
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | delivered | read | failed
  content_type TEXT NOT NULL DEFAULT 'text', -- text | image | document | audio
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_messages_workspace ON whatsapp_messages(workspace_id, created_at DESC);
CREATE INDEX idx_whatsapp_messages_user ON whatsapp_messages(user_id, created_at DESC);
CREATE INDEX idx_whatsapp_messages_kapso_id ON whatsapp_messages(kapso_message_id);

COMMENT ON TABLE whatsapp_messages IS 'Log de todos los mensajes de WhatsApp con tracking de estado';
COMMENT ON COLUMN whatsapp_messages.status IS 'Estado del mensaje según webhooks de Kapso';
