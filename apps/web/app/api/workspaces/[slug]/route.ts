import { NextResponse } from "next/server";
import { z } from "zod";
import { updateWorkspace, deleteWorkspace, SlugTakenError } from "@/lib/data/workspaces";
import { noEncontrado, resolverWorkspace, sinPermiso } from "@/lib/api-acceso";
import { puedeAdministrarOrg } from "@/lib/auth";
import { removeWorkspaceUploads } from "@/lib/uploads";
import { slugify } from "@/lib/workspaces";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  return NextResponse.json({ workspace: r.workspace });
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  assistant_name: z.string().trim().min(1).max(100),
});

export async function PATCH(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const workspace = await updateWorkspace(
      slug,
      { ...parsed.data, slug: slugify(parsed.data.slug) },
      r.acceso
    );
    if (!workspace) return noEncontrado();
    return NextResponse.json({ workspace });
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  // Borrar un programa: solo un admin de la organización o el equipo Plural.
  if (!puedeAdministrarOrg(r.acceso, r.workspace.org_id)) {
    return sinPermiso("Solo quien administra la organización puede borrar un programa.");
  }
  const workspaceId = await deleteWorkspace(slug, r.acceso);
  if (!workspaceId) return noEncontrado();
  await removeWorkspaceUploads(workspaceId);
  return NextResponse.json({ ok: true });
}
