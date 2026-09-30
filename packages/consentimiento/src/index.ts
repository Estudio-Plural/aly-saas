// Consentimiento — la ÚNICA regla, compartida por el chat de prueba del panel
// (apps/web) y el canal de WhatsApp del engine (apps/api). Son las reglas
// exactas de Aly (2026-09-25); no se aflojan ni se «mejoran» en un solo lado:
//
//   * Acepta: «1», «si», «acepto», «si acepto», «si, acepto», «estoy de acuerdo»,
//     comparados después de normalizar (espacios de los extremos, minúsculas,
//     sin tildes). «sí claro», «acepto!» u «ok» NO aceptan: repiten la pregunta.
//   * Rechaza: SOLO «2» o un mensaje que empieza con la palabra «no»
//     («no», «no acepto», «No gracias», «NO.»). «nomás pregunto» o «ahora no»
//     no rechazan.
//   * Cualquier otra cosa: se repite la pregunta.
//
// Al rechazar no se guarda nada (lo hace cumplir cada canal).

/** Pregunta que va después del aviso de privacidad. */
export const PREGUNTA_CONSENTIMIENTO = "¿Aceptas continuar?\n\n1️⃣ Sí, acepto\n2️⃣ No acepto";

/** Despedida al rechazar. */
export const DESPEDIDA_RECHAZO =
  "Entiendo. No guardé nada de lo que escribiste y aquí terminamos.\n\nSi cambias de opinión, escríbeme cuando quieras.";

/** Respuestas que aceptan, ya normalizadas. */
export const RESPUESTAS_ACEPTA = [
  "1",
  "si",
  "acepto",
  "si acepto",
  "si, acepto",
  "estoy de acuerdo",
] as const;

/** Espacios de los extremos fuera, minúsculas, sin tildes. Nada más. */
export function normalizarRespuesta(mensaje: string): string {
  return mensaje
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function esAceptacion(mensaje: string): boolean {
  return (RESPUESTAS_ACEPTA as readonly string[]).includes(normalizarRespuesta(mensaje));
}

export function esRechazo(mensaje: string): boolean {
  const m = normalizarRespuesta(mensaje);
  return m === "2" || /^no\b/.test(m);
}

export type DecisionConsentimiento = "acepta" | "rechaza" | "repite";

export function evaluarConsentimiento(mensaje: string): DecisionConsentimiento {
  if (esAceptacion(mensaje)) return "acepta";
  if (esRechazo(mensaje)) return "rechaza";
  return "repite";
}
