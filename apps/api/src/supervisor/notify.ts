// Notificación de alertas HIGH: siempre al equipo de Plural y, solo si la
// organización tiene un protocolo ante riesgo activo, también a quien el
// protocolo designa (correo, Telegram o WhatsApp del equipo). Solo metadatos: workspace,
// conversación, regla y severidad. NUNCA texto de mensajes, fragmentos de
// evidencia ni el detalle del LLM — los usuarios pueden ser menores (AMA,
// Apapáchar) y Telegram es un canal fuera de nuestra DB.
//
// Canal: Telegram si hay token + chat (TELEGRAM_ALERTS_* o, si no, los
// TELEGRAM_ERROR_* del .env.example); si no, log. Nunca lanza: una
// notificación caída no debe frenar el análisis.

import type { Mailer } from "../mailer";
import type { ActiveAlertProtocol, AlertNotifier, HighAlert, OrgAlertNotifier } from "./types";

/** Texto de la alerta para Plural. Solo usa campos de HighAlert (que no trae texto de usuario). */
export function formatAlertMessage(alert: HighAlert): string {
  return [
    `🚨 Alerta ${alert.severity}`,
    `Workspace: ${alert.workspaceSlug}`,
    `Conversación: ${alert.conversationId}`,
    `Regla [${alert.ruleId}]: ${alert.ruleDescription}`,
    alert.orgProtocolActive
      ? `La organización tiene protocolo activo: también se le avisó.`
      : `La organización no tiene protocolo ante riesgo: la revisa el equipo de Plural.`,
    `Revísala en Conversaciones.`,
  ].join("\n");
}

/** Texto de la alerta para la organización (sin texto de mensajes ni detalle). */
export function formatOrgAlertMessage(alert: HighAlert, protocol: ActiveAlertProtocol): string {
  return [
    `Alerta de riesgo en tu asistente (${alert.workspaceSlug})`,
    `Regla: ${alert.ruleDescription}`,
    `Conversación: ${alert.conversationId}`,
    `Responsable según tu protocolo: ${protocol.responsibleName}.`,
    `Tiempo de respuesta comprometido: ${protocol.responseTimeHours} h.`,
    `Este aviso no incluye mensajes de la persona. Si necesitas contexto, escribe a hola@estudio-plural.co.`,
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

async function sendTelegram(token: string, chatId: string, text: string, fetchImpl: typeof fetch) {
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}`);
}

export interface OrgNotifierDeps {
  mailer: Mailer | null;
  /** Bot de Telegram con el que se escribe al chat del equipo de la organización. */
  telegramToken?: string | null;
  fetchImpl?: typeof fetch;
}

/**
 * Aviso a la organización por el canal de su protocolo. Nunca lanza: si el
 * canal falla queda en el log (Plural ya recibió su aviso por separado).
 */
export function orgNotifier({ mailer, telegramToken, fetchImpl = fetch }: OrgNotifierDeps): OrgAlertNotifier {
  return {
    async notify(alert, protocol) {
      const text = formatOrgAlertMessage(alert, protocol);
      try {
        if (protocol.channel === "email") {
          if (!mailer) throw new Error("sin SMTP configurado");
          await mailer.send({ to: [protocol.channelTarget], subject: "Alerta de riesgo en tu asistente", text });
        } else if (protocol.channel === "telegram") {
          if (!telegramToken) throw new Error("sin bot de Telegram configurado");
          await sendTelegram(telegramToken, protocol.channelTarget, text, fetchImpl);
        } else {
          // WhatsApp del equipo: llega con la integración de Kapso.
          throw new Error("envío por WhatsApp pendiente (integración Kapso)");
        }
      } catch (error) {
        console.error(
          `[supervisor] No se pudo avisar a la organización ${alert.workspaceSlug} por ${protocol.channel}:`,
          error instanceof Error ? error.message : error,
        );
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
