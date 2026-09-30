import { NextResponse } from "next/server";
import { z } from "zod";
import { resolverAcceso, noEncontrado } from "@/lib/api-acceso";
import { removeOrgMember, upsertOrgMember } from "@/lib/data/orgs";

type Params = { params: Promise<{ id: string }> };

const memberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  rol: z.enum(["admin", "miembro"]).default("miembro"),
});

export async function POST(request: Request, { params }: Params) {
  const r = await resolverAcceso(request);
  if (!r.ok) return r.respuesta;
  if (!r.acceso.esPlural) return noEncontrado();
  const { id } = await params;
  const parsed = memberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  }
  const ok = await upsertOrgMember(r.acceso, id, parsed.data.email, parsed.data.rol);
  if (!ok) return NextResponse.json({ error: "Esa organización no existe." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const r = await resolverAcceso(request);
  if (!r.ok) return r.respuesta;
  if (!r.acceso.esPlural) return noEncontrado();
  const { id } = await params;
  const email = new URL(request.url).searchParams.get("email") ?? "";
  const ok = await removeOrgMember(r.acceso, id, email);
  if (!ok) return NextResponse.json({ error: "Ese correo no estaba en la organización." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
