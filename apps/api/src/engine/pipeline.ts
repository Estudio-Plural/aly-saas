// Pipeline — orquestador plain-TS que reproduce la topología del LangGraph de
// 16 nodos del Aly-legacy, ahora config-driven por workspace_id.
//
// prepare → normalize → triage → [sensitive]
//                              → fanout(intent ∥ librarian) → route:
//                                   SENSITIVE(safety-net) / IDENTITY / SMALLTALK
//                                   / retrieve → {factual | plan | ideate}
//
// `retrieve` hace búsqueda vectorial (pgvector) con failsafe al puente de
// texto plano de documents; el slot-filling (collectContext) queda pendiente
// detrás de context_gathering.

import { invalidateBotConfig, resolveBotConfig, type BotConfig } from "../config";
import * as agents from "./agents";
import { formatHistory, getHistory, saveHistory } from "./history";
import { INTENTS, type IntentType } from "./params";
import { listDocCatalog, retrieveContext, type ChunkSource } from "./retrieval";

export interface QuestionInput {
  question: string;
  userNumber: string;
  language: string; // es | en | auto
  conversationId: string;
  workspaceId: string;
  /**
   * Turno efímero (banco de casos difíciles del panel): sin historial y sin
   * persistir nada en users_interactions — no es una conversación real.
   * Además lee la config fresca (sin la cache de 5 min): prueba lo último guardado.
   */
  ephemeral?: boolean;
}

export interface QueryResponse {
  answer: string;
  intent: IntentType;
  confidence: number;
  chunks: ChunkSource[];
}

export async function processQuestion(input: QuestionInput): Promise<QueryResponse> {
  const { question, userNumber, language, conversationId, workspaceId } = input;
  console.log(`\n🚀 processQuestion ws=${workspaceId} lang=${language} q="${question}"`);

  // ── prepare: config del workspace + historia ──────────────────────────────
  if (input.ephemeral) invalidateBotConfig(workspaceId);
  const config = await resolveBotConfig(workspaceId, language);
  const history = input.ephemeral
    ? []
    : await getHistory(workspaceId, conversationId, config.prompts.factualNoContextFallback);
  const historyString = formatHistory(history);

  // ── normalize (reescribe el mensaje) ──────────────────────────────────────
  const standalone = await agents.normalize(question, historyString, config);

  // ── triage: pre-filtro sensible, lee la pregunta ORIGINAL ────────────────
  const isSensitive = config.capabilities.sensitive_safety
    ? await agents.triage(question, config)
    : false;

  if (isSensitive) {
    return sensitiveTurn(input, standalone, historyString, config, 1);
  }

  // ── fanout: intent ∥ doc-router (en paralelo, como el librarian del legacy).
  // El librarian temático (runLibrarian) vuelve en Fase 2 con pgvector; en el
  // puente de texto el ruteo útil es por-documento, no por categoría.
  const [intentRes, routedDocIds] = await Promise.all([
    agents.classifyIntent(standalone, config),
    selectDocuments(workspaceId, standalone, config),
  ]);
  const intent = intentRes.intent;
  const confidence = intentRes.confidence;

  // ── routeAfterFanOut ──────────────────────────────────────────────────────

  // safety-net: intent detectó SENSITIVE aunque triage lo dejó pasar
  if (intent === INTENTS.SENSITIVE) {
    return sensitiveTurn(input, standalone, historyString, config, confidence);
  }

  // identity: responde desde el perfil estático de la organización (sin retrieval)
  if (
    intent === INTENTS.IDENTITY &&
    config.capabilities.org_identity &&
    config.prompts.orgProfile.trim()
  ) {
    return finish(
    input,
      await agents.identityAgent(standalone, language, config),
      INTENTS.IDENTITY,
      confidence,
      [],
    );
  }

  // TODO Fase 0.x: context_gathering (slot-filling). Cuando esté on, este es el
  // punto donde entraría el nodo collectContext antes de PLAN. Por ahora, si la
  // capability está activa se sigue derecho a retrieve→plan.

  // smalltalk: social/conversacional, sin retrieval
  if (intent === INTENTS.SMALLTALK) {
    return finish(
    input,
      await agents.smalltalkAgent(standalone, language, historyString, config),
      INTENTS.SMALLTALK,
      confidence,
      [],
    );
  }

  // retrieve → agente terminal por intención (búsqueda vectorial con la query
  // normalizada; failsafe interno al texto plano)
  const { context, chunks } = await retrieveContext(workspaceId, routedDocIds, standalone);
  let answer: string;
  if (intent === INTENTS.PLAN) {
    answer = await agents.planAgent(standalone, context, language, historyString, config);
  } else if (intent === INTENTS.IDEATE) {
    answer = await agents.ideateAgent(standalone, context, language, historyString, config);
  } else {
    answer = await agents.factualAgent(standalone, context, language, historyString, config);
  }

  return finish(
    input,
    answer,
    intent,
    confidence,
    chunks,
  );
}

// Turno sensible: el momento más delicado no puede ser el más genérico. Lleva
// historia, identidad (vía el agente) y contexto recuperado de TODOS los docs
// del workspace — el protocolo de derivación puede no estar entre los que el
// doc-router eligió. Si el retrieval falla, se responde igual sin contexto:
// este camino nunca puede caerse por la base.
async function sensitiveTurn(
  input: QuestionInput,
  standalone: string,
  historyString: string,
  config: BotConfig,
  confidence: number,
): Promise<QueryResponse> {
  const { question, userNumber, language, conversationId, workspaceId } = input;
  let context = "";
  let chunks: ChunkSource[] = [];
  try {
    ({ context, chunks } = await retrieveContext(workspaceId, [], standalone));
  } catch (error) {
    console.error("❌ SENSITIVE retrieval failed, answering without context:", error);
  }
  return finish(
    input,
    await agents.sensitiveAgent(question, context, language, historyString, config),
    INTENTS.SENSITIVE,
    confidence,
    chunks,
  );
}

// Ruteo de documentos: con 0-1 docs no hay nada que decidir (sin LLM call);
// con más, el doc-router elige el subconjunto. [] = todos (failsafe).
async function selectDocuments(
  workspaceId: string,
  question: string,
  config: BotConfig,
): Promise<string[]> {
  const catalog = await listDocCatalog(workspaceId);
  if (catalog.length <= 1) return [];
  return agents.routeDocuments(question, catalog, config);
}

async function finish(
  input: QuestionInput,
  answer: string,
  intent: IntentType,
  confidence: number,
  chunks: ChunkSource[],
): Promise<QueryResponse> {
  const { workspaceId, conversationId, userNumber, question } = input;
  if (!input.ephemeral) {
    await saveHistory(workspaceId, conversationId, userNumber, question, answer);
  }
  console.log(`✅ processQuestion completed (intent: ${intent})`);
  return { answer, intent, confidence, chunks };
}
