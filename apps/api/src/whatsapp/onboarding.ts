// ── Sesión y onboarding, en puro ───────────────────────────────────────────
//
// PORTADO de `~/Dev/Aly/src/utils/metaSession.ts` + `Constants/MetaOnboarding.ts`
// (reglas de aceptación del 2026-09-25). Sin base y sin red: se prueba entero.
//
// bienvenida → aviso de privacidad → acepta / rechaza → preguntas de perfil
// opcionales → conversación normal (processQuestion).
//
// Reglas que no se aflojan:
//  * Acepta: "1", "sí", "acepto", "sí acepto", "sí, acepto", "estoy de acuerdo"
//    (minúsculas, sin tildes, sin espacios en los bordes). Nada más.
//  * Rechaza SOLO "2" o un mensaje que empieza con la palabra "no" ("no
//    entiendo" también despide: costo aceptado; su mensaje siguiente reabre el
//    gate). Cualquier otra cosa ("hola", una pregunta) repite la pregunta.
//    Rechazar todo lo que no fuera "1" dejó a una persona real rebotando entre
//    aviso y despedida 16 veces en apapáchar (2026-09-25).
//  * Al rechazar no se guarda NADA: la acción `rechazar` borra la sesión.
//  * Quien rechazó y vuelve a escribir recibe el gate otra vez (no hay estado
//    "rechazado" persistido: vuelve a ser nuevo).
//  * El consentimiento es de la persona, no de la sesión: no rota con los 70 min.

import type { TextosCanal } from "./textos";

/**
 * Ventana de inactividad tras la cual empieza una conversación nueva. Mismo
 * número que el umbral del ConversationCloser de Aly (decisión 2026-09-18): si
 * la sesión durara más que el cierre, se resumirían conversaciones vivas.
 */
export const VENTANA_SESION_MINUTOS = 70;

export type EstadoOnboarding = "nuevo" | "esperando_privacidad" | `perfil:${number}` | "listo";

