// Corre el banco de casos difíciles contra el engine (efímero) y guarda la corrida.
import { NextResponse } from "next/server";
import { resolverWorkspace } from "@/lib/api-acceso";
import { correrCasos } from "@/lib/data/casos";

type Params = { params: Promise<{ slug: string }> };

// Cada caso es un turno completo del engine: puede tardar.
export const maxDuration = 300;

export async function POST(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const corrida = await correrCasos(r.workspace, r.acceso.email);
  if (corrida.resultados.every((res) => res.error)) {
    return NextResponse.json(
      { error: "El asistente no respondió ningún caso. Revisa que el engine esté encendido.", corrida },
      { status: 502 },
    );
  }
  return NextResponse.json({ corrida });
}
