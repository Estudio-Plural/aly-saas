// Queries de workspaces — solo servidor.
import { sql } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/constants";
import type { Workspace } from "@/lib/workspaces";

type WorkspaceRow = {
  id: string;
  slug: string;
  name: string;
  assistant_name: string;
  subscription_status: Workspace["subscription_status"];
  created_at: Date;
  updated_at: Date;
  whatsapp_phone_number: string | null;
  kapso_connection_status: Workspace["kapso_connection_status"] | null;
  documents_count: number;
  conversations_count: number;
  users_count: number;
};

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    assistant_name: row.assistant_name,
    subscription_status: row.subscription_status,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    whatsapp_phone_number: row.whatsapp_phone_number,
    kapso_connection_status: row.kapso_connection_status ?? "pending",
    stats: {
      documents: row.documents_count,
      conversations: row.conversations_count,
      users: row.users_count,
    },
  };
}

// Fragmento nuevo por llamada: los objetos query de postgres.js son single-use.
const workspaceSelect = () => sql`
  SELECT
    w.id, w.slug, w.name, w.assistant_name, w.subscription_status,
    w.created_at, w.updated_at, w.whatsapp_phone_number, w.kapso_connection_status,
    (SELECT count(*)::int FROM documents d WHERE d.workspace_id = w.id) AS documents_count,
    (SELECT count(DISTINCT ui.conversation_id)::int FROM users_interactions ui WHERE ui.workspace_id = w.id) AS conversations_count,
    (SELECT count(*)::int FROM users_data ud WHERE ud.workspace_id = w.id) AS users_count
  FROM workspaces w
`;

export async function listWorkspaces(): Promise<Workspace[]> {
  const rows = await sql<WorkspaceRow[]>`${workspaceSelect()} ORDER BY w.created_at ASC`;
  return rows.map(toWorkspace);
}

export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const rows = await sql<WorkspaceRow[]>`${workspaceSelect()} WHERE w.slug = ${slug} LIMIT 1`;
  return rows.length ? toWorkspace(rows[0]) : null;
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`El slug "${slug}" ya está en uso`);
    this.name = "SlugTakenError";
  }
}

const DEFAULT_ONBOARDING = {
  steps: [
    { id: "1", type: "question", content: "¿Cómo te llamas?", variable: "name" },
    { id: "2", type: "message", content: "¡Hola {name}! Bienvenido a nuestro programa." },
    { id: "3", type: "end", content: "Onboarding completado" },
  ],
};

// Reglas de alerta iniciales (el dueño las edita después en Conversaciones)
const DEFAULT_FLAG_RULES = [
  {
    id: "1",
    description: "El usuario tiene un problema con un pago o pide un reembolso",
    severity: "high",
  },
  {
    id: "2",
    description: "El usuario pide hablar con una persona del equipo",
    severity: "medium",
  },
  {
    id: "3",
    description: "El usuario quedó disconforme con la respuesta del asistente",
    severity: "medium",
  },
];

export async function createWorkspace(input: {
  name: string;
  slug: string;
  assistant_name: string;
}): Promise<Workspace> {
  const existing = await sql`SELECT 1 FROM workspaces WHERE slug = ${input.slug}`;
  if (existing.length) throw new SlugTakenError(input.slug);

  const [row] = await sql.begin(async (tx) => {
    const [ws] = await tx`
      INSERT INTO workspaces (slug, name, assistant_name, owner_user_id, subscription_status)
      VALUES (${input.slug}, ${input.name}, ${input.assistant_name}, ${DEMO_USER_ID}, 'trial')
      RETURNING id
    `;
    await tx`
      INSERT INTO workspace_configs (workspace_id, flag_rules)
      VALUES (${ws.id}, ${sql.json(DEFAULT_FLAG_RULES)})
    `;
    await tx`
      INSERT INTO onboarding_flows (workspace_id, name, definition, is_active)
      VALUES (${ws.id}, 'Onboarding inicial', ${sql.json(DEFAULT_ONBOARDING)}, true)
    `;
    return [ws];
  });

  const created = await sql<WorkspaceRow[]>`${workspaceSelect()} WHERE w.id = ${row.id}`;
  return toWorkspace(created[0]);
}

export async function updateWorkspace(
  currentSlug: string,
  input: { name: string; slug: string; assistant_name: string }
): Promise<Workspace | null> {
  if (input.slug !== currentSlug) {
    const taken = await sql`SELECT 1 FROM workspaces WHERE slug = ${input.slug}`;
    if (taken.length) throw new SlugTakenError(input.slug);
  }
  const rows = await sql`
    UPDATE workspaces
    SET name = ${input.name}, slug = ${input.slug}, assistant_name = ${input.assistant_name}
    WHERE slug = ${currentSlug}
    RETURNING id
  `;
  if (!rows.length) return null;
  const updated = await sql<WorkspaceRow[]>`${workspaceSelect()} WHERE w.id = ${rows[0].id}`;
  return toWorkspace(updated[0]);
}

/** Borra el workspace (cascade en DB) y devuelve su id para limpiar uploads. */
export async function deleteWorkspace(slug: string): Promise<string | null> {
  const rows = await sql`DELETE FROM workspaces WHERE slug = ${slug} RETURNING id`;
  return rows.length ? rows[0].id : null;
}

export async function setWhatsappConnection(
  slug: string,
  connection: { status: "connected"; phoneNumber: string } | { status: "pending" }
): Promise<Workspace | null> {
  const rows =
    connection.status === "connected"
      ? await sql`
          UPDATE workspaces
          SET kapso_connection_status = 'connected', whatsapp_phone_number = ${connection.phoneNumber}
          WHERE slug = ${slug} RETURNING id
        `
      : await sql`
          UPDATE workspaces
          SET kapso_connection_status = 'pending', whatsapp_phone_number = NULL
          WHERE slug = ${slug} RETURNING id
        `;
  if (!rows.length) return null;
  const updated = await sql<WorkspaceRow[]>`${workspaceSelect()} WHERE w.id = ${rows[0].id}`;
  return toWorkspace(updated[0]);
}
