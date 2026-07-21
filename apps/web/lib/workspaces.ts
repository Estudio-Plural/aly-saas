// Tipos compartidos entre páginas + helpers client-safe.
// Las queries reales viven en lib/data/* (solo servidor).

export type SubscriptionStatus = "trial" | "active" | "canceled" | "past_due";

export type KapsoConnectionStatus = "pending" | "connected" | "error";

export type WorkspaceStats = {
  documents: number;
  conversations: number;
  users: number;
};

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  assistant_name: string;
  subscription_status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
  whatsapp_phone_number: string | null;
  kapso_connection_status: KapsoConnectionStatus;
  stats: WorkspaceStats;
};

export type DocumentRow = {
  id: string;
  name: string;
  type: string;
  size: number;
  created_at: string;
  /** Metadatos generados por LLM al subir (null si no había API key o falló) */
  summary: string | null;
  keywords: string[];
  theme_category: string | null;
  /** Cuándo debe consultarse este documento — auto-generado, editable por el usuario */
  routing_hint: string | null;
};

export type FlagSeverity = "high" | "medium" | "low";

/** Regla del flagging system, definida por el dueño del workspace en lenguaje natural. */
export type FlagRule = {
  id: string;
  description: string;
  severity: FlagSeverity;
};

export type OnboardingStepType = "question" | "message" | "end";

export type OnboardingStep = {
  id: string;
  type: OnboardingStepType;
  content: string;
  variable?: string;
};

/** Prompt núcleo: carácter y objetivo del asistente (feedback Daniel 2026-07). */
export type CorePrompt = {
  /** Para qué existe el asistente y a quién acompaña. */
  mission: string;
  /** Qué temas sí y cuáles no; qué límites tiene. */
  scope: string;
  /** Cuándo se considera exitosa una interacción. */
  success_criteria: string;
  /** Acciones clave que la persona debería realizar. */
  key_actions: string;
};

export type StoryboardMomentKey =
  | "opening"
  | "development"
  | "next_steps"
  | "closing";

/** Material (imagen, PDF, video, audio…) que el asistente puede enviar en el chat. */
export type StoryboardAttachment = {
  id: string;
  name: string;
  /** MIME type del archivo. */
  type: string;
  size: number;
  storage_path: string;
};

/** Storyboard situacional: el arco de la conversación en 4 momentos. */
export type Storyboard = {
  /** Arranque: cómo empieza la conversación. */
  opening: string;
  /** Qué pasa: el desarrollo del programa. */
  development: string;
  /** Qué debe pasar después: el paso concreto que sigue. */
  next_steps: string;
  /** Cómo termina: el cierre de cada interacción. */
  closing: string;
  /** Materiales por momento; el asistente los envía con el marcador [[adjunto:id]]. */
  attachments?: Partial<Record<StoryboardMomentKey, StoryboardAttachment[]>>;
};

export const STORYBOARD_MOMENT_LABELS: Record<StoryboardMomentKey, string> = {
  opening: "Arranque",
  development: "Desarrollo",
  next_steps: "Lo que debe pasar después",
  closing: "Cierre",
};

/** Etiqueta humana del tipo de material según su MIME type. */
export function attachmentKind(mime: string): string {
  if (mime.startsWith("image/")) return "imagen";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "PDF";
  return "archivo";
}

/** Aplana los materiales del storyboard preservando su momento. */
export function listStoryboardAttachments(
  storyboard: Storyboard
): { moment: StoryboardMomentKey; attachment: StoryboardAttachment }[] {
  const moments = Object.keys(STORYBOARD_MOMENT_LABELS) as StoryboardMomentKey[];
  return moments.flatMap((moment) =>
    (storyboard.attachments?.[moment] ?? []).map((attachment) => ({
      moment,
      attachment,
    }))
  );
}

/** Defaults con enfoque comportamental (programa de cambio de comportamiento). */
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

/**
 * Compila el prompt núcleo + storyboard en el bloque de identidad que se
 * inyecta en los prompts del agente (web fallback y engine).
 */
export function compileIdentityBlock(
  assistantName: string,
  workspaceName: string,
  core: CorePrompt,
  storyboard: Storyboard
): string {
  return (
    `Sos ${assistantName}, el asistente conversacional de "${workspaceName}". ` +
    `Respondés en español rioplatense, con mensajes breves y cálidos, como en un chat de WhatsApp.\n\n` +
    `Tu misión: ${core.mission}\n\n` +
    `Tu alcance (qué debés y qué no debés hacer): ${core.scope}\n\n` +
    `Una interacción es exitosa cuando: ${core.success_criteria}\n\n` +
    `Buscás que la persona realice estas acciones clave: ${core.key_actions}\n\n` +
    `La conversación sigue este arco (adaptalo al momento de cada persona):\n` +
    `1) Arranque: ${storyboard.opening}\n` +
    `2) Desarrollo: ${storyboard.development}\n` +
    `3) Lo que debe pasar después: ${storyboard.next_steps}\n` +
    `4) Cierre: ${storyboard.closing}` +
    compileMaterialsBlock(storyboard)
  );
}

/**
 * Sección de materiales del bloque de identidad: lista los adjuntos del
 * storyboard con su marcador [[adjunto:id]]. El chat convierte el marcador
 * en el archivo real al renderizar (y WhatsApp lo hará al enviar).
 */
function compileMaterialsBlock(storyboard: Storyboard): string {
  const materials = listStoryboardAttachments(storyboard);
  if (!materials.length) return "";
  const lines = materials.map(
    ({ moment, attachment }) =>
      `- [[adjunto:${attachment.id}]] → "${attachment.name}" (${attachmentKind(attachment.type)}) — momento: ${STORYBOARD_MOMENT_LABELS[moment]}`
  );
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

export type ChatMessage = {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: string;
};

/** Fila del inbox de conversaciones (lista agregada por conversación). */
export type ConversationSummary = {
  conversationId: string;
  clientNumber: string;
  userName: string | null;
  isWebPreview: boolean;
  lastMessage: string;
  lastMessageRole: "user" | "assistant";
  messagesCount: number;
  isOpen: boolean;
  startedAt: string;
  lastAt: string;
  summary: string | null;
  keywords: string[];
  flags: string | null;
  flagSeverity: string | null;
};

/** Convierte un nombre en un slug URL-safe (sin acentos ni símbolos). */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // quita acentos
      .replace(/[^a-z0-9\s-]/g, "") // quita símbolos
      .replace(/\s+/g, "-") // espacios a guiones
      .replace(/-+/g, "-") // colapsa guiones repetidos
      .replace(/^-|-$/g, "") || // recorta guiones de los extremos
    "workspace"
  );
}
