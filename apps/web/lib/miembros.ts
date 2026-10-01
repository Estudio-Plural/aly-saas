// Espejo de los miembros del portal en org_members (packages/miembros) — solo servidor.
// Un sincronizador por proceso: se reusa entre hot-reloads como el cliente de la base.
import { configPortal, crearSincronizador } from "@aly-saas/miembros";
import { sql } from "@/lib/db";

const globalForSync = globalThis as unknown as {
  sincronizadorMiembros?: ReturnType<typeof crearSincronizador>;
};

export const sincronizadorMiembros =
  globalForSync.sincronizadorMiembros ?? crearSincronizador(sql, configPortal());
if (process.env.NODE_ENV !== "production") globalForSync.sincronizadorMiembros = sincronizadorMiembros;

/** ¿Quién entra lo decide el portal? (Con la sincronización apagada, /admin edita a mano.) */
export const miembrosDelPortal = () => sincronizadorMiembros.activo;

/**
 * Trae los cambios del portal. Si el portal no responde, se sigue con el último espejo:
 * la puerta ya consultó al portal para dejar entrar a esta persona.
 */
export async function sincronizarMiembros(opts: { forzar?: boolean } = {}): Promise<boolean> {
  try {
    await sincronizadorMiembros.sincronizar(opts);
    return true;
  } catch (error) {
    console.warn("[miembros] no se pudo leer el portal:", error instanceof Error ? error.message : error);
    return false;
  }
}
