// Queries de workspaces (programas) — solo servidor.
//
// AISLAMIENTO: toda función que resuelve un workspace recibe el `Acceso` del usuario y filtra
// por sus organizaciones (la conexión local es superuser: el RLS no protege nada). Un slug de
// otra organización se comporta igual que uno inexistente (null → 404), para no revelar que
// existe. Las funciones de los demás módulos de lib/data reciben un `workspaceId` que SOLO
// debe salir de acá (getWorkspaceBySlug con el acceso de la request).
import { sql } from "@/lib/db";
import { orgsVisibles, puedeVerOrg, SinPermisoError, type Acceso } from "@/lib/auth";
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
  org_id: string;
  org_name: string;
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
    org_id: row.org_id,
    org_name: row.org_name,
  };
}

// Fragmento nuevo por llamada: los objetos query de postgres.js son single-use.
const workspaceSelect = () => sql`
  SELECT
    w.id, w.slug, w.name, w.assistant_name, w.subscription_status,
    w.created_at, w.updated_at, w.whatsapp_phone_number, w.kapso_connection_status,
    w.org_id, o.nombre AS org_name,
    (SELECT count(*)::int FROM documents d WHERE d.workspace_id = w.id) AS documents_count,
    (SELECT count(DISTINCT ui.conversation_id)::int FROM users_interactions ui WHERE ui.workspace_id = w.id) AS conversations_count,
    (SELECT count(*)::int FROM users_data ud WHERE ud.workspace_id = w.id) AS users_count
  FROM workspaces w
  JOIN orgs o ON o.id = w.org_id
`;

/** Condición SQL sobre `w.org_id`: las organizaciones que el usuario puede ver. */
function filtroOrg(acceso: Acceso) {
  const ids = orgsVisibles(acceso);
  return ids === null ? sql`TRUE` : sql`w.org_id = ANY(${ids}::text[])`;
}

/** Programas visibles para el usuario; `orgId` filtra además por una organización. */
export async function listWorkspaces(acceso: Acceso, orgId?: string): Promise<Workspace[]> {
  const rows = await sql<WorkspaceRow[]>`
    ${workspaceSelect()}
    WHERE ${filtroOrg(acceso)} ${orgId ? sql`AND w.org_id = ${orgId}` : sql``}
    ORDER BY o.nombre ASC, w.created_at ASC
  `;
  return rows.map(toWorkspace);
}

/** El workspace solo si es de una organización del usuario; si no, null (→ 404). */
export async function getWorkspaceBySlug(slug: string, acceso: Acceso): Promise<Workspace | null> {
  const rows = await sql<WorkspaceRow[]>`
    ${workspaceSelect()} WHERE w.slug = ${slug} AND ${filtroOrg(acceso)} LIMIT 1
  `;
  return rows.length ? toWorkspace(rows[0]) : null;
}

/** Slug libre a partir del pedido: si está tomado (por cualquiera), agrega -2, -3… */
async function slugLibre(base: string): Promise<string> {
  const taken = await sql<{ slug: string }[]>`
    SELECT slug FROM workspaces WHERE slug = ${base} OR slug LIKE ${base + "-%"}
  `;
  const usados = new Set(taken.map((t) => t.slug));
  if (!usados.has(base)) return base;
  for (let i = 2; ; i++) if (!usados.has(`${base}-${i}`)) return `${base}-${i}`;
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

/**
 * Crea el programa en `input.org_id`, que debe ser una organización del usuario.
 * Si el slug está tomado se usa el siguiente libre (un 409 revelaría que existe en otra org).
 */
export async function createWorkspace(
  input: { name: string; slug: string; assistant_name: string; org_id: string },
  acceso: Acceso
): Promise<Workspace> {
  if (!puedeVerOrg(acceso, input.org_id)) throw new SinPermisoError();
  const slug = await slugLibre(input.slug);

  const [row] = await sql.begin(async (tx) => {
    const [ws] = await tx`
      INSERT INTO workspaces (slug, name, assistant_name, owner_user_id, subscription_status, org_id)
      VALUES (${slug}, ${input.name}, ${input.assistant_name}, ${acceso.email}, 'trial', ${input.org_id})
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
  input: { name: string; slug: string; assistant_name: string },
  acceso: Acceso
): Promise<Workspace | null> {
  if (input.slug !== currentSlug) {
    const taken = await sql`SELECT 1 FROM workspaces WHERE slug = ${input.slug}`;
    if (taken.length) throw new SlugTakenError(input.slug);
  }
  const rows = await sql`
    UPDATE workspaces w
    SET name = ${input.name}, slug = ${input.slug}, assistant_name = ${input.assistant_name}
    WHERE w.slug = ${currentSlug} AND ${filtroOrg(acceso)}
    RETURNING id
  `;
  if (!rows.length) return null;
  const updated = await sql<WorkspaceRow[]>`${workspaceSelect()} WHERE w.id = ${rows[0].id}`;
  return toWorkspace(updated[0]);
}

/**
 * Borra el workspace (cascade en DB) y devuelve su id para limpiar uploads.
 * El permiso de borrar (admin de la org o Plural) lo revisa la ruta; acá solo se filtra.
 */
export async function deleteWorkspace(slug: string, acceso: Acceso): Promise<string | null> {
  const rows = await sql`
    DELETE FROM workspaces w WHERE w.slug = ${slug} AND ${filtroOrg(acceso)} RETURNING id
  `;
  return rows.length ? rows[0].id : null;
}

/** Mueve un programa a otra organización. Solo el equipo Plural (admin). */
export async function assignWorkspaceOrg(
  workspaceId: string,
  orgId: string,
  acceso: Acceso
): Promise<boolean> {
  if (!acceso.esPlural) throw new SinPermisoError();
  const rows = await sql`UPDATE workspaces SET org_id = ${orgId} WHERE id = ${workspaceId} RETURNING id`;
  return rows.length > 0;
}

/**
 * Guarda el número de WhatsApp de la organización como dato de contacto
 * mientras la conexión directa (Kapso) no existe. NO marca la conexión como
 * activa: el estado queda en 'pending'.
 */
export async function saveWhatsappContactNumber(
  slug: string,
  phoneNumber: string,
  acceso: Acceso
): Promise<Workspace | null> {
  const rows = await sql`
    UPDATE workspaces w
    SET kapso_connection_status = 'pending', whatsapp_phone_number = ${phoneNumber}
    WHERE w.slug = ${slug} AND ${filtroOrg(acceso)} RETURNING id
  `;
  if (!rows.length) return null;
  const updated = await sql<WorkspaceRow[]>`${workspaceSelect()} WHERE w.id = ${rows[0].id}`;
  return toWorkspace(updated[0]);
}

export async function setWhatsappConnection(
  slug: string,
  connection: { status: "connected"; phoneNumber: string } | { status: "pending" },
  acceso: Acceso
): Promise<Workspace | null> {
  const rows =
    connection.status === "connected"
      ? await sql`
          UPDATE workspaces w
          SET kapso_connection_status = 'connected', whatsapp_phone_number = ${connection.phoneNumber}
          WHERE w.slug = ${slug} AND ${filtroOrg(acceso)} RETURNING id
        `
      : await sql`
          UPDATE workspaces w
          SET kapso_connection_status = 'pending', whatsapp_phone_number = NULL
          WHERE w.slug = ${slug} AND ${filtroOrg(acceso)} RETURNING id
        `;
  if (!rows.length) return null;
  const updated = await sql<WorkspaceRow[]>`${workspaceSelect()} WHERE w.id = ${rows[0].id}`;
  return toWorkspace(updated[0]);
}
