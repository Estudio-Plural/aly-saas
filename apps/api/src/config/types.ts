// Contrato de configuración que consume el pipeline de 16 nodos.
// Reemplaza a getAgentPrompts + BOT_ID_PROGRAMS + los checks botId==="demo"
// del Aly-legacy.
//
// Fase 0: vive en apps/web/lib para poder testearse ya con el cliente
// postgres.js existente. Cuando el engine se mude a apps/api, este módulo pasa
// a un paquete compartido sin cambios de contrato.

/** Prompts del pipeline ya resueltos para UN idioma (es | en). */
export interface AgentPrompts {
  normalizeQuestion: string;
  triage: string;
  intent: string;
  librarian: string;
  keywordExtraction: string;
  factual: string;
  plan: string;
  ideate: string;
  sensitive: string;
  smalltalk: string;
  factualNoContextFallback: string;
  sensitiveFallback: string;
  /** Perfil estático de la organización (ex EQUIMUNDO_PROFILE). "" = deshabilitado. */
  orgProfile: string;
}

/** Capacidades estructurales del grafo — antes ramas botId==="demo". */
export interface Capabilities {
  /** Triage de mensajes sensibles/riesgo → respuesta empática RAG-grounded. */
  sensitive_safety: boolean;
  /** Juntar slots de contexto antes de responder (ex slot-filling de clase). */
  context_gathering: { on: boolean; slots: string[] };
  /** Responder "sobre mi organización" desde el perfil estático (ex nodo identity). */
  org_identity: boolean;
}

/** Lo que el grafo recibe por request, resuelto para un idioma concreto. */
export interface BotConfig {
  prompts: AgentPrompts;
  /**
   * Modelo por agente (con defaults del engine mergeados por debajo). Claves:
   * normalize, triage, intent, librarian, keyword, factual, plan, ideate,
   * sensitive, smalltalk.
   */
  models: Record<string, string>;
  /** Partición del corpus para retrieval, en orden de prioridad. */
  programs: string[];
  capabilities: Capabilities;
  /** Categorías temáticas para el librarian (derivadas del corpus del tenant). */
  themeCategories: string[];
  /** Bloque de identidad (prompt núcleo + storyboard) para los agentes de cara al usuario. */
  identity: string;
}

/**
 * Forma cruda del JSONB `workspace_configs.prompts`: variantes por idioma
 * (_es/_en) + campos compartidos (sin sufijo). `resolveBotConfig()` elige es/en
 * y produce `AgentPrompts`. Todos los campos son opcionales: lo que falte cae,
 * campo a campo, al template default del engine.
 */
export interface RawPromptStore {
  normalize_es?: string;
  normalize_en?: string;
  triage_es?: string;
  triage_en?: string;
  intent?: string;
  librarian_es?: string;
  librarian_en?: string;
  keyword_extraction?: string;
  factual_es?: string;
  factual_en?: string;
  plan_es?: string;
  plan_en?: string;
  ideate_es?: string;
  ideate_en?: string;
  sensitive_es?: string;
  sensitive_en?: string;
  smalltalk_es?: string;
  smalltalk_en?: string;
  factual_no_context_fallback_es?: string;
  factual_no_context_fallback_en?: string;
  sensitive_message?: string;
  org_profile_es?: string;
  org_profile_en?: string;
  /** Legacy: el chat de juguete guardaba {system}. Ignorado por el pipeline. */
  system?: string;
}
