-- 011 — Organizaciones y roles (Fase 0: acceso, roles y aislamiento).
--
-- Quién entra lo decide la puerta de Plural IA (plural-gate), que firma el correo.
-- Qué ve cada correo lo decide esta tabla:
--   · correos del equipo Plural (dominio en PLURAL_DOMAINS, por defecto estudio-plural.co)
--     → rol «plural»: todas las organizaciones, y las transcripciones.
--   · el resto → solo los programas (workspaces) de las organizaciones donde es miembro.
--     Dentro de una organización: 'admin' (puede borrar programas) o 'miembro'.
--
-- El aislamiento se hace en la app (apps/web/lib/data): la conexión local es superuser
-- y se salta el RLS, así que el RLS de 003 no alcanza.
-- Idempotente: se puede re-ejecutar.

CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,                       -- slug legible, p. ej. 'plural-demo'
  nombre TEXT NOT NULL,
  creado TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(email)),
  rol TEXT NOT NULL DEFAULT 'miembro' CHECK (rol IN ('admin', 'miembro')),
  creado TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_members_email ON org_members(email);

-- La organización del equipo para los programas de prueba que ya existían.
INSERT INTO orgs (id, nombre) VALUES ('plural-demo', 'Plural (demo)')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES orgs(id) ON DELETE RESTRICT;

UPDATE workspaces SET org_id = 'plural-demo' WHERE org_id IS NULL;

-- Todo programa pertenece a una organización. El DEFAULT cubre los seeds de 001/004 al
-- re-ejecutar las migraciones: un programa sin org explícita queda en la del equipo, que
-- ningún cliente ve (falla cerrado). La app siempre pasa org_id al crear.
ALTER TABLE workspaces ALTER COLUMN org_id SET DEFAULT 'plural-demo';
ALTER TABLE workspaces ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(org_id);

COMMENT ON TABLE orgs IS 'Organizaciones cliente de Aly SaaS. Cada programa (workspace) pertenece a una.';
COMMENT ON TABLE org_members IS 'Correos con acceso a una organización (rol admin|miembro). El equipo Plural no necesita fila: ve todo.';
COMMENT ON COLUMN workspaces.org_id IS 'Organización dueña del programa. Filtro de aislamiento en toda la app.';

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
