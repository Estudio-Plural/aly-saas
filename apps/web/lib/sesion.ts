// Acceso en páginas y layouts (server components) — solo servidor.
// Las rutas de API usan lib/api-acceso.ts; esto es lo mismo con headers() de Next.
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { accesoDe, type Acceso } from "@/lib/auth";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import type { Workspace } from "@/lib/workspaces";

export async function accesoActual(): Promise<Acceso | null> {
  return accesoDe(await headers());
}

/** Sin identidad válida → /sin-acceso. */
export async function exigirAcceso(): Promise<Acceso> {
  const acceso = await accesoActual();
  if (!acceso) redirect("/sin-acceso");
  return acceso;
}

/** El programa del slug si es de una organización del usuario; si no, 404 (no revela que existe). */
export async function workspaceDePagina(
  slug: string
): Promise<{ acceso: Acceso; workspace: Workspace }> {
  const acceso = await exigirAcceso();
  const workspace = await getWorkspaceBySlug(slug, acceso);
  if (!workspace) notFound();
  return { acceso, workspace };
}
