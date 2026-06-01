// Shared TypeScript types between frontend and backend

export type WorkspaceRole = "owner" | "admin" | "member";

export type SubscriptionStatus = "trial" | "active" | "canceled" | "past_due";

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  assistant_name: string;
  owner_user_id: string;
  subscription_status: SubscriptionStatus;
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

export interface OnboardingFlow {
  id: string;
  workspace_id: string;
  name: string;
  graph_definition: {
    nodes: OnboardingNode[];
    edges: OnboardingEdge[];
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OnboardingNodeType =
  | "input_text"
  | "input_email"
  | "input_phone"
  | "input_select"
  | "conditional"
  | "action"
  | "complete";

export interface OnboardingNode {
  id: string;
  type: OnboardingNodeType;
  data: Record<string, any>;
  position: { x: number; y: number };
}

export interface OnboardingEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface OnboardingSession {
  id: string;
  flow_id: string;
  user_number: string;
  state: {
    current_node: string;
    answers: Record<string, any>;
  };
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
