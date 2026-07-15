// Template default del engine — el fallback de resolveBotConfig().
//
// Es la línea base de un asistente de negocio genérico: lo que corre un tenant
// nuevo ANTES de que el prompt compiler (Fase 1) genere sus prompts a medida.
// Cada campo del JSONB workspace_configs.prompts que un workspace no defina cae
// acá, campo a campo. Los prompts hechos a mano de demo/apapachar/mexico se
// seedean en la DB (paso 4) y pisan estos defaults.

import type { Capabilities, RawPromptStore } from "./types";

/** Modelos por defecto por agente (ids de OpenRouter, heredados de Aly-legacy). */
export const DEFAULT_MODELS: Record<string, string> = {
  normalize: "openai/gpt-5.4-nano",
  triage: "openai/gpt-5.4-nano",
  intent: "openai/gpt-5.4",
  librarian: "openai/gpt-5.4-nano",
  keyword: "openai/gpt-5.4-nano",
  factual: "openai/gpt-4o-mini",
  plan: "google/gemini-2.5-flash-lite",
  ideate: "anthropic/claude-haiku-4.5",
  sensitive: "google/gemini-2.5-flash",
  smalltalk: "google/gemini-2.5-flash-lite",
};

/** Capacidades por defecto: seguridad on; slot-filling e identidad off. */
export const DEFAULT_CAPABILITIES: Capabilities = {
  sensitive_safety: true,
  context_gathering: { on: false, slots: [] },
  org_identity: false,
};

/** Categorías temáticas por defecto para el librarian (= default de la migración 001). */
export const DEFAULT_THEME_CATEGORIES: string[] = [
  "marco_teorico",
  "tips_facilitadores",
  "mejores_practicas",
  "rompehielos",
  "conocimientos_generales",
  "sensitive",
];

/**
 * Prompts default (asistente de negocio genérico). Deliberadamente neutros: no
 * mencionan ningún programa/marca concreta. El compiler (Fase 1) los reemplaza.
 *
 * ⚠️ Los placeholders NO son opcionales: agents.ts inserta la pregunta/contexto
 * reemplazando {user_input} / {query} / {context} / {history} DENTRO del
 * template. Un prompt sin su placeholder deja al modelo sin el mensaje del
 * usuario (responde eco de las instrucciones).
 */
