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
  /** Protocolo ante riesgo de la organización (null = nunca lo configuró). */
  protocol?: AlertProtocol | null;
}

export type AlertChannel = "email" | "telegram" | "whatsapp";

/**
 * Protocolo ante riesgo (tabla alert_protocols, migración 010). Solo si está
 * activo la organización recibe alertas; sin protocolo las revisa Plural.
 */
export interface AlertProtocol {
  responsibleName: string | null;
  channel: AlertChannel | null;
  channelTarget: string | null;
  responseTimeHours: number | null;
  active: boolean;
}

/** Protocolo utilizable: activo y completo (quién, por dónde, en cuánto tiempo). */
export type ActiveAlertProtocol = AlertProtocol & {
  active: true;
  responsibleName: string;
  channel: AlertChannel;
  channelTarget: string;
  responseTimeHours: number;
};

export function activeProtocol(p: AlertProtocol | null | undefined): ActiveAlertProtocol | null {
  if (!p || !p.active) return null;
  if (!p.responsibleName || !p.channel || !p.channelTarget || !p.responseTimeHours) return null;
  return p as ActiveAlertProtocol;
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
  /** ¿La organización tiene protocolo activo? (el aviso a Plural lo dice) */
  orgProtocolActive?: boolean;
}

/** Aviso al equipo de Plural (siempre, con o sin protocolo). */
export interface AlertNotifier {
  notify(alert: HighAlert): Promise<void>;
}

/** Aviso a la organización: solo si su protocolo está activo. Mismo contenido sin texto. */
export interface OrgAlertNotifier {
  notify(alert: HighAlert, protocol: ActiveAlertProtocol): Promise<void>;
}

/** Una llamada al LLM: prompt → texto crudo. */
export type LlmCall = (input: { model: string; prompt: string }) => Promise<string>;
