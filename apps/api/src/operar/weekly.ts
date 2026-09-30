// Reporte semanal de Operar. Para cada workspace, la última semana completa
// (lunes a domingo, hora del programa): cifras agregadas + variación contra la
// semana anterior + temas. Si hay SMTP y miembros con correo, se manda por
// correo con el Excel adjunto; si no, queda registrado y se descarga desde
// Operar («Descargar resumen de la semana»), que arma el mismo Excel.
//
// Idempotente: una fila por workspace y semana en weekly_reports; lo ya
// enviado no se reenvía. Sin PII: el reporte sale de `calcularCifras`, que no
// devuelve identificadores ni texto. Sin LLM: las cifras y el texto los arma
// el código.

import {
  calcularCifras,
  construirExcelReporte,
  construirReporte,
  DEFAULT_TIMEZONE,
  fechaLocal,
  semanaAnterior,
  semanaPrevia,
  type DatosCifras,
  type Periodo,
} from "@aly-saas/operar";
import type { Mailer } from "../mailer";

export interface WorkspaceRef {
  id: string;
  slug: string;
  name: string;
}

export type WeeklyStatus = "generated" | "sent" | "failed";

export interface WeeklyStore {
  listWorkspaces(): Promise<WorkspaceRef[]>;
  leerDatos(workspaceId: string, periodo: Periodo): Promise<DatosCifras>;
  protocoloActivo(workspaceId: string): Promise<boolean>;
  destinatarios(workspaceId: string): Promise<string[]>;
  getRun(workspaceId: string, weekStart: string): Promise<{ status: WeeklyStatus } | null>;
  saveRun(run: {
    workspaceId: string;
    weekStart: string;
    summary: unknown;
    status: WeeklyStatus;
    recipientsCount: number;
  }): Promise<void>;
}

export interface WeeklyDeps {
  store: WeeklyStore;
  mailer: Mailer | null;
}

export interface WeeklySettings {
  now: Date;
  tz: string;
  /** Base del panel para el link del correo (PANEL_URL). */
  panelUrl?: string | null;
}

export type WeeklyOutcome =
  | "sent"
  | "generated" // sin SMTP o sin destinatarios: queda para descargar
  | "empty" // semana sin conversaciones reales: no se manda correo
  | "already_sent"
  | "already_generated"
  | "failed";

export interface WeeklyReport {
  weekStart: string;
  results: { workspaceSlug: string; outcome: WeeklyOutcome; recipients: number }[];
}

export function weeklySettingsFromEnv(
  env: Record<string, string | undefined> = process.env,
  now: Date = new Date(),
): WeeklySettings {
  return { now, tz: env.PROGRAM_TIMEZONE || DEFAULT_TIMEZONE, panelUrl: env.PANEL_URL || null };
}

export async function runWeeklyReports(settings: WeeklySettings, deps: WeeklyDeps): Promise<WeeklyReport> {
  const { tz } = settings;
  const semana = semanaAnterior(settings.now, tz);
  const previa = semanaPrevia(semana, tz);
  const weekStart = fechaLocal(semana.desde, tz);
  const report: WeeklyReport = { weekStart, results: [] };

  for (const ws of await deps.store.listWorkspaces()) {
    const push = (outcome: WeeklyOutcome, recipients = 0) =>
      report.results.push({ workspaceSlug: ws.slug, outcome, recipients });
    try {
      const prev = await deps.store.getRun(ws.id, weekStart);
      if (prev?.status === "sent") {
        push("already_sent");
        continue;
      }
      if (prev && !deps.mailer) {
        push("already_generated");
        continue;
      }

      const [datosActual, datosAnterior, protocoloActivo] = await Promise.all([
        deps.store.leerDatos(ws.id, semana),
        deps.store.leerDatos(ws.id, previa),
        deps.store.protocoloActivo(ws.id),
      ]);
      const reporte = construirReporte({
        programa: ws.name,
        semana,
        actual: calcularCifras({ ...datosActual, periodo: semana, tz }),
        anterior: calcularCifras({ ...datosAnterior, periodo: previa, tz }),
        protocoloActivo,
        panelUrl: settings.panelUrl ? `${settings.panelUrl.replace(/\/$/, "")}/${ws.slug}/operar` : null,
        tz,
      });
      const base = { workspaceId: ws.id, weekStart, summary: reporte.resumen };

      if (reporte.resumen.actual.conversaciones === 0) {
        await deps.store.saveRun({ ...base, status: "generated", recipientsCount: 0 });
        push("empty");
        continue;
      }

      const destinatarios = deps.mailer ? await deps.store.destinatarios(ws.id) : [];
      if (!deps.mailer || destinatarios.length === 0) {
        await deps.store.saveRun({ ...base, status: "generated", recipientsCount: 0 });
        push("generated");
        continue;
      }

      try {
        await deps.mailer.send({
          to: destinatarios,
          subject: reporte.asunto,
          text: reporte.texto,
          html: reporte.html,
          attachments: [
            {
              filename: `resumen-semanal-${ws.slug}-${weekStart}.xlsx`,
              content: construirExcelReporte(reporte, tz),
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          ],
        });
        await deps.store.saveRun({ ...base, status: "sent", recipientsCount: destinatarios.length });
        push("sent", destinatarios.length);
      } catch (error) {
        console.error(
          `[reporte] No se pudo mandar el reporte de ${ws.slug}:`,
          error instanceof Error ? error.message : error,
        );
        await deps.store.saveRun({ ...base, status: "failed", recipientsCount: 0 });
        push("failed");
      }
    } catch (error) {
      console.error(`[reporte] Falló el reporte de ${ws.slug}:`, error instanceof Error ? error.message : error);
      push("failed");
    }
  }
  return report;
}
