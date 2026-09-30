import { NextResponse } from "next/server";
import { z } from "zod";
import { listWorkspaces, createWorkspace, SlugTakenError } from "@/lib/data/workspaces";
import { resolverAcceso, sinPermiso } from "@/lib/api-acceso";
import { puedeVerOrg, SinPermisoError } from "@/lib/auth";
import { slugify } from "@/lib/workspaces";

/** Organización del equipo para los programas de prueba (migración 011). */
const ORG_DEMO = "plural-demo";

export async function GET(request: Request) {
  const r = await resolverAcceso(request);
  if (!r.ok) return r.respuesta;
  const org = new URL(request.url).searchParams.get("org") ?? undefined;
  const workspaces = await listWorkspaces(r.acceso, org);
  return NextResponse.json({ workspaces });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(100).optional(),
  assistant_name: z.string().trim().max(100).optional(),
  org_id: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const r = await resolverAcceso(request);
  if (!r.ok) return r.respuesta;
  const { acceso } = r;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { name } = parsed.data;
  const slug = slugify(parsed.data.slug || name);
  const assistant_name = parsed.data.assistant_name || "Aly";
  // Sin org explícita: la única del cliente, o la de pruebas del equipo Plural.
  const org_id =
    parsed.data.org_id ??
    (acceso.esPlural ? ORG_DEMO : acceso.orgs.length === 1 ? acceso.orgs[0].id : null);
  if (!org_id) {
    return NextResponse.json({ error: "Elige la organización del programa." }, { status: 400 });
  }
  if (!puedeVerOrg(acceso, org_id)) return sinPermiso();

  try {
    const workspace = await createWorkspace({ name, slug, assistant_name, org_id }, acceso);
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SinPermisoError) return sinPermiso();
    throw error;
  }
}
