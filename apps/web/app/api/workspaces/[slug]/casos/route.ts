// «Probar» — banco de casos difíciles: los casos (fijos + propios), la última corrida y
// el costo estimado de correrlos. POST agrega un caso propio.
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolverWorkspace } from "@/lib/api-acceso";
import {
  DemasiadosCasosError,
  addCasoPropio,
  getEstimado,
  getUltimaCorrida,
  listCasos,
} from "@/lib/data/casos";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const casos = await listCasos(r.workspace.id);
  const [ultimaCorrida, estimado] = await Promise.all([
    getUltimaCorrida(r.workspace.id),
    getEstimado(r.workspace.id, casos),
  ]);
  return NextResponse.json({ casos, ultimaCorrida, estimado });
}

const postSchema = z.object({ mensaje: z.string().trim().min(1).max(1000) });

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe el mensaje de prueba (hasta 1000 caracteres)." }, { status: 400 });
  }
  try {
    await addCasoPropio(r.workspace.id, parsed.data.mensaje, r.acceso.email);
  } catch (error) {
    if (error instanceof DemasiadosCasosError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  const casos = await listCasos(r.workspace.id);
  return NextResponse.json({ casos, estimado: await getEstimado(r.workspace.id, casos) }, { status: 201 });
}
