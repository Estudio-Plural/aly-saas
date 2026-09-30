// ── Webhook de Meta: firma, identidad del remitente y extracción ───────────
//
// PORTADO de `~/Dev/Aly/src/utils/metaWebhook.ts` (que a su vez viene de
// Tranqui, en producción desde el 2026-08-28). Módulo puro: sin base ni red.
//
// Por qué BSUID importa: Meta está desplegando Business-Scoped User IDs y para
// un usuario con username el webhook llega SIN teléfono (`from_user_id` /
// `contacts[].user_id` en vez de `from` / `wa_id`). Adivinar el destinatario en
// ese caso es exactamente el bug que obligó a sacar a Evolution del camino en
// Aly: la respuesta le llegaba a OTRA persona. Acá se clasifica por contenido y
// ante la duda se falla cerrado.

import { createHmac, timingSafeEqual } from "crypto";

/** ISO alpha-2 + "." + hasta 128 alfanuméricos (formato documentado por Meta). */
const BSUID_RE = /^[A-Z]{2}\.[A-Za-z0-9]{1,128}$/;
/** E.164 sin "+": el máximo son 15 dígitos. */
const PHONE_RE = /^\d{7,15}$/;

export type SenderId =
  | { kind: "phone"; phone: string; bsuid?: string }
  | { kind: "bsuid"; bsuid: string }
  | { kind: "ambiguous"; reason: string };

/**
 * Clasifica POR CONTENIDO, no por ausencia: Meta anunció que `wa_id`/`from`
 * van a poder traer un BSUID. Dos identidades del mismo tipo que no coinciden
 * → ambiguo (no se adivina).
 */
export function classifySender(message: any, contact?: any): SenderId {
  const crudos = [message?.from, message?.from_user_id, contact?.wa_id, contact?.user_id].filter(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );

  const phones = [...new Set(crudos.filter((v) => PHONE_RE.test(v)))];
  const bsuids = [...new Set(crudos.filter((v) => BSUID_RE.test(v)))];

  if (phones.length > 1) return { kind: "ambiguous", reason: `${phones.length} teléfonos distintos` };
  if (bsuids.length > 1) return { kind: "ambiguous", reason: `${bsuids.length} BSUID distintos` };
  // El teléfono gana: es estable y legible; el BSUID puede cambiar
  // (evento `user_changed_user_id`).
  if (phones.length === 1) return { kind: "phone", phone: phones[0]!, bsuid: bsuids[0] };
  if (bsuids.length === 1) return { kind: "bsuid", bsuid: bsuids[0]! };
  return { kind: "ambiguous", reason: "sin identidad reconocible" };
}

export type IncomingMessage = {
  phoneNumberId: string;
  /** A quién se le contesta. `isBsuid` decide el campo del envío a Graph. */
  recipient: string;
  isBsuid: boolean;
  /** Identidad estable de la persona (teléfono o BSUID). */
  identidad: string;
  wamid: string;
  /** El `type` de Meta: text, audio, image, document, sticker, … */
  type: string;
  text: string;
};

export type CollectResult = {
  mensajes: IncomingMessage[];
  /** Sin identidad clara: se retienen y se loguean, no se adivinan. */
  ambiguos: Array<{ wamid: string; reason: string }>;
  /** Mensajes a números que no son de ningún workspace. */
  ajenos: number;
};

/**
 * Extrae los mensajes entrantes. Recorre TODAS las colecciones
 * (entry[]/changes[]/messages[]); los `statuses` (acuses) se ignoran.
 *
 * `numerosPropios` son los phone_number_id con conexión en la base. Vacío
 * significa "no atendemos nada" (falla cerrado, como Aly): una App de Meta
 * suscrita a una WABA compartida recibe mensajes de números de OTROS bots, y
 * contestarlos sería hablar con la voz equivocada.
 */
export function collectMessages(payload: any, numerosPropios: Iterable<string>): CollectResult {
  const propios = new Set(numerosPropios);
  const mensajes: IncomingMessage[] = [];
  const ambiguos: Array<{ wamid: string; reason: string }> = [];
  let ajenos = 0;

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const phoneNumberId: string = value?.metadata?.phone_number_id ?? "";

      for (const m of value?.messages ?? []) {
        if (!propios.has(phoneNumberId)) {
          ajenos++;
          continue;
        }
        // El contacto solo se usa si matchea EXPLÍCITAMENTE.
        const contact = (value?.contacts ?? []).find(
          (c: any) =>
            (c?.wa_id && c.wa_id === m?.from) || (c?.user_id && c.user_id === m?.from_user_id),
        );
        const quien = classifySender(m, contact);
        if (quien.kind === "ambiguous") {
          ambiguos.push({ wamid: m?.id ?? "", reason: quien.reason });
          continue;
        }
        const isBsuid = quien.kind === "bsuid";
        const id = isBsuid ? quien.bsuid : quien.phone;
        mensajes.push({
          phoneNumberId,
          recipient: id,
          isBsuid,
          identidad: id,
          wamid: m?.id ?? "",
          type: m?.type ?? "unknown",
          text: m?.text?.body ?? "",
        });
      }
    }
  }
  return { mensajes, ambiguos, ajenos };
}

/** Los `phone_number_id` que aparecen en el payload, sin repetir. */
export function phoneNumberIdsDelPayload(payload: any): string[] {
  const vistos = new Set<string>();
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const pnid = change?.value?.metadata?.phone_number_id;
      if (typeof pnid === "string" && pnid !== "") vistos.add(pnid);
    }
  }
  return [...vistos];
}

/**
 * Verifica `X-Hub-Signature-256` sobre los BYTES CRUDOS, antes de parsear:
 * `JSON.stringify` de un objeto ya parseado no reproduce lo que Meta firmó.
 */
export function verifyMetaSignature(
  rawBody: string,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  if (!header || !appSecret) return false;
  const esperado = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verifica contra TODOS los app secrets configurados (varias Apps de Meta
 * pueden apuntar a esta URL). No hay forma de elegir el secreto correcto sin
 * confiar antes en un cuerpo sin verificar.
 */
export function firmaValida(raw: string, header: string | null | undefined, secretos: string[]): boolean {
  if (secretos.length === 0) return false;
  return secretos.some((s) => verifyMetaSignature(raw, header, s));
}

/**
 * Los app secrets del entorno: `META_APP_SECRET` y cualquier
 * `META_APP_SECRET_*` (uno por App de Meta que apunte a este webhook).
 */
export function appSecretsDelEntorno(env: Record<string, string | undefined> = process.env): string[] {
  const vistos = new Set<string>();
  for (const [k, v] of Object.entries(env)) {
    if ((k === "META_APP_SECRET" || k.startsWith("META_APP_SECRET_")) && v) vistos.add(v);
  }
  return [...vistos];
}
