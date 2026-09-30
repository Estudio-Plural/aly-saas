// «Diseñar» — tipos y helpers client-safe de las secciones de la migración 012
// (qué no hace, rutas de ayuda, bienvenida y consentimiento).
// Duplicación consciente de apps/api/src/config/guardrails.ts: el contrato es
// el JSONB de workspace_configs. Las reglas de SEGURIDAD viven en código (acá
// y en el engine), nunca en la DB: no se pueden quitar.

// ─── Qué no hace el asistente (workspace_configs.boundaries) ─────────────────

export type BoundaryRule = { id: string; text: string };
export type Boundaries = { rules: BoundaryRule[] };

export type SafetyRule = {
  id: string;
  /** Cómo se ve en el panel. */
  label: string;
  /** Una línea de por qué no se puede quitar. */
  why: string;
  /** Lo que va al prompt (idéntico a apps/api/src/config/guardrails.ts). */
  prompt: string;
};

export const SAFETY_RULES: SafetyRule[] = [
  {
    id: "no_invent_contacts",
    label: "No inventa teléfonos, líneas ni instituciones",
    why: "Un número equivocado puede dejar sin ayuda a alguien en riesgo. Solo da las rutas que pongas en «Rutas de ayuda».",
    prompt:
      "Nunca inventes teléfonos, líneas de atención, direcciones ni instituciones. Solo puedes dar las rutas de ayuda que el programa te entregó.",
  },
  {
    id: "material_fidelity",
    label: "Solo presenta como del programa lo que está en su material",
    why: "Así tu organización puede responder por lo que el asistente dice en su nombre. Lo que propone por su cuenta lo marca como sugerencia.",
    prompt:
      "Todo lo que presentes como del programa (actividades, ejercicios, pasos, datos) tiene que estar en el material del programa. Si propones algo tuyo, márcalo con «(sugerencia)» al final.",
  },
  {
    id: "no_file_names",
    label: "Nunca nombra archivos",
    why: "Los nombres de archivo son internos y confunden a la persona.",
    prompt:
      "Nunca nombres un archivo ni un documento interno (por ejemplo, algo que termina en .pdf, .md o .docx). Si citas el material, usa el nombre del tema o de la actividad tal como aparece en el contenido.",
  },
  {
    id: "no_follow_up",
    label: "No promete seguimiento («te aviso», «te envío», «agendo»)",
    why: "El asistente solo responde cuando le escriben: no puede escribir primero ni avisarle a nadie.",
    prompt:
      "No tienes forma de escribir primero: no puedes hacer seguimiento, avisarle a nadie, agendar ni enviar nada más tarde. Nunca digas «te aviso», «te escribo luego», «te envío», «agendo» ni nada parecido. Solo respondes cuando te escriben.",
  },
  {
    id: "no_privacy_claims",
    label: "No dice que la conversación es privada o confidencial",
    why: "La conversación queda guardada y tu equipo puede leerla para cuidar el acompañamiento.",
    prompt:
      "No digas que la conversación es privada ni confidencial. Si te preguntan quién lee lo que escriben, di que la conversación queda guardada y que un equipo pequeño puede leerla para cuidar el acompañamiento.",
  },
  {
    id: "one_offer",
    label: "Una sola oferta por respuesta",
    why: "Varias opciones a la vez abruman; una sola invita a seguir.",
    prompt: "Haz como máximo una oferta o una pregunta de seguimiento por respuesta.",
  },
];

/** Bloque «qué no hace» para el prompt: seguridad (siempre) + reglas propias. */
export function compileBoundariesBlock(boundaries: Boundaries | null | undefined): string {
  const own = (boundaries?.rules ?? [])
    .map((rule) => rule?.text?.trim())
    .filter((text): text is string => Boolean(text));
  let block =
    `Reglas que no rompes nunca:\n` +
    SAFETY_RULES.map((rule) => `- ${rule.prompt}`).join("\n");
  if (own.length) {
    block +=
      `\n\nEsto tampoco lo haces (lo definió la organización):\n` +
      own.map((text) => `- ${text}`).join("\n");
  }
  return block;
}

