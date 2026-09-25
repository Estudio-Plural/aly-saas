// Contratos del supervisor de conversaciones. Todo lo que toca el mundo
// (DB, LLM, notificaciones) entra por interfaces para poder mockearlo en tests.

import type { CorePrompt, Storyboard, StoryboardMomentKey } from "../config/identity";

export type Severity = "HIGH" | "MEDIUM" | "LOW";

/** Regla de alerta del workspace (workspace_configs.flag_rules). */
export interface FlagRule {
  id: string;
  description: string;
  severity: "high" | "medium" | "low";
}

/** Conversación candidata: inactiva y sin análisis al día. */
export interface IdleConversation {
  workspaceId: string;
  conversationId: string;
  clientNumber: string;
  messagesCount: number;
  lastMessageAt: Date;
  /** Timestamp del último mensaje cubierto por el análisis previo (null = nunca). */
  analyzedThrough: Date | null;
}

export interface SupervisorMessage {
  id: string;
  role: string; // "user" | "assistant"
  text: string;
  timestamp: Date;
}

/** Lo que el agente necesita saber del workspace (sus "herramientas" de lectura). */
export interface WorkspaceContext {
  workspaceId: string;
  slug: string;
  name: string;
  rules: FlagRule[];
  core: CorePrompt;
  storyboard: Storyboard;
  /** Modelo del analista (model_preferences.supervisor → .chat → env). */
  model: string;
}

export interface FlagEvidence {
  /** Índice del mensaje en la conversación (0 = primero). */
  messageIndex: number;
  messageId: string;
  /** Copia textual verificada contra el mensaje. */
  fragment: string;
}

export interface VerifiedFlag {
  ruleId: string;
  ruleDescription: string;
  /** Sale de la regla configurada, nunca del LLM. */
  severity: Severity;
  detail: string;
  evidence: FlagEvidence[];
}

/** Resultado estructurado que se guarda en conversations_data.analysis. */
export interface SupervisedAnalysis {
  version: 1;
  summary: string | null;
  keywords: string[];
  momentoAlcanzado: StoryboardMomentKey | null;
  cumplioCriterioExito: {
    value: boolean;
    evidence: { messageIndex: number; messageId: string }[];
  };
  flags: VerifiedFlag[];
  /** Flags que el LLM propuso pero no pasaron la verificación determinista. */
  discardedFlags: number;
  model: string;
}

export interface SaveAnalysisInput {
  conversation: IdleConversation;
  analysis: SupervisedAnalysis;
  /** CSV legacy "HIGH-detalle, MEDIUM-detalle" (lo lee el inbox). */
  flagsText: string | null;
  flagSeverity: Severity | null;
  /** Último mensaje que el análisis cubrió (guard de idempotencia). */
  analyzedThrough: Date;
  /** Hay flags con evidencia nueva → la alerta vuelve a "pendiente". */
  resetReview: boolean;
}

/** Acceso a datos del supervisor (implementación SQL en store.ts). */
export interface SupervisorStore {
  listIdleConversations(idleMinutes: number, limit: number): Promise<IdleConversation[]>;
  getMessages(workspaceId: string, conversationId: string): Promise<SupervisorMessage[]>;
  getWorkspaceContext(workspaceId: string): Promise<WorkspaceContext | null>;
  /** Devuelve false si otro análisis más nuevo ya estaba guardado (no pisa). */
  saveAnalysis(input: SaveAnalysisInput): Promise<boolean>;
}

/**
 * Alerta HIGH para el equipo. Deliberadamente SIN texto de mensajes, detalle
 * ni fragmentos: los usuarios pueden ser menores y el canal es externo.
 */
export interface HighAlert {
  workspaceSlug: string;
  conversationId: string;
  ruleId: string;
  ruleDescription: string;
  severity: "HIGH";
}

export interface AlertNotifier {
  notify(alert: HighAlert): Promise<void>;
}

/** Una llamada al LLM: prompt → texto crudo. */
export type LlmCall = (input: { model: string; prompt: string }) => Promise<string>;
