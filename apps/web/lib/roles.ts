// Roles del panel: "plural" (equipo de Estudio Plural, conecta y opera) vs
// "cliente" (la organización: ve estado y cifras, no transcripciones).
//
// TOLERANTE a propósito: la autenticación la construye otro carril (Acceso) en
// paralelo. Este helper acepta el usuario que ese carril termine exponiendo
// (con `rol`/`role`/`email`) y, mientras no exista, asume "plural" SOLO en
// desarrollo. En producción sin usuario nunca se asume plural.
//
// Override para revisar la otra vista: ALY_VISTA_ROL=cliente | plural.

export type UsuarioConRol =
  | {
      rol?: string | null;
      role?: string | null;
      email?: string | null;
    }
  | null
  | undefined;

const DOMINIOS_PLURAL = ["estudio-plural.co", "plural-estudio.co"];

export function esPlural(usuario: UsuarioConRol): boolean {
  const forzado = process.env.ALY_VISTA_ROL;
  if (forzado === "cliente") return false;
  if (forzado === "plural") return true;

  if (!usuario) return process.env.NODE_ENV !== "production";

  const rol = (usuario.rol ?? usuario.role ?? "").toLowerCase();
  if (rol) return rol === "plural" || rol === "superadmin";

  const dominio = usuario.email?.split("@")[1]?.toLowerCase();
  return !!dominio && DOMINIOS_PLURAL.includes(dominio);
}
