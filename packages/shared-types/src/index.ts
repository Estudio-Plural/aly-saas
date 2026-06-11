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

export interface WorkspaceConfig {
  workspace_id: string;
  theme_categories: string[];
  model_preferences: Record<string, string>;
  prompts: Record<string, string>;
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
