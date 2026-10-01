import { resolverWorkspace } from "@/lib/api-acceso";
import { construirExcelSemana } from "@/lib/data/operar";
import { MESES } from "@aly-saas/operar";

type Params = { params: Promise<{ slug: string }> };

/**
 * Nombre legible del archivo: «Resumen semanal - Cuidar a quien cuida - 22 a 28 septiembre 2026.xlsx».
 * Sale del lunes YYYY-MM-DD que trae el nombre técnico; si no lo encuentra, va sin fechas.
 */
function nombreArchivo(programa: string, tecnico: string): string {
  const limpio = programa.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  const base = `Resumen semanal - ${limpio || "tu programa"}`;
  const m = tecnico.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return `${base}.xlsx`;
  const desde = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const hasta = new Date(desde.getTime() + 6 * 86_400_000);
  const mesDesde = MESES[desde.getUTCMonth()];
  const mesHasta = MESES[hasta.getUTCMonth()];
  const rango =
    desde.getUTCFullYear() !== hasta.getUTCFullYear()
      ? `${desde.getUTCDate()} ${mesDesde} ${desde.getUTCFullYear()} a ${hasta.getUTCDate()} ${mesHasta} ${hasta.getUTCFullYear()}`
      : mesDesde !== mesHasta
        ? `${desde.getUTCDate()} ${mesDesde} a ${hasta.getUTCDate()} ${mesHasta} ${hasta.getUTCFullYear()}`
        : `${desde.getUTCDate()} a ${hasta.getUTCDate()} ${mesHasta} ${hasta.getUTCFullYear()}`;
  return `${base} - ${rango}.xlsx`;
}

// Excel del resumen de la última semana completa. Solo cifras agregadas: se
// puede descargar con cualquier rol.
export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const r = await resolverWorkspace(request, slug);
  if (!r.ok) return r.respuesta;
  const { workspace } = r;
  const { bytes, filename } = await construirExcelSemana(workspace);
  const nombre = nombreArchivo(workspace.name, filename);
  // Respaldo ASCII para navegadores viejos; los actuales usan filename* (UTF-8).
  const ascii = nombre.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "no-store",
    },
  });
}
