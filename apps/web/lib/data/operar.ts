// Operar — solo servidor. Cifras agregadas (sin PII) con el mismo código que
// usa el reporte semanal del engine (@aly-saas/operar), protocolo ante riesgo
// y estado del último reporte.
import { sql } from "@/lib/db";
import {
  calcularCifras,
  construirExcelReporte,
  construirReporte,
  DEFAULT_TIMEZONE,
  fechaLocal,
  hayConversacionesReales,
  leerDatosCifras,
  semanaAnterior,
  semanaPrevia,
  ultimosDias,
  type Cifras,
  type Periodo,
  type SqlTag,
} from "@aly-saas/operar";
import type { AlertChannel, AlertProtocol, PeriodoKey } from "@/lib/operar";

const TZ = process.env.PROGRAM_TIMEZONE || DEFAULT_TIMEZONE;
const db = sql as unknown as SqlTag;

function periodoDe(key: PeriodoKey, now = new Date()): Periodo {
  if (key === "todo") return { desde: new Date("2000-01-01T00:00:00Z"), hasta: now };
  return ultimosDias(now, Number(key), TZ);
}

export interface CifrasOperar {
  hayReales: boolean;
  cifras: Cifras;
}

export async function getCifras(workspaceId: string, periodoKey: PeriodoKey): Promise<CifrasOperar> {
  const periodo = periodoDe(periodoKey);
  const [hayReales, datos] = await Promise.all([
    hayConversacionesReales(db, workspaceId),
    leerDatosCifras(db, workspaceId, periodo),
  ]);
  return { hayReales, cifras: calcularCifras({ ...datos, periodo, tz: TZ }) };
}

type ProtocolRow = {
  responsible_name: string | null;
  channel: AlertChannel | null;
  channel_target: string | null;
  response_time_hours: number | null;
  active: boolean;
  updated_at: Date;
};

export async function getAlertProtocol(workspaceId: string): Promise<AlertProtocol | null> {
  const rows = await sql<ProtocolRow[]>`
    SELECT responsible_name, channel, channel_target, response_time_hours, active, updated_at
    FROM alert_protocols WHERE workspace_id = ${workspaceId}
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    responsibleName: r.responsible_name ?? "",
    channel: r.channel,
    channelTarget: r.channel_target ?? "",
    responseTimeHours: r.response_time_hours,
    active: r.active,
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function saveAlertProtocol(
  workspaceId: string,
  p: Omit<AlertProtocol, "updatedAt">,
  updatedBy: string
): Promise<AlertProtocol> {
  const nullIfEmpty = (s: string) => (s.trim() ? s.trim() : null);
  await sql`
    INSERT INTO alert_protocols
      (workspace_id, responsible_name, channel, channel_target, response_time_hours, active, updated_by, updated_at)
    VALUES
      (${workspaceId}, ${nullIfEmpty(p.responsibleName)}, ${p.channel}, ${nullIfEmpty(p.channelTarget)},
       ${p.responseTimeHours}, ${p.active}, ${updatedBy}, NOW())
    ON CONFLICT (workspace_id) DO UPDATE SET
      responsible_name = EXCLUDED.responsible_name,
      channel = EXCLUDED.channel,
      channel_target = EXCLUDED.channel_target,
      response_time_hours = EXCLUDED.response_time_hours,
      active = EXCLUDED.active,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `;
  return (await getAlertProtocol(workspaceId))!;
}

export interface EstadoReporte {
  semana: string; // lunes, YYYY-MM-DD
  status: "generated" | "sent" | "failed" | null;
  recipientsCount: number;
  sentAt: string | null;
}

/** Estado del reporte de la última semana completa (lo escribe el engine). */
export async function getEstadoReporte(workspaceId: string, now = new Date()): Promise<EstadoReporte> {
  const semana = fechaLocal(semanaAnterior(now, TZ).desde, TZ);
  const rows = await sql<{ status: EstadoReporte["status"]; recipients_count: number; sent_at: Date | null }[]>`
    SELECT status, recipients_count, sent_at FROM weekly_reports
    WHERE workspace_id = ${workspaceId} AND week_start = ${semana}
  `;
  const r = rows[0];
  return {
    semana,
    status: r?.status ?? null,
    recipientsCount: r?.recipients_count ?? 0,
    sentAt: r?.sent_at?.toISOString() ?? null,
  };
}

/** Excel del resumen de la última semana completa: mismo código que el correo del engine. */
export async function construirExcelSemana(
  workspace: { id: string; name: string },
  now = new Date()
): Promise<{ bytes: Uint8Array; filename: string }> {
  const semana = semanaAnterior(now, TZ);
  const previa = semanaPrevia(semana, TZ);
  const [actual, anterior, protocolo] = await Promise.all([
    leerDatosCifras(db, workspace.id, semana),
    leerDatosCifras(db, workspace.id, previa),
    getAlertProtocol(workspace.id),
  ]);
  const reporte = construirReporte({
    programa: workspace.name,
    semana,
    actual: calcularCifras({ ...actual, periodo: semana, tz: TZ }),
    anterior: calcularCifras({ ...anterior, periodo: previa, tz: TZ }),
    protocoloActivo: protocolo?.active === true,
    tz: TZ,
  });
  return {
    bytes: construirExcelReporte(reporte, TZ),
    filename: `resumen-semanal-${fechaLocal(semana.desde, TZ)}.xlsx`,
  };
}
