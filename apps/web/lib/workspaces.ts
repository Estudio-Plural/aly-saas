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
  /** Organización dueña del programa (migración 011). */
  org_id: string;
  org_name: string;
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

/** Revisión de un documento recién subido (Material). */
export type UploadReview = {
  documentId: string;
  name: string;
  /** Se pudo leer texto (un PDF escaneado no). */
  readable: boolean;
  totalChars: number;
  /** Texto que quedó afuera por el tope de 20.000 caracteres. */
  omittedChars: number;
  /** Fragmentos indexados para la búsqueda; null = sin índice (se usa el texto completo). */
  fragments: number | null;
  /** Encabezados Markdown detectados (solo .md). */
  headings: number;
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

/**
 * Prompt núcleo del asistente. Desde 2026-09 lo edita «Tu programa»
 * (misión, a quién acompaña, criterio de éxito y voz). Los campos vacíos caen
 * al ejemplo (DEFAULT_CORE_PROMPT) al compilar el prompt.
 */
export type CorePrompt = {
  /** Para qué existe el asistente. */
  mission: string;
  /** A quién acompaña. */
  audience?: string;
  /** Cuándo una conversación va bien. */
  success_criteria: string;
  /** Voz: tono general. */
  voice_tone?: string;
  /** Voz: palabras y giros que usa. */
  voice_use?: string;
  /** Voz: palabras y giros que evita. */
  voice_avoid?: string;
  /** Legacy (Identidad 2026-07): hoy lo cubre «Qué no hace». */
  scope?: string;
  /** Legacy (Identidad 2026-07). */
  key_actions?: string;
};

export type CorePromptField =
  | "mission"
  | "audience"
  | "success_criteria"
  | "voice_tone"
  | "voice_use"
  | "voice_avoid";

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

/** Ejemplos editables (no valores del usuario): se muestran como ejemplo y rellenan el prompt si el campo está vacío. */
export const DEFAULT_CORE_PROMPT: Record<CorePromptField, string> = {
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

export type ChatMessage = {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: string;
};

/** Lo que ve un cliente en lugar del texto de las conversaciones (decisión de producto). */
export const TRANSCRIPCIONES_SOLO_PLURAL =
  "Las conversaciones completas solo las ve el equipo de Plural, por la privacidad de las personas.";

/** Fila del inbox de conversaciones (lista agregada por conversación). */
export type ConversationSummary = {
  conversationId: string;
  clientNumber: string;
  userName: string | null;
  isWebPreview: boolean;
  /** null cuando quien mira no puede ver transcripciones (rol cliente). */
  lastMessage: string | null;
  lastMessageRole: "user" | "assistant";
  messagesCount: number;
  isOpen: boolean;
  startedAt: string;
  lastAt: string;
  summary: string | null;
  keywords: string[];
  flags: string | null;
  flagSeverity: string | null;
  /** Alerta marcada como revisada por el equipo (null = pendiente). */
  reviewedAt: string | null;
  reviewedBy: string | null;
  /** Análisis estructurado del supervisor del engine (null si no corrió). */
  supervision: ConversationSupervision | null;
};

/**
 * Análisis del supervisor de conversaciones (conversations_data.analysis,
 * lo escribe apps/api/src/supervisor). La evidencia de cada flag ya viene
 * verificada: el fragmento existe textual en el mensaje citado.
 */
export type ConversationSupervision = {
  version: 1;
  summary: string | null;
  keywords: string[];
  momentoAlcanzado: StoryboardMomentKey | null;
  cumplioCriterioExito: {
    value: boolean;
    evidence: { messageIndex: number; messageId: string }[];
  };
  flags: {
    ruleId: string;
    ruleDescription: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    detail: string;
    evidence: { messageIndex: number; messageId: string; fragment: string }[];
  }[];
  discardedFlags: number;
  model: string;
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
