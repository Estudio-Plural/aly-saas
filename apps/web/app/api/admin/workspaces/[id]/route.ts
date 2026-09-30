import { NextResponse } from "next/server";
import { z } from "zod";
import { resolverAcceso, noEncontrado } from "@/lib/api-acceso";
import { assignWorkspaceOrg } from "@/lib/data/workspaces";
import { listOrgs } from "@/lib/data/orgs";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ org_id: z.string().trim().min(1).max(80) });

/** Mueve un programa a otra organización. Solo el equipo Plural. */
export async function PATCH(request: Request, { params }: Params) {
  const r = await resolverAcceso(request);
  if (!r.ok) return r.respuesta;
  if (!r.acceso.esPlural) return noEncontrado();
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Elige una organización." }, { status: 400 });
  const orgs = await listOrgs(r.acceso);
  if (!orgs.some((o) => o.id === parsed.data.org_id)) {
    return NextResponse.json({ error: "Esa organización no existe." }, { status: 404 });
  }
  if (!z.uuid().safeParse(id).success) return noEncontrado();
  const ok = await assignWorkspaceOrg(id, parsed.data.org_id, r.acceso);
  return ok ? NextResponse.json({ ok: true }) : noEncontrado();
}
