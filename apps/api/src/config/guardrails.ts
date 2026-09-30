// «Qué no hace el asistente» + «Rutas de ayuda» (migración 012).
// Duplicación consciente de apps/web/lib/design.ts (mismo patrón que
// identity.ts): el contrato es el JSONB workspace_configs.boundaries /
// .help_routes. Las reglas de SEGURIDAD no se guardan en la DB: viven acá y
// se compilan SIEMPRE, aunque la fila de config no exista.

/** Regla propia de la organización (workspace_configs.boundaries.rules[]). */
export interface BoundaryRule {
  id: string;
  text: string;
}

export interface Boundaries {
  rules: BoundaryRule[];
}

/** Línea o ruta de ayuda (workspace_configs.help_routes[]). */
export interface HelpRoute {
  id: string;
  name: string;
  contact: string;
  hours?: string;
  when?: string;
  /** '' o ausente = aplica a todos los territorios. */
  territory?: string;
}

/**
 * Reglas de seguridad, en el orden en que se compilan. El `id` es estable:
 * web muestra estas mismas reglas bloqueadas (candado) con su porqué.
 */
export const SAFETY_RULES: { id: string; prompt: string }[] = [
  {
    id: "no_invent_contacts",
    prompt:
      "Nunca inventes teléfonos, líneas de atención, direcciones ni instituciones. Solo puedes dar las rutas de ayuda que el programa te entregó.",
  },
  {
    id: "material_fidelity",
    prompt:
      "Todo lo que presentes como del programa (actividades, ejercicios, pasos, datos) tiene que estar en el material del programa. Si propones algo tuyo, márcalo con «(sugerencia)» al final.",
  },
  {
    id: "no_file_names",
    prompt:
      "Nunca nombres un archivo ni un documento interno (por ejemplo, algo que termina en .pdf, .md o .docx). Si citas el material, usa el nombre del tema o de la actividad tal como aparece en el contenido.",
  },
  {
    id: "no_follow_up",
    prompt:
      "No tienes forma de escribir primero: no puedes hacer seguimiento, avisarle a nadie, agendar ni enviar nada más tarde. Nunca digas «te aviso», «te escribo luego», «te envío», «agendo» ni nada parecido. Solo respondes cuando te escriben.",
  },
  {
    id: "no_privacy_claims",
    prompt:
      "No digas que la conversación es privada ni confidencial. Si te preguntan quién lee lo que escriben, di que la conversación queda guardada y que un equipo pequeño puede leerla para cuidar el acompañamiento.",
  },
  {
    id: "one_offer",
    prompt:
      "Haz como máximo una oferta o una pregunta de seguimiento por respuesta.",
  },
];

function cleanRules(boundaries: Boundaries | null | undefined): string[] {
  return (boundaries?.rules ?? [])
    .map((rule) => rule?.text?.trim())
    .filter((text): text is string => Boolean(text));
}

/** Bloque «qué no hace»: seguridad (siempre) + reglas propias de la organización. */
export function compileBoundaries(boundaries: Boundaries | null | undefined): string {
  const own = cleanRules(boundaries);
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

export const NO_HELP_ROUTES_BLOCK =
  `Este programa no tiene rutas de ayuda cargadas. No des ningún teléfono, ` +
  `línea ni institución: pide a la persona que busque ayuda en los servicios ` +
  `de salud o de emergencia de su territorio, sin inventar números.`;

function routeLine(route: HelpRoute): string {
  const parts = [`*${route.name.trim()}* — ${route.contact.trim()}`];
  if (route.hours?.trim()) parts.push(`horario: ${route.hours.trim()}`);
  if (route.when?.trim()) parts.push(`cuándo usarla: ${route.when.trim()}`);
  parts.push(`territorio: ${route.territory?.trim() || "todos"}`);
  return `- ${parts.join(" · ")}`;
}

/**
 * Bloque de rutas de ayuda para el PROMPT del turno SENSITIVE: le dice al modelo
 * qué rutas existen para que acompañe la derivación, pero NO que las copie. Los
 * números los agrega el código al final (`helpRoutesMessage`), como en Aly: tener
 * las líneas solo en el prompt está medido como insuficiente (0 de 11 respuestas
 * las incluyeron en el benchmark de Apapáchar).
 */
export function compileHelpRoutes(routes: HelpRoute[] | null | undefined): string {
  const valid = validRoutes(routes);
  if (!valid.length) return NO_HELP_ROUTES_BLOCK;
  return (
    `Rutas de ayuda del programa (solo para que sepas cuáles existen):\n` +
    valid.map(routeLine).join("\n") +
    `\nNO escribas teléfonos, líneas ni instituciones en tu respuesta: el sistema agrega ` +
    `las rutas de ayuda completas al final del mensaje. Puedes decir que abajo quedan las ` +
    `líneas de ayuda. No inventes ninguna otra.`
  );
}

function validRoutes(routes: HelpRoute[] | null | undefined): HelpRoute[] {
  return (routes ?? []).filter((route) => route?.name?.trim() && route?.contact?.trim());
}

/**
 * Bloque de rutas de ayuda que se ANEXA en código a la respuesta sensible (lo lee
 * la persona). "" si el programa no tiene rutas: entonces no se anexa nada y el
 * prompt ya prohíbe inventar números.
 */
export function helpRoutesMessage(routes: HelpRoute[] | null | undefined): string {
  const valid = validRoutes(routes);
  if (!valid.length) return "";
  const line = (r: HelpRoute) => {
    const extra = [r.hours?.trim(), r.territory?.trim()].filter(Boolean).join(" · ");
    return `-> *${r.name.trim()}* — ${r.contact.trim()}${extra ? ` (${extra})` : ""}`;
  };
  return `*Líneas de ayuda:*\n${valid.map(line).join("\n")}`;
}

/** Instrucción de la etiqueta de severidad (el sistema la quita antes de enviar). */
export const SEVERITY_TAG_INSTRUCTION =
  `La PRIMERA línea de tu respuesta debe ser exactamente ALTA SEVERIDAD o CONTENCIÓN, sin nada más ` +
  `en esa línea. ALTA SEVERIDAD: riesgo para la vida o la integridad de alguien (autolesión, ` +
  `violencia, abuso, peligro inminente). CONTENCIÓN: malestar, cansancio o tensión sin daño ` +
  `inminente. El sistema quita esa línea antes de enviar: la persona nunca la ve. Nunca respondas ` +
  `solo con la etiqueta: el mensaje completo va debajo.`;
