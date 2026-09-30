// Prompt núcleo + storyboard del programa conversacional.
// Duplicación consciente de apps/web/lib/workspaces.ts: el contrato es el
// JSONB workspace_configs.core_prompt / .storyboard (NULL → defaults).
// Textos en español: el postfix de idioma del engine sigue mandando.

import { compileBoundaries, type Boundaries } from "./guardrails";

export interface CorePrompt {
  /** Para qué existe el asistente. */
  mission: string;
  /** A quién acompaña (desde «Tu programa», 2026-09). */
  audience?: string;
  /** Cuándo una conversación va bien. */
  success_criteria: string;
  /** Voz: tono general. */
  voice_tone?: string;
  /** Voz: palabras y giros que usa. */
  voice_use?: string;
  /** Voz: palabras y giros que evita. */
  voice_avoid?: string;
  /** Legacy (Identidad 2026-07): hoy lo cubre «Qué no hace». Opcional. */
  scope?: string;
  /** Legacy (Identidad 2026-07). Opcional. */
  key_actions?: string;
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

export const DEFAULT_CORE_PROMPT: Required<Pick<CorePrompt, "mission" | "audience" | "success_criteria" | "voice_tone" | "voice_use" | "voice_avoid">> = {
  mission:
    "Acompañar a cada persona a través de un programa conversacional de aprendizaje y cambio de comportamiento, adaptándote a su contexto y su ritmo.",
  audience:
    "Personas que participan en el programa de la organización y buscan apoyo para dar un siguiente paso.",
  success_criteria:
    "La persona entendió la idea central del momento, se sintió escuchada y definió un próximo paso concreto y alcanzable.",
  voice_tone:
    "Cercano, simple y cálido, nunca dramático. Frases cortas, preguntas claras e invitaciones posibles, sin sonar a manual.",
  voice_use:
    "paso, pausa, apoyo, acompañar, «algo pequeño», «no tienes que resolverlo todo hoy»",
  voice_avoid:
    "«deberías», «es importante que», tecnicismos, frases motivacionales vacías, diagnosticar o juzgar",
};

export const DEFAULT_STORYBOARD: Storyboard = {
  opening:
    "Bienvenida cálida y diagnóstico: conocer a la persona, su contexto y su punto de partida.",
  development:
    "Contenido del programa: compartir ideas y herramientas, y conversar sobre cómo aplicarlas a su situación.",
  next_steps:
    "Compromiso de acción: la persona define un próximo paso concreto y alcanzable antes de terminar.",
  closing:
    "Cierre: reconocer el avance y dejar claro que puede volver a escribir cuando lo necesite.",
};

/** Campo a campo: lo que la organización escribió; si está vacío, el ejemplo. */
function pick(value: string | undefined, fallback: string): string {
  return value?.trim() ? value.trim() : fallback;
}

/** Bloque de identidad que se antepone a los agentes que hablan con el usuario. */
export function compileIdentity(
  assistantName: string,
  workspaceName: string,
  core: Partial<CorePrompt> | null | undefined,
  storyboard: Partial<Storyboard> | null | undefined,
  boundaries?: Boundaries | null,
): string {
  const c = core ?? {};
  const sb = storyboard ?? {};
  const d = DEFAULT_CORE_PROMPT;
  const ds = DEFAULT_STORYBOARD;
  let block =
    `Eres ${assistantName}, el asistente conversacional de "${workspaceName}". ` +
    `Hablas en español, tuteas a la persona y respondes con mensajes breves, como en un chat de WhatsApp.\n\n` +
    `Tu misión: ${pick(c.mission, d.mission)}\n\n` +
    `A quién acompañas: ${pick(c.audience, d.audience)}\n\n` +
    `Una conversación va bien cuando: ${pick(c.success_criteria, d.success_criteria)}`;
  if (c.key_actions?.trim()) {
    block += `\n\nBuscas que la persona realice estas acciones clave: ${c.key_actions.trim()}`;
  }
  if (c.scope?.trim()) {
    block += `\n\nTu alcance: ${c.scope.trim()}`;
  }
  block +=
    `\n\nTu voz:\n` +
    `- Tono: ${pick(c.voice_tone, d.voice_tone)}\n` +
    `- Palabras y giros que usas: ${pick(c.voice_use, d.voice_use)}\n` +
    `- Evitas: ${pick(c.voice_avoid, d.voice_avoid)}`;
  block +=
    `\n\nLa conversación sigue este arco (adáptalo al momento de cada persona):\n` +
    `1) Arranque: ${pick(sb.opening, ds.opening)}\n` +
    `2) Desarrollo: ${pick(sb.development, ds.development)}\n` +
    `3) Lo que debe pasar después: ${pick(sb.next_steps, ds.next_steps)}\n` +
    `4) Cierre: ${pick(sb.closing, ds.closing)}`;
  return block + compileMaterials(sb) + `\n\n` + compileBoundaries(boundaries);
}

/**
 * Materiales del storyboard: el modelo envía un archivo incluyendo su marcador
 * [[adjunto:id]]; la superficie de chat (web/WhatsApp) lo convierte en el
 * archivo real. El engine solo referencia ids — nunca toca los archivos.
 */
function compileMaterials(storyboard: Partial<Storyboard>): string {
  const moments = Object.keys(MOMENT_LABELS) as StoryboardMomentKey[];
  const lines = moments.flatMap((moment) =>
    (storyboard.attachments?.[moment] ?? []).map(
      (att) =>
        `- [[adjunto:${att.id}]] → "${att.name}" (${attachmentKind(att.type)}) — momento: ${MOMENT_LABELS[moment]}`,
    ),
  );
  if (!lines.length) return "";
  return (
    `\n\nMateriales del programa (archivos que puedes enviar en el chat):\n` +
    lines.join("\n") +
    `\nCuando el arco lo pida, envía el material incluyendo su marcador exacto ` +
    `(ej: [[adjunto:abc123]]) en una línea propia de tu respuesta; el sistema lo ` +
    `reemplaza por el archivo real. Preséntalo con una frase breve antes del ` +
    `marcador. No inventes marcadores que no estén en esta lista ni describas ` +
    `el marcador en palabras.`
  );
}
