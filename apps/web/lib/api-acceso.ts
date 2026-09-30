// Acceso en los route handlers (app/api/**) — solo servidor.
// Toda ruta empieza por acá: sin identidad válida → 401; programa de otra organización (o
// inexistente) → 404, sin distinguir, para no revelar que existe.
import { NextResponse } from "next/server";
import { accesoDe, type Acceso } from "@/lib/auth";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import type { Workspace } from "@/lib/workspaces";

export const sinSesion = () =>
  NextResponse.json({ error: "Tu sesión no es válida. Vuelve a entrar." }, { status: 401 });

export const noEncontrado = () =>
  NextResponse.json({ error: "Programa no encontrado" }, { status: 404 });

export const sinPermiso = (error = "No tienes permiso para hacer esto.") =>
  NextResponse.json({ error }, { status: 403 });

type Resultado<T> = ({ ok: true } & T) | { ok: false; respuesta: NextResponse };

export async function resolverAcceso(request: Request): Promise<Resultado<{ acceso: Acceso }>> {
  const acceso = await accesoDe(request.headers);
  return acceso ? { ok: true, acceso } : { ok: false, respuesta: sinSesion() };
}

export async function resolverWorkspace(
  request: Request,
  slug: string
): Promise<Resultado<{ acceso: Acceso; workspace: Workspace }>> {
  const acceso = await accesoDe(request.headers);
  if (!acceso) return { ok: false, respuesta: sinSesion() };
  const workspace = await getWorkspaceBySlug(slug, acceso);
  if (!workspace) return { ok: false, respuesta: noEncontrado() };
  return { ok: true, acceso, workspace };
}