export function normalizar(mensaje: string): string {
  return mensaje
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function esAceptacion(mensaje: string): boolean {
  const m = normalizar(mensaje);
  return (
    m === "1" ||
    m === "acepto" ||
    m === "si" ||
    m === "si acepto" ||
    m === "si, acepto" ||
    m === "estoy de acuerdo"
  );
}

export function esRechazo(mensaje: string): boolean {
  const m = normalizar(mensaje);
  return m === "2" || /^no\b/.test(m);
}

export function esSalida(mensaje: string): boolean {
  return /^(salir|exit|sair)$/i.test(mensaje.trim());
}

export function esSaltar(mensaje: string): boolean {
  return /^(saltar|omitir|siguiente|prefiero no (decir|responder))$/.test(normalizar(mensaje));
}

export function sesionSigueViva(ultimo: Date | string | null, ahora = new Date()): boolean {
  if (!ultimo) return false;
  const t = new Date(ultimo).getTime();
  if (Number.isNaN(t)) return false;
  // Reloj corrido hacia atrás → negativo → sesión viva (no partir una en curso).
  return (ahora.getTime() - t) / 60_000 < VENTANA_SESION_MINUTOS;
}

/**
 * Identidad + marca de sesión: el historial agrupa por conversación, no por
 * persona. El sufijo aleatorio evita que dos sesiones abiertas en el mismo
 * milisegundo (un `salir` seguido de otro mensaje) compartan id.
 */
export function nuevoConversationId(identidad: string, ahora = new Date()): string {
  const azar = Math.random().toString(36).slice(2, 6);
  return `${identidad}-${ahora.getTime().toString(36)}${azar}`;
}

function indicePerfil(estado: string): number | null {
  const m = /^perfil:(\d+)$/.exec(estado);
  return m ? Number(m[1]) : null;
}

/** El gate completo: bienvenida, aviso (+ link) y la pregunta. */
export function mensajesGate(t: TextosCanal): string[] {
  const aviso = t.politicaUrl
    ? `${t.avisoPrivacidad}\n\nPuedes leer la política de tratamiento de datos aquí: ${t.politicaUrl}`
    : t.avisoPrivacidad;
  return [t.bienvenida, aviso, t.preguntaConsentimiento];
}

export function textoPregunta(p: { pregunta: string; opciones: string[] }): string {
  if (p.opciones.length === 0) return p.pregunta;
  const lista = p.opciones.map((o, i) => `${i + 1}. ${o}`).join("\n");
  return `${p.pregunta}\n\n${lista}`;
}

/** Respuesta válida a una pregunta de perfil, o null si hay que repetirla. */
export function respuestaPerfil(p: { opciones: string[] }, mensaje: string): string | null {
  const limpio = mensaje.trim();
  if (!limpio) return null;
  if (p.opciones.length === 0) return limpio.slice(0, 200);
  if (/^\d{1,2}$/.test(limpio)) return p.opciones[Number(limpio) - 1] ?? null;
  const m = normalizar(limpio);
  return p.opciones.find((o) => normalizar(o) === m) ?? null;
}

export type AccionOnboarding =
  | { tipo: "ninguna" }
  | { tipo: "aceptar" }
  | { tipo: "rechazar" }
  | { tipo: "perfil"; id: string; valor: string }
  | { tipo: "cerrar_sesion" };

export type PasoOnboarding = {
  /** Mensajes a enviar, en orden. */
  responder: string[];
  estado: EstadoOnboarding;
  /** ¿El mensaje sigue al pipeline, o el turno termina acá? */
  alPipeline: boolean;
  accion: AccionOnboarding;
};

/**
 * La máquina. `esNueva` = esta sesión se abrió en este turno (primera vez o
 * pasaron 70 min). `aceptado` = consentimiento guardado.
 */
export function siguientePaso(args: {
  estado: string;
  aceptado: boolean;
  esNueva: boolean;
  mensaje: string;
  textos: TextosCanal;
}): PasoOnboarding {
  const { estado, aceptado, esNueva, mensaje, textos: t } = args;
  const ninguna = { tipo: "ninguna" } as const;
  const gate: PasoOnboarding = {
    responder: mensajesGate(t),
    estado: "esperando_privacidad",
    alPipeline: false,
    accion: ninguna,
  };

  // ── Sin consentimiento: solo existe el gate ────────────────────────────────
  if (!aceptado) {
    // Persona nueva, o un gate a medias cuya sesión venció: el gate completo
    // (quien vuelve horas después no recuerda qué se le preguntó).
    if (estado !== "esperando_privacidad" || esNueva) return gate;

    if (esAceptacion(mensaje)) {
      const primera = t.preguntasPerfil[0];
      if (primera) {
        return {
          responder: [t.transicionPerfil, textoPregunta(primera)],
          estado: "perfil:0",
          alPipeline: false, // su "1" no es una pregunta
          accion: { tipo: "aceptar" },
        };
      }
      return { responder: [t.cierreOnboarding], estado: "listo", alPipeline: false, accion: { tipo: "aceptar" } };
    }
    if (esRechazo(mensaje)) {
      return { responder: [t.despedidaRechazo], estado: "nuevo", alPipeline: false, accion: { tipo: "rechazar" } };
    }
    // Ni sí ni no: solo la pregunta otra vez.
    return { responder: [t.preguntaConsentimiento], estado: "esperando_privacidad", alPipeline: false, accion: ninguna };
  }

  // ── Con consentimiento ─────────────────────────────────────────────────────
  if (esSalida(mensaje)) {
    return { responder: [t.despedidaSalir], estado: "listo", alPipeline: false, accion: { tipo: "cerrar_sesion" } };
  }

  const i = indicePerfil(estado);
  if (i !== null) {
    const p = t.preguntasPerfil[i];
    // Perfil a medias con sesión vencida, o preguntas que ya no existen: las
    // preguntas son opcionales, así que se sigue a la conversación.
    if (!p || esNueva) return { responder: [], estado: "listo", alPipeline: true, accion: ninguna };

    const siguiente = t.preguntasPerfil[i + 1];
    const avanzar = (accion: AccionOnboarding): PasoOnboarding =>
      siguiente
        ? { responder: [textoPregunta(siguiente)], estado: `perfil:${i + 1}`, alPipeline: false, accion }
        : { responder: [t.cierreOnboarding], estado: "listo", alPipeline: false, accion };

    if (esSaltar(mensaje)) return avanzar(ninguna);
    const valor = respuestaPerfil(p, mensaje);
    if (valor === null) {
      return { responder: [textoPregunta(p)], estado: `perfil:${i}`, alPipeline: false, accion: ninguna };
    }
    return avanzar({ tipo: "perfil", id: p.id, valor });
  }

  // listo (o un estado desconocido con consentimiento): conversación normal.
  return { responder: [], estado: "listo", alPipeline: true, accion: ninguna };
}
