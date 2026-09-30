// Notificación de alertas HIGH al equipo. Solo metadatos: workspace,
// conversación, regla y severidad. NUNCA texto de mensajes, fragmentos de
// evidencia ni el detalle del LLM — los usuarios pueden ser menores (AMA,
// Apapáchar) y Telegram es un canal fuera de nuestra DB.
//
// Canal: Telegram si hay token + chat (TELEGRAM_ALERTS_* o, si no, los
// TELEGRAM_ERROR_* del .env.example); si no, log. Nunca lanza: una
// notificación caída no debe frenar el análisis.

import type { AlertNotifier, HighAlert } from "./types";

/** Texto de la alerta. Solo usa campos de HighAlert (que no trae texto de usuario). */
export function formatAlertMessage(alert: HighAlert): string {
  return [
    `🚨 Alerta ${alert.severity}`,
    `Workspace: ${alert.workspaceSlug}`,
    `Conversación: ${alert.conversationId}`,
    `Regla [${alert.ruleId}]: ${alert.ruleDescription}`,
    `Revisala en Conversaciones.`,
  ].join("\n");
}

export const logNotifier: AlertNotifier = {
  async notify(alert) {
    console.warn(`[supervisor] ${formatAlertMessage(alert).replace(/\n/g, " | ")}`);
  },
};

export function telegramNotifier(
  token: string,
  chatId: string,
  fetchImpl: typeof fetch = fetch,
): AlertNotifier {
  return {
    async notify(alert) {
      try {
        const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: formatAlertMessage(alert),
            disable_web_page_preview: true,
          }),
        });
        if (!res.ok) throw new Error(`Telegram ${res.status}`);
      } catch (error) {
        console.error("[supervisor] No se pudo notificar por Telegram:", error);
        await logNotifier.notify(alert);
      }
    },
  };
}

/** Elige el canal según el entorno. */
export function notifierFromEnv(env: Record<string, string | undefined> = process.env): AlertNotifier {
  const token = env.TELEGRAM_ALERTS_BOT_TOKEN || env.TELEGRAM_ERROR_BOT_TOKEN;
  const chatId = env.TELEGRAM_ALERTS_CHAT_ID || env.TELEGRAM_ERROR_CHAT_ID;
  return token && chatId ? telegramNotifier(token, chatId) : logNotifier;
}
