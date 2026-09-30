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

/** Bloque de rutas de ayuda para el turno SENSITIVE. */
export function compileHelpRoutes(routes: HelpRoute[] | null | undefined): string {
  const valid = (routes ?? []).filter(
    (route) => route?.name?.trim() && route?.contact?.trim(),
  );
  if (!valid.length) return NO_HELP_ROUTES_BLOCK;
  return (
    `Rutas de ayuda del programa (son las ÚNICAS que puedes dar; cópialas tal cual, sin cambiar números):\n` +
    valid.map(routeLine).join("\n") +
    `\nSi la persona puede estar en riesgo, dale la ruta que corresponda a su situación y a su territorio. ` +
    `Si hay rutas distintas por territorio y no sabes el suyo, da las que aplican a todos o pregúntale su territorio en una frase. ` +
    `No agregues rutas que no estén en esta lista.`
  );
}
