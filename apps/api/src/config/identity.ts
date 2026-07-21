// Prompt núcleo + storyboard del programa conversacional.
// Duplicación consciente de apps/web/lib/workspaces.ts: el contrato es el
// JSONB workspace_configs.core_prompt / .storyboard (NULL → defaults).
// Textos en español: el postfix de idioma del engine sigue mandando.

export interface CorePrompt {
  mission: string;
  scope: string;
  success_criteria: string;
  key_actions: string;
}

export type StoryboardMomentKey =
  | "opening"
  | "development"
  | "next_steps"
  | "closing";

/** Material (imagen, PDF, video, audio…) que el asistente puede enviar en el chat. */
export interface StoryboardAttachment {
  id: string;
  name: string;
  /** MIME type del archivo. */
  type: string;
  size: number;
  storage_path: string;
}

export interface Storyboard {
  opening: string;
  development: string;
  next_steps: string;
  closing: string;
  /** Materiales por momento; el asistente los envía con el marcador [[adjunto:id]]. */
  attachments?: Partial<Record<StoryboardMomentKey, StoryboardAttachment[]>>;
}

const MOMENT_LABELS: Record<StoryboardMomentKey, string> = {
  opening: "Arranque",
  development: "Desarrollo",
  next_steps: "Lo que debe pasar después",
  closing: "Cierre",
};

function attachmentKind(mime: string): string {
  if (mime.startsWith("image/")) return "imagen";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "PDF";
  return "archivo";
}

export const DEFAULT_CORE_PROMPT: CorePrompt = {
  mission:
    "Acompañar a cada persona a través de un programa conversacional de aprendizaje y cambio de comportamiento, adaptándote a su contexto y su ritmo.",
  scope:
    "Hablás solo de los temas del programa y de la organización. No das consejos médicos, legales ni financieros; si surge algo fuera de tu alcance, derivás a una persona del equipo.",
  success_criteria:
    "La persona entendió la idea central del momento, se sintió escuchada y definió un próximo paso concreto y alcanzable.",
  key_actions:
    "Completar cada momento del programa, aplicar las herramientas en su vida y volver a conversar para contar cómo le fue.",
};

export const DEFAULT_STORYBOARD: Storyboard = {
  opening:
    "Bienvenida cálida y diagnóstico: conocer a la persona, su contexto y su punto de partida.",
  development:
    "Contenido del programa: compartir ideas y herramientas, y conversar sobre cómo aplicarlas a su situación.",
  next_steps:
    "Compromiso de acción: la persona define un próximo paso concreto y alcanzable antes de terminar.",
  closing:
    "Cierre y seguimiento: celebrar el avance y acordar cuándo retomar el contacto.",
};

/** Bloque de identidad que se antepone a los agentes que hablan con el usuario. */
export function compileIdentity(
  assistantName: string,
  workspaceName: string,
  core: CorePrompt,
  storyboard: Storyboard,
): string {
  return (
    `Sos ${assistantName}, el asistente conversacional de "${workspaceName}". ` +
    `Respondés con mensajes breves y cálidos, como en un chat de WhatsApp.\n\n` +
    `Tu misión: ${core.mission}\n\n` +
    `Tu alcance (qué debés y qué no debés hacer): ${core.scope}\n\n` +
    `Una interacción es exitosa cuando: ${core.success_criteria}\n\n` +
    `Buscás que la persona realice estas acciones clave: ${core.key_actions}\n\n` +
    `La conversación sigue este arco (adaptalo al momento de cada persona):\n` +
    `1) Arranque: ${storyboard.opening}\n` +
    `2) Desarrollo: ${storyboard.development}\n` +
    `3) Lo que debe pasar después: ${storyboard.next_steps}\n` +
    `4) Cierre: ${storyboard.closing}` +
    compileMaterials(storyboard)
  );
}

/**
 * Materiales del storyboard: el modelo envía un archivo incluyendo su marcador
 * [[adjunto:id]]; la superficie de chat (web/WhatsApp) lo convierte en el
 * archivo real. El engine solo referencia ids — nunca toca los archivos.
 */
function compileMaterials(storyboard: Storyboard): string {
  const moments = Object.keys(MOMENT_LABELS) as StoryboardMomentKey[];
  const lines = moments.flatMap((moment) =>
    (storyboard.attachments?.[moment] ?? []).map(
      (att) =>
        `- [[adjunto:${att.id}]] → "${att.name}" (${attachmentKind(att.type)}) — momento: ${MOMENT_LABELS[moment]}`,
    ),
  );
  if (!lines.length) return "";
  return (
    `\n\nMateriales del programa (archivos que podés enviar en el chat):\n` +
    lines.join("\n") +
    `\nCuando el arco lo pida, enviá el material incluyendo su marcador exacto ` +
    `(ej: [[adjunto:abc123]]) en una línea propia de tu respuesta; el sistema lo ` +
    `reemplaza por el archivo real. Presentalo con una frase breve antes del ` +
    `marcador. No inventes marcadores que no estén en esta lista ni describas ` +
    `el marcador en palabras.`
  );
}
