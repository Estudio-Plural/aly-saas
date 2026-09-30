// Organizaciones y miembros (migración 011) — solo servidor.
// Leer: cada usuario ve sus organizaciones (el equipo Plural, todas).
// Escribir (crear org, miembros, mover programas): solo el equipo Plural.
import { sql } from "@/lib/db";
import { SinPermisoError, type Acceso, type RolOrg } from "@/lib/auth";

export type Org = { id: string; nombre: string };
export type OrgMember = { email: string; rol: RolOrg };
export type OrgDetalle = Org & {
  miembros: OrgMember[];
  programas: { id: string; slug: string; name: string }[];
};

const exigirPlural = (a: Acceso) => {
  if (!a.esPlural) throw new SinPermisoError();
};

/** Organizaciones visibles para el usuario. */
export async function listOrgs(acceso: Acceso): Promise<Org[]> {
  if (!acceso.esPlural) return acceso.orgs.map(({ id, nombre }) => ({ id, nombre }));
  return sql<Org[]>`SELECT id, nombre FROM orgs ORDER BY id = 'plural-demo' DESC, nombre`;
}

/** Todo lo que necesita /admin: orgs, miembros y programas. Solo equipo Plural. */
export async function listOrgsDetalle(acceso: Acceso): Promise<OrgDetalle[]> {
  exigirPlural(acceso);
  const [orgs, miembros, programas] = await Promise.all([
    sql<Org[]>`SELECT id, nombre FROM orgs ORDER BY id = 'plural-demo' DESC, nombre`,
    sql<(OrgMember & { org_id: string })[]>`SELECT org_id, email, rol FROM org_members ORDER BY email`,
    sql<{ id: string; slug: string; name: string; org_id: string }[]>`
      SELECT id, slug, name, org_id FROM workspaces ORDER BY name`,
  ]);
  return orgs.map((o) => ({
    id: o.id,
    nombre: o.nombre,
    miembros: miembros.filter((m) => m.org_id === o.id).map(({ email, rol }) => ({ email, rol })),
    programas: programas
      .filter((p) => p.org_id === o.id)
      .map(({ id, slug, name }) => ({ id, slug, name })),
  }));
}

export class OrgExisteError extends Error {
  constructor(id: string) {
    super(`Ya existe una organización con el identificador «${id}». Usa otro nombre.`);
    this.name = "OrgExisteError";
  }
}

export function orgIdDesdeNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function createOrg(acceso: Acceso, nombre: string): Promise<Org> {
  exigirPlural(acceso);
  const id = orgIdDesdeNombre(nombre);
  if (!id) throw new Error("Nombre inválido");
  const rows = await sql<Org[]>`
    INSERT INTO orgs (id, nombre) VALUES (${id}, ${nombre})
    ON CONFLICT (id) DO NOTHING RETURNING id, nombre
  `;
  if (!rows.length) throw new OrgExisteError(id);
  return rows[0];
}

/** Agrega (o cambia el rol de) un miembro. Devuelve false si la org no existe. */
export async function upsertOrgMember(
  acceso: Acceso,
  orgId: string,
  email: string,
  rol: RolOrg
): Promise<boolean> {
  exigirPlural(acceso);
  const org = await sql`SELECT 1 FROM orgs WHERE id = ${orgId}`;
  if (!org.length) return false;
  await sql`
    INSERT INTO org_members (org_id, email, rol) VALUES (${orgId}, ${email.trim().toLowerCase()}, ${rol})
    ON CONFLICT (org_id, email) DO UPDATE SET rol = EXCLUDED.rol
  `;
  return true;
}

export async function removeOrgMember(acceso: Acceso, orgId: string, email: string): Promise<boolean> {
  exigirPlural(acceso);
  const rows = await sql`
    DELETE FROM org_members WHERE org_id = ${orgId} AND email = ${email.trim().toLowerCase()} RETURNING 1
  `;
  return rows.length > 0;
}
