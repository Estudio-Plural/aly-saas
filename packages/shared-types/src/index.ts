// Shared TypeScript types between frontend and backend
// (alineados con supabase/migrations — ver 001 y 003)

export type WorkspaceRole = "owner" | "admin" | "member";

export type SubscriptionStatus = "trial" | "active" | "canceled" | "past_due";

export type KapsoConnectionStatus = "pending" | "connected" | "error";

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  assistant_name: string;
  owner_user_id: string;
  subscription_status: SubscriptionStatus;
  whatsapp_phone_number: string | null;
  kapso_connection_status: KapsoConnectionStatus;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceUser {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

// Capacidades estructurales del pipeline (ex ramas botId==="demo" del Aly-legacy).
export interface WorkspaceCapabilities {
  /** Triage de mensajes sensibles/riesgo → respuesta empática RAG-grounded. */
  sensitive_safety: boolean;
  /** Juntar slots de contexto antes de responder (ex slot-filling de clase). */
  context_gathering: { on: boolean; slots: string[] };
  /** Responder "sobre mi organización" desde un perfil estático (ex nodo identity). */
  org_identity: boolean;
}

export interface WorkspaceConfig {
  workspace_id: string;
  theme_categories: string[];
  model_preferences: Record<string, string>;
  /**
   * Bundle de prompts del pipeline (campos _es/_en + compartidos). Vacío = usa
   * el template default del engine. La key legacy `system` (chat de juguete)
   * queda ignorada por el pipeline.
   */
  prompts: Record<string, string>;
  /** Flags de capacidades del pipeline (migración 006). */
  capabilities: WorkspaceCapabilities;
  /** Partición del corpus para retrieval, en orden de prioridad (migración 006). */
  programs: string[];
  flag_rules: { id: string; description: string; severity: "high" | "medium" | "low" }[];
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  size: number;
  storage_path: string;
  text_content: string | null;
  created_at: string;
}

// Flujo de onboarding: pasos secuenciales (builder de la UI)
export type OnboardingStepType = "question" | "message" | "end";

export interface OnboardingStep {
  id: string;
  type: OnboardingStepType;
  content: string;
  /** Solo para type "question": variable donde se guarda la respuesta */
  variable?: string;
}

export interface OnboardingFlow {
  id: string;
  workspace_id: string;
  name: string;
  definition: {
    steps: OnboardingStep[];
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OnboardingSession {
  id: string;
  flow_id: string;
  user_number: string;
  state: {
    current_step: string;
    answers: Record<string, string>;
  };
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
