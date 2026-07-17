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

import { resolveBotConfig, type BotConfig } from "../config";
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
  const config = await resolveBotConfig(workspaceId, language);
  const history = await getHistory(
    workspaceId,
    conversationId,
    config.prompts.factualNoContextFallback,
  );
  const historyString = formatHistory(history);

  // ── normalize (reescribe el mensaje) ──────────────────────────────────────
  const standalone = await agents.normalize(question, historyString, config);

  // ── triage: pre-filtro sensible, lee la pregunta ORIGINAL ────────────────
  const isSensitive = config.capabilities.sensitive_safety
    ? await agents.triage(question, config)
    : false;

  if (isSensitive) {
    return finish(
      workspaceId,
      conversationId,
      userNumber,
      question,
      await agents.sensitiveAgent(question, "", language, config),
      INTENTS.SENSITIVE,
      1,
      [],
    );
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
    return finish(
      workspaceId,
      conversationId,
      userNumber,
      question,
      await agents.sensitiveAgent(question, "", language, config),
      INTENTS.SENSITIVE,
      confidence,
      [],
    );
  }

  // identity: responde desde el perfil estático de la organización (sin retrieval)
  if (
    intent === INTENTS.IDENTITY &&
    config.capabilities.org_identity &&
    config.prompts.orgProfile.trim()
  ) {
    return finish(
      workspaceId,
      conversationId,
      userNumber,
      question,
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
      workspaceId,
      conversationId,
      userNumber,
      question,
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
    workspaceId,
    conversationId,
    userNumber,
    question,
    answer,
    intent,
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
  workspaceId: string,
  conversationId: string,
  userNumber: string,
  question: string,
  answer: string,
  intent: IntentType,
  confidence: number,
  chunks: ChunkSource[],
): Promise<QueryResponse> {
  await saveHistory(workspaceId, conversationId, userNumber, question, answer);
  console.log(`✅ processQuestion completed (intent: ${intent})`);
  return { answer, intent, confidence, chunks };
}
