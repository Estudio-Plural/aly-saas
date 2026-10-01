import { NextResponse } from "next/server";
import { z } from "zod";
import { resolverAcceso, noEncontrado } from "@/lib/api-acceso";
import { createOrg, listOrgsDetalle, OrgExisteError, SeAdministraEnElPortalError } from "@/lib/data/orgs";

// Administración de organizaciones: solo el equipo Plural. A un cliente se le responde 404
// (no hace falta que sepa que esto existe).

export async function GET(request: Request) {
  const r = await resolverAcceso(request);
  if (!r.ok) return r.respuesta;
  if (!r.acceso.esPlural) return noEncontrado();
  return NextResponse.json({ orgs: await listOrgsDetalle(r.acceso) });
}

const createSchema = z.object({ nombre: z.string().trim().min(2).max(120) });

export async function POST(request: Request) {
  const r = await resolverAcceso(request);
  if (!r.ok) return r.respuesta;
  if (!r.acceso.esPlural) return noEncontrado();
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe el nombre de la organización." }, { status: 400 });
  }
  try {
    const org = await createOrg(r.acceso, parsed.data.nombre);
    return NextResponse.json({ org }, { status: 201 });
  } catch (error) {
    if (error instanceof OrgExisteError || error instanceof SeAdministraEnElPortalError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Escribe un nombre con letras o números." }, { status: 400 });
  }
}
