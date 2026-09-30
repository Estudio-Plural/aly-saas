// ── Envío por WhatsApp Cloud API ───────────────────────────────────────────
//
// PORTADO de `~/Dev/Aly/src/utils/metaCloudApi.ts` (Tranqui, producción desde
// el 2026-08-28). Solo texto de sesión: se contesta dentro de la ventana de 24 h
// que abre el propio mensaje de la persona. Sin plantillas.
//
// ⚠️ A un BSUID se le escribe con `recipient` y se OMITE `to` ("Do not pass a
// BSUID in `to`", doc de Meta; probado contra Graph el 2026-08-28).

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";

/** WhatsApp corta en 4096 caracteres; se deja margen. */
export const LIMITE_TEXTO = 4000;

export type SendResult = { ok: true; wamid: string } | { ok: false; error: string; code?: number };

export type EnviarTexto = (opts: {
  phoneNumberId: string;
  token: string;
  recipient: string;
  isBsuid: boolean;
  text: string;
  timeoutMs?: number;
}) => Promise<SendResult>;

/**
 * Manda un texto. `isBsuid` decide el campo del destinatario — no se infiere
 * del valor para que el llamador sea explícito. El token NUNCA se loguea.
 */
export const sendWhatsAppText: EnviarTexto = async (opts) => {
  const { phoneNumberId, token, recipient, isBsuid, text } = opts;
  if (!phoneNumberId || !token) return { ok: false, error: "falta phoneNumberId o token" };

  const destinatario = isBsuid ? { recipient } : { to: recipient };
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    ...destinatario,
    type: "text",
    text: { body: text },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) {
      return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}`, code: json?.error?.code };
    }
    const wamid = json?.messages?.[0]?.id;
    return wamid ? { ok: true, wamid } : { ok: false, error: "respuesta sin wamid" };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "timeout" : String(e?.message ?? e) };
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * La respuesta del engine viene en markdown y puede traer marcadores de
 * materiales (`[[adjunto:id]]`, que el chat web renderiza). En WhatsApp:
 * negrita con un asterisco, sin encabezados, y los adjuntos se omiten (el envío
 * de materiales por WhatsApp queda pendiente).
 */
export function aFormatoWhatsApp(texto: string): string {
  return texto
    .replace(/\[\[adjunto:[^\]]+\]\]/g, "")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "*$1*")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parte un texto largo en burbujas, cortando en saltos de línea cuando se puede. */
export function partirTexto(texto: string, limite = LIMITE_TEXTO): string[] {
  const partes: string[] = [];
  let resto = texto.trim();
  while (resto.length > limite) {
    let corte = resto.lastIndexOf("\n", limite);
    if (corte < limite / 2) corte = resto.lastIndexOf(" ", limite);
    if (corte < limite / 2) corte = limite;
    partes.push(resto.slice(0, corte).trim());
    resto = resto.slice(corte).trim();
  }
  if (resto) partes.push(resto);
  return partes;
}
