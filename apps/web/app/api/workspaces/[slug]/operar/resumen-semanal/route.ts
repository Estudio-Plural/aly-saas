import { NextResponse } from "next/server";
import { resolverWorkspace } from "@/lib/api-acceso";
import { construirExcelSemana } from "@/lib/data/operar";

type Params = { params: Promise<{ slug: string }> };

// Excel del resumen de la última semana completa. Solo cifras agregadas: se
// puede descargar con cualquier rol.
export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;
  const { bytes, filename } = await construirExcelSemana(workspace);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${workspace.slug}-${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
