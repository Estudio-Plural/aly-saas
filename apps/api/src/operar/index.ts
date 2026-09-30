// Operar: reporte semanal (cifras agregadas sin PII) por correo o para descargar.
import { mailerFromEnv } from "../mailer";
import { sqlWeeklyStore } from "./store";
import { runWeeklyReports, weeklySettingsFromEnv, type WeeklyReport } from "./weekly";

export * from "./weekly";

let running = false;

/** Corrida con la DB y el SMTP del entorno. Dos corridas no se pisan. */
export async function runWeeklyReportsFromEnv(): Promise<WeeklyReport | { ran: false; reason: "already_running" }> {
  if (running) return { ran: false, reason: "already_running" };
  running = true;
  try {
    const report = await runWeeklyReports(weeklySettingsFromEnv(), {
      store: sqlWeeklyStore,
      mailer: await mailerFromEnv(),
    });
    const sent = report.results.filter((r) => r.outcome === "sent").length;
    if (report.results.length) {
      console.log(`[reporte] semana ${report.weekStart}: ${sent}/${report.results.length} enviados`);
    }
    return report;
  } finally {
    running = false;
  }
}

/** Revisión periódica (WEEKLY_REPORT_INTERVAL_MINUTES > 0). Idempotente por semana. */
export function startWeeklyReportInterval(
  env: Record<string, string | undefined> = process.env,
): ReturnType<typeof setInterval> | null {
  const minutes = Number(env.WEEKLY_REPORT_INTERVAL_MINUTES ?? 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const timer = setInterval(() => {
    runWeeklyReportsFromEnv().catch((error) => console.error("[reporte] Corrida fallida:", error));
  }, minutes * 60_000);
  timer.unref?.();
  console.log(`[reporte] revisión del reporte semanal cada ${minutes} min`);
  return timer;
}