// ─── Rutas de ayuda (workspace_configs.help_routes) ─────────────────────────

export type HelpRoute = {
  id: string;
  /** Nombre de la línea o servicio. */
  name: string;
  /** Teléfono o canal. */
  contact: string;
  /** Horario ('' si no aplica). */
  hours: string;
  /** Cuándo usarla. */
  when: string;
  /** '' = todos los territorios. */
  territory: string;
};

export const NO_HELP_ROUTES_BLOCK =
  `Este programa no tiene rutas de ayuda cargadas. No des ningún teléfono, ` +
  `línea ni institución: pide a la persona que busque ayuda en los servicios ` +
  `de salud o de emergencia de su territorio, sin inventar números.`;

/** Bloque de rutas para el prompt (mismo texto que compileHelpRoutes del engine). */
export function compileHelpRoutesBlock(routes: HelpRoute[] | null | undefined): string {
  const valid = (routes ?? []).filter(
    (route) => route?.name?.trim() && route?.contact?.trim()
  );
  if (!valid.length) return NO_HELP_ROUTES_BLOCK;
  const lines = valid.map((route) => {
    const parts = [`*${route.name.trim()}* — ${route.contact.trim()}`];
    if (route.hours?.trim()) parts.push(`horario: ${route.hours.trim()}`);
    if (route.when?.trim()) parts.push(`cuándo usarla: ${route.when.trim()}`);
    parts.push(`territorio: ${route.territory?.trim() || "todos"}`);
    return `- ${parts.join(" · ")}`;
  });
  return (
    `Rutas de ayuda del programa (son las ÚNICAS que puedes dar; cópialas tal cual, sin cambiar números):\n` +
    lines.join("\n") +
    `\nSi la persona puede estar en riesgo, dale la ruta que corresponda a su situación y a su territorio. ` +
    `Si hay rutas distintas por territorio y no sabes el suyo, da las que aplican a todos o pregúntale su territorio en una frase. ` +
    `No agregues rutas que no estén en esta lista.`
  );
}

// ─── Bienvenida y consentimiento (workspace_configs.welcome) ────────────────

export type ProfileQuestion = {
  id: string;
  question: string;
  /** Nombre del dato (minúsculas y _), p. ej. "region". */
  variable: string;
  /** [] = respuesta libre. */
  options: string[];
};

export type Welcome = {
  welcome_message: string;
  /** Texto EXACTO que escribe la organización. */
  privacy_notice: string;
  privacy_policy_url: string;
  profile_questions: ProfileQuestion[];
};

/** Pregunta de aceptación que se muestra después del aviso (fija). */
export const CONSENT_QUESTION = "¿Aceptas continuar?\n\n1️⃣ Sí, acepto\n2️⃣ No acepto";

/** Despedida al rechazar (fija). */
export const CONSENT_REJECTED_MESSAGE =
  "Entendido. No guardamos ningún dato tuyo. Si cambias de opinión, puedes escribirnos de nuevo cuando quieras.";

/** Respuestas que cuentan como aceptación (ya normalizadas). */
export const CONSENT_ACCEPT_ANSWERS = [
  "1",
  "si",
  "acepto",
  "si acepto",
  "si, acepto",
  "estoy de acuerdo",
  "de acuerdo",
  "si, estoy de acuerdo",
  "si estoy de acuerdo",
];

function normalizeAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // acentos
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{20E3}]/gu, "") // emojis (1️⃣)
    .replace(/[.!¡¿?]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reglas de aceptación FIJAS del consentimiento:
 * - acepta: «1», «sí», «acepto», «sí, acepto», «estoy de acuerdo»…
 * - rechaza: SOLO «2» o un mensaje que empieza con la palabra «no»
 * - cualquier otra cosa: se repite la pregunta
 * El canal de WhatsApp (servidor) y el chat de prueba usan esta misma función.
 */
export function evaluateConsent(text: string): "accept" | "reject" | "repeat" {
  const m = normalizeAnswer(text);
  if (CONSENT_ACCEPT_ANSWERS.includes(m)) return "accept";
  if (m === "2" || /^no\b/.test(m)) return "reject";
  return "repeat";
}

/** Nombre de dato seguro a partir de un texto libre. */
export function toVariableName(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s_]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 30) || "dato"
  );
}

// ─── Estado de avance (Primeros pasos + checks del menú) ─────────────────────

export type DesignStepKey = "program" | "boundaries" | "routes" | "material" | "welcome";
export type SectionKey = "design" | "test" | "connect" | "operate";

export type ProgramProgress = {
  design: Record<DesignStepKey, boolean>;
  test: boolean;
  connect: boolean;
  operate: boolean;
};

export const DESIGN_STEPS: { key: DesignStepKey; label: string; path: string }[] = [
  { key: "program", label: "Tu programa", path: "programa" },
  { key: "boundaries", label: "Qué no hace", path: "limites" },
  { key: "routes", label: "Rutas de ayuda", path: "rutas" },
  { key: "material", label: "Material", path: "knowledge" },
  { key: "welcome", label: "Bienvenida y consentimiento", path: "bienvenida" },
];

export function isDesignDone(progress: ProgramProgress): boolean {
  return Object.values(progress.design).every(Boolean);
}

/** Ruta (relativa al programa) del primer paso pendiente, o null si todo está hecho. */
export function nextStepPath(progress: ProgramProgress): string | null {
  const pendingDesign = DESIGN_STEPS.find((step) => !progress.design[step.key]);
  if (pendingDesign) return pendingDesign.path;
  if (!progress.test) return "chat";
  if (!progress.connect) return "whatsapp";
  if (!progress.operate) return "operar";
  return null;
}

// ─── Chat de prueba: la bienvenida como flujo ───────────────────────────────

/** Paso del flujo de bienvenida que corre el chat de prueba. */
export type PreviewStep = {
  id: string;
  type: "message" | "consent" | "question" | "end";
  content: string;
  variable?: string;
  options?: string[];
};

/** Texto de una pregunta de perfil tal como la recibe la persona. */
export function profileQuestionText(q: ProfileQuestion): string {
  if (!q.options.length) return q.question;
  return `${q.question}\n\n${q.options.map((option, i) => `${i + 1}. ${option}`).join("\n")}`;
}

/** Respuesta a una pregunta con opciones: por número o por texto; si no, lo que escribió. */
export function matchOption(options: string[], answer: string): string {
  const clean = answer.trim();
  const n = Number.parseInt(clean, 10);
  if (String(n) === clean && n >= 1 && n <= options.length) return options[n - 1];
  const norm = (text: string) =>
    text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return options.find((option) => norm(option) === norm(clean)) ?? clean;
}

/** Bienvenida → aviso (+ link) → consentimiento → preguntas de perfil. */
export function welcomeToSteps(welcome: Welcome): PreviewStep[] {
  const notice = welcome.privacy_policy_url
    ? `${welcome.privacy_notice.trim()}\n\n${welcome.privacy_policy_url}`
    : welcome.privacy_notice.trim();
  return [
    { id: "welcome", type: "message", content: welcome.welcome_message },
    { id: "privacy", type: "message", content: notice },
    { id: "consent", type: "consent", content: CONSENT_QUESTION },
    ...welcome.profile_questions.map(
      (q): PreviewStep => ({
        id: q.id,
        type: "question",
        content: profileQuestionText(q),
        variable: q.variable,
        options: q.options,
      })
    ),
    { id: "end", type: "end", content: "" },
  ];
}
