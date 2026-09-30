// Identidad y acceso — solo servidor.
//
// Quién es: lo dice la puerta de Plural IA (plural-gate). La puerta pone el correo en
// X-Plural-User-Email y lo firma con GATE_SECRET (X-Plural-User-Id/-Role/-Ts/-Sig); el Caddy
// de borde borra esos encabezados si vienen de afuera. La firma evita que otro proceso que le
// hable directo a la app se haga pasar por alguien. Misma verificación que el portal
// (plural-suite/portal/lib/auth.ts).
//
// Qué ve: el equipo de Plural (dominios de PLURAL_DOMAINS) ve todas las organizaciones y las
// transcripciones; un cliente, solo los programas de sus organizaciones (tabla org_members,
// migración 011) y nunca el texto de las conversaciones.
//
// Sin firma exigida (desarrollo local, sin GATE_SECRET): se acepta el encabezado tal cual o
// DEV_USER_EMAIL. En producción, o con PLURAL_REQUIRE_GATE=1 (la VPS corre `next dev`), sin
// GATE_SECRET nadie entra.
import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";

export type RolOrg = "admin" | "miembro";

export type OrgDeUsuario = { id: string; nombre: string; rol: RolOrg };

export type Acceso = {
  email: string;
  /** Equipo de Plural: ve todas las organizaciones y las transcripciones. */
  esPlural: boolean;
  /** Organizaciones del cliente (vacío para el equipo Plural: ve todas). */
  orgs: OrgDeUsuario[];
};

const dominiosPlural = () =>
  (process.env.PLURAL_DOMAINS ?? "estudio-plural.co")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

export const esCorreoPlural = (email: string) =>
  dominiosPlural().includes((email.split("@")[1] ?? "").toLowerCase());

/** ¿Hay que exigir la firma de la puerta? En producción o con PLURAL_REQUIRE_GATE=1. */
export const firmaObligatoria = () =>
  process.env.NODE_ENV === "production" || process.env.PLURAL_REQUIRE_GATE === "1";

const VIGENCIA_FIRMA_MS = 5 * 60e3;

export function firmarIdentidad(secreto: string, email: string, uid: string, rol: string, ts: string) {
  return createHmac("sha256", secreto).update(`${email}|${uid}|${rol}|${ts}`).digest("base64url");
}

/** El correo solo si la firma de la puerta es válida y reciente (≤ 5 min). */
export function identidadFirmada(h: Headers): string | null {
  const email = h.get("x-plural-user-email");
  if (!email) return null;
  const secreto = process.env.GATE_SECRET;
  if (!secreto) return firmaObligatoria() ? null : email;
  const uid = h.get("x-plural-user-id") ?? "";
  const rol = h.get("x-plural-user-role") ?? "";
  const ts = h.get("x-plural-user-ts") ?? "";
  const sig = h.get("x-plural-user-sig") ?? "";
  if (!ts || !(Math.abs(Date.now() - Number(ts)) <= VIGENCIA_FIRMA_MS)) return null;
  const esperada = Buffer.from(firmarIdentidad(secreto, email, uid, rol, ts));
  const dada = Buffer.from(sig);
  return esperada.length === dada.length && timingSafeEqual(esperada, dada) ? email : null;
}

/** Correo del usuario de esta request (o null: sin acceso). */
export function correoDe(h: Headers): string | null {
  let email = identidadFirmada(h)?.trim().toLowerCase() ?? "";
  if (!email && !firmaObligatoria()) email = process.env.DEV_USER_EMAIL?.trim().toLowerCase() ?? "";
  return email || null;
}

export async function accesoPorCorreo(email: string): Promise<Acceso> {
  const esPlural = esCorreoPlural(email);
  const orgs = esPlural
    ? []
    : await sql<OrgDeUsuario[]>`
        SELECT o.id, o.nombre, m.rol
        FROM org_members m JOIN orgs o ON o.id = m.org_id
        WHERE m.email = ${email}
        ORDER BY o.nombre
      `;
  return { email, esPlural, orgs: orgs.map((o) => ({ id: o.id, nombre: o.nombre, rol: o.rol })) };
}

/** Acceso de la request, o null si no hay identidad válida. */
export async function accesoDe(h: Headers): Promise<Acceso | null> {
  const email = correoDe(h);
  return email ? accesoPorCorreo(email) : null;
}

// ---------- permisos (puros: fáciles de probar) ----------

export const puedeVerOrg = (a: Acceso, orgId: string) =>
  a.esPlural || a.orgs.some((o) => o.id === orgId);

/** Borrar programas: el equipo Plural o un admin de la organización. */
export const puedeAdministrarOrg = (a: Acceso, orgId: string) =>
  a.esPlural || a.orgs.some((o) => o.id === orgId && o.rol === "admin");

/** Transcripciones (texto de los mensajes de las personas): solo el equipo Plural. */
export const puedeVerTranscripciones = (a: Acceso) => a.esPlural;

/** Ids de org visibles, o null = todas (equipo Plural). */
export const orgsVisibles = (a: Acceso): string[] | null =>
  a.esPlural ? null : a.orgs.map((o) => o.id);

export class SinPermisoError extends Error {
  constructor() {
    super("Sin permiso");
    this.name = "SinPermisoError";
  }
}