export const DEFAULT_RAW_PROMPTS: Required<Omit<RawPromptStore, "system">> = {
  // ── Normalize ────────────────────────────────────────────────────────────
  normalize_es:
    "Reescribí el mensaje del usuario para dejarlo claro y autónomo. Corregí ortografía y tipeos. " +
    "Si hay historial, resolvé referencias vagas o de seguimiento (\"eso\", \"el punto 2\") en una pregunta completa. " +
    "EXCEPCIÓN: si el mensaje es puramente social (saludo, gracias, despedida, cortesía), devolvelo casi igual, solo corrigiendo ortografía. " +
    "Devolvé SOLO el mensaje reescrito, sin explicaciones.\n\n" +
    "Historial:\n{history}\n\nMensaje del usuario: {user_input}\n\nMensaje reescrito:",
  normalize_en:
    "Rewrite the user's message so it is clear and standalone. Fix spelling and typos. " +
    "If there is history, resolve vague or follow-up references (\"that\", \"point 2\") into a full question. " +
    "EXCEPTION: if the message is purely social (greeting, thanks, farewell, courtesy), return it almost unchanged, only fixing spelling. " +
    "Return ONLY the rewritten message, no explanations.\n\n" +
    "History:\n{history}\n\nUser message: {user_input}\n\nRewritten message:",

  // ── Triage (pre-filtro de sensibles) ──────────────────────────────────────
  triage_es:
    "Sos un detector de seguridad. Respondé únicamente SENSITIVE o NOT_SENSITIVE. " +
    "SENSITIVE si el mensaje expresa crisis, riesgo, autolesión, violencia, abuso o angustia grave. En cualquier otro caso, NOT_SENSITIVE.\n\n" +
    "Mensaje del usuario: {user_input}",
  triage_en:
    "You are a safety detector. Answer only SENSITIVE or NOT_SENSITIVE. " +
    "SENSITIVE if the message expresses crisis, risk, self-harm, violence, abuse or severe distress. Otherwise, NOT_SENSITIVE.\n\n" +
    "User message: {user_input}",

  // ── Intent (compartido) ───────────────────────────────────────────────────
  intent:
    "Classify the user's message into exactly one intent: FACTUAL (asks for information/answers), " +
    "PLAN (asks to build/structure/plan something), IDEATE (asks for ideas/alternatives), " +
    "SMALLTALK (social/conversational: greetings, thanks, courtesy, meta-questions about the assistant), " +
    "or SENSITIVE (crisis/risk/distress). When in doubt between SMALLTALK and FACTUAL, choose FACTUAL. " +
    'Respond with JSON only: {"intent": "...", "confidence": 0.0-1.0}.\n\n' +
    'User message: "{user_input}"',

  // ── Librarian ─────────────────────────────────────────────────────────────
  librarian_es:
    "Elegí qué categorías temáticas aplican a la búsqueda de conocimiento para esta pregunta. " +
    'Respondé SOLO JSON: {"theme_filters": ["..."]}. Si ninguna aplica claramente, devolvé {"theme_filters": []}.\n\n' +
    "Pregunta: {query}",
  librarian_en:
    "Choose which theme categories apply to the knowledge search for this question. " +
    'Respond with JSON only: {"theme_filters": ["..."]}. If none clearly apply, return {"theme_filters": []}.\n\n' +
    "Question: {query}",

  // ── Keyword extraction (compartido) ───────────────────────────────────────
  keyword_extraction:
    "Extract 3-5 lowercase search terms from the question for a metadata pre-filter. " +
    'Respond with a JSON array only, e.g. ["term1","term2","term3"].',

  // ── Factual ───────────────────────────────────────────────────────────────
  factual_es:
    "Sos el asistente del negocio. Respondé de forma clara y concreta usando SOLO el contexto provisto. " +
    "Si el contexto no alcanza para responder, decilo con honestidad y ofrecé derivar la consulta a una persona del equipo. " +
    "No inventes datos que no estén en el contexto.\n\n" +
    "Contexto:\n{context}\n\nPregunta: {query}",
  factual_en:
    "You are the business assistant. Answer clearly and concisely using ONLY the provided context. " +
    "If the context is not enough to answer, say so honestly and offer to route the query to a team member. " +
    "Do not invent facts that are not in the context.\n\n" +
    "Context:\n{context}\n\nQuestion: {query}",

  // ── Plan ──────────────────────────────────────────────────────────────────
  plan_es:
    "Producí un plan breve y estructurado en base a la pregunta y al contexto provisto. " +
    "Usá pasos claros y numerados. Mantené el foco en lo accionable.\n\n" +
    "Contexto:\n{context}\n\nPedido: {query}",
  plan_en:
    "Produce a short, structured plan based on the question and the provided context. " +
    "Use clear, numbered steps. Keep it actionable.\n\n" +
    "Context:\n{context}\n\nRequest: {query}",

  // ── Ideate ────────────────────────────────────────────────────────────────
  ideate_es:
    "Ofrecé 3-5 ideas o alternativas creativas y concretas en base a la pregunta y al contexto. " +
    "Que cada idea sea breve y distinta de las demás.\n\n" +
    "Contexto:\n{context}\n\nPedido: {query}",
  ideate_en:
    "Offer 3-5 creative, concrete ideas or alternatives based on the question and the context. " +
    "Keep each idea short and distinct from the others.\n\n" +
    "Context:\n{context}\n\nRequest: {query}",

  // ── Sensitive ─────────────────────────────────────────────────────────────
  sensitive_es:
    "Respondé con empatía y calidez a una situación de riesgo o angustia. Validá lo que la persona siente, " +
    "no minimices, y apoyate en el contexto provisto si trae orientación específica. Sugerí buscar ayuda de una persona de confianza o un profesional cuando corresponda.\n\n" +
    "Contexto:\n{context}\n\nMensaje de la persona: {user_input}",
  sensitive_en:
    "Respond with empathy and warmth to a situation of risk or distress. Validate the person's feelings, " +
    "do not minimize, and lean on the provided context if it offers specific guidance. Suggest reaching out to a trusted person or a professional when appropriate.\n\n" +
    "Context:\n{context}\n\nPerson's message: {user_input}",

  // ── Smalltalk ─────────────────────────────────────────────────────────────
  smalltalk_es:
    "Respondé de forma breve, cálida y natural a un mensaje social (saludo, agradecimiento, cortesía). " +
    "Ofrecé seguir ayudando sin sonar robótico.\n\n" +
    "Mensaje: {query}",
  smalltalk_en:
    "Reply briefly, warmly and naturally to a social message (greeting, thanks, courtesy). " +
    "Offer to keep helping without sounding robotic.\n\n" +
    "Message: {query}",

  // ── Fallbacks / perfil ────────────────────────────────────────────────────
  factual_no_context_fallback_es:
    "No tengo información específica sobre eso todavía. ¿Querés que derive tu consulta a una persona del equipo?",
  factual_no_context_fallback_en:
    "I don't have specific information about that yet. Would you like me to route your query to a team member?",
  sensitive_message:
    "Lamento que estés pasando por esto. No estás solo/a. Si sentís que estás en peligro, buscá ayuda de una persona de confianza o de un profesional lo antes posible.",
  org_profile_es: "",
  org_profile_en: "",
};
