// Borra un caso propio (los fijos no se borran: viven en código).
import { NextResponse } from "next/server";
import { resolverWorkspace } from "@/lib/api-acceso";
import { deleteCasoPropio, getEstimado, listCasos } from "@/lib/data/casos";

type Params = { params: Promise<{ slug: string; id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const { slug, id } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  if (!(await deleteCasoPropio(r.workspace.id, id))) {
    return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
  }
  const casos = await listCasos(r.workspace.id);
  return NextResponse.json({ casos, estimado: await getEstimado(r.workspace.id, casos) });
}
