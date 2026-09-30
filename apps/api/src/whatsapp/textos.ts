// ── Textos del onboarding de WhatsApp, por workspace ───────────────────────
//
// CONTRATO CON LA MIGRACIÓN 012 (carril B, "Diseñar",
// `012_disenar_programa.sql`): el canal lee la columna JSONB
// `workspace_configs.welcome`:
//
//   {"welcome_message": "¡Hola! Soy Aly…",
//    "privacy_notice": "texto EXACTO que escribe la organización",
//    "privacy_policy_url": "https://…" | "",
//    "profile_questions": [
//      {"id": "q1", "question": "¿En qué región vives?", "variable": "region", "options": []},
//      {"id": "q2", "question": "¿Con qué género te identificas?", "variable": "genero",
//       "options": ["Mujer", "Hombre", "No binario", "Prefiero no decir"]}]}
//
// La respuesta de perfil se guarda en users_data.profile bajo `variable` (o
// `id` si no hay variable).
//
// La lectura es TOLERANTE a propósito:
//   * si la columna no existe (la 012 no corrió), se lee la fila con
//     `to_jsonb(wc)` y no hay error: se usan los defaults;
//   * se acepta también `whatsapp_onboarding` con claves en español
//     (bienvenida, aviso_privacidad, politica_url, pregunta_consentimiento,
//     despedida_rechazo, cierre_onboarding, preguntas_perfil[{id, pregunta,
//     opciones}]) — el nombre que propuso este carril antes de ver la 012;
//   * cualquier campo vacío o con tipo raro cae a su default seguro.
//
// ⚠️ El aviso por defecto es PROVISIONAL y genérico: no cita una política
// publicada ni nombra un responsable de tratamiento. Antes de abrir un número a
// participantes reales, el programa tiene que cargar el suyo.

export type PreguntaPerfil = { id: string; pregunta: string; opciones: string[] };

export type TextosCanal = {
  bienvenida: string;
  avisoPrivacidad: string;
  politicaUrl: string | null;
  preguntaConsentimiento: string;
  despedidaRechazo: string;
  cierreOnboarding: string;
  transicionPerfil: string;
  soloTexto: string;
  despedidaSalir: string;
  errorTecnico: string;
  preguntasPerfil: PreguntaPerfil[];
};

export function textosPorDefecto(asistente = "Aly", organizacion = "el programa"): TextosCanal {
  return {
    bienvenida: `¡Hola! Soy *${asistente}*, el asistente de ${organizacion} 🌱`,
    avisoPrivacidad:
      "Antes de empezar: guardo lo que conversamos para darte continuidad y para que el equipo del programa pueda mejorar el acompañamiento. No compartimos tus mensajes fuera del programa.",
    politicaUrl: null,
    preguntaConsentimiento: "¿Aceptas continuar?\n\n1️⃣ Sí, acepto\n2️⃣ No acepto",
    despedidaRechazo:
      "Entiendo. No guardé nada de lo que escribiste y aquí terminamos.\n\nSi cambias de opinión, escríbeme cuando quieras.",
    cierreOnboarding: "¡Gracias! Ya podemos empezar.\n\n¿En qué te ayudo hoy?",
    transicionPerfil:
      "Antes de seguir, unas preguntas rápidas para acompañarte mejor. Son opcionales: si prefieres no responder, escribe *saltar*.",
    soloTexto: "Por ahora solo puedo leer mensajes de texto 🙏 ¿Me lo escribes?",
    despedidaSalir: "Gracias. ¡Hasta luego!",
    errorTecnico: "Tuve un problema técnico. ¿Me escribes de nuevo en unos minutos?",
    preguntasPerfil: [],
  };
}

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

const url = (v: unknown): string | null => {
  const t = texto(v);
  return t && /^https?:\/\/\S+$/i.test(t) ? t : null;
};

function preguntas(v: unknown): PreguntaPerfil[] {
  if (!Array.isArray(v)) return [];
  const out: PreguntaPerfil[] = [];
  v.forEach((p: any, i) => {
    const pregunta = texto(p?.pregunta ?? p?.question ?? p?.texto ?? p?.text);
    if (!pregunta) return;
    const id = texto(p?.variable ?? p?.id ?? p?.key) ?? `pregunta_${i + 1}`;
    const opcionesCrudas = p?.opciones ?? p?.options;
    const opciones = Array.isArray(opcionesCrudas)
      ? opcionesCrudas.map((o: unknown) => texto(o)).filter((o): o is string => !!o)
      : [];
    out.push({ id: id.slice(0, 64), pregunta, opciones });
  });
  // Tope defensivo: esto es un onboarding, no una encuesta.
  return out.slice(0, 8);
}

/**
 * Mezcla la config del workspace (lo que haya) con los defaults. `fila` es la
 * fila de `workspace_configs` como objeto (to_jsonb), o null.
 */
export function resolverTextos(
  fila: Record<string, unknown> | null | undefined,
  asistente?: string,
  organizacion?: string,
): TextosCanal {
  const base = textosPorDefecto(asistente, organizacion);
  const raw = (fila?.welcome ?? fila?.whatsapp_onboarding ?? null) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return base;

  return {
    ...base,
    bienvenida: texto(raw.welcome_message ?? raw.bienvenida ?? raw.welcome) ?? base.bienvenida,
    avisoPrivacidad: texto(raw.aviso_privacidad ?? raw.privacy_notice) ?? base.avisoPrivacidad,
    politicaUrl: url(raw.privacy_policy_url ?? raw.politica_url ?? raw.policy_url) ?? base.politicaUrl,
    preguntaConsentimiento:
      texto(raw.pregunta_consentimiento ?? raw.consent_question) ?? base.preguntaConsentimiento,
    despedidaRechazo: texto(raw.despedida_rechazo ?? raw.rejection_message) ?? base.despedidaRechazo,
    cierreOnboarding: texto(raw.cierre_onboarding ?? raw.closing_message) ?? base.cierreOnboarding,
    preguntasPerfil: preguntas(raw.preguntas_perfil ?? raw.profile_questions),
  };
}
