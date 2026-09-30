import { NextResponse } from "next/server";
import { getWorkspaceBySlug } from "@/lib/data/workspaces";
import { construirExcelSemana } from "@/lib/data/operar";

type Params = { params: Promise<{ slug: string }> };

// Excel del resumen de la última semana completa. Solo cifras agregadas: se
// puede descargar con cualquier rol.
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado" }, { status: 404 });
  }
  const { bytes, filename } = await construirExcelSemana(workspace);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${workspace.slug}-${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
