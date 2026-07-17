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
