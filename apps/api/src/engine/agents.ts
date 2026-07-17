// Agentes del pipeline — portados 1:1 del Aly-legacy (LangchainRAGService).
// Cada agente arma su prompt (placeholders + historia + contexto + query),
// aplica el postfix de idioma y hace UNA llamada al LLM. Todos con failsafe.
//
// Diferencia con el legacy: el modelo y los prompts salen de `config`
// (resolveBotConfig por-workspace), no de constantes hardcodeadas por bot.

import type { BotConfig } from "../config";
import { callAgent } from "./openrouter";
import { INTENTS, PARAMS, TRIAGE_LABELS, applyLanguagePostfix, type IntentType } from "./params";

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
}

// ── Normalize ────────────────────────────────────────────────────────────
export async function normalize(
  question: string,
  historyString: string,
  config: BotConfig,
): Promise<string> {
  try {
    const prompt = config.prompts.normalizeQuestion
      .replace("{history}", historyString)
      .replace("{class_context}", "") // slot-filling llega en un paso posterior
      .replace("{user_input}", question);

    const rewritten = await callAgent({
      model: config.models.normalize,
      prompt,
      temperature: PARAMS.normalize.temperature,
      maxTokens: PARAMS.normalize.maxTokens,
    });

    if (!rewritten) return question;
    console.log(`🔁 Normalized: ${rewritten}`);
    return rewritten;
  } catch (error) {
    console.error("❌ Normalize failed, using original:", error);
    return question;
  }
}

// ── Triage (pre-filtro SENSITIVE — lee la pregunta ORIGINAL) ──────────────
export async function triage(question: string, config: BotConfig): Promise<boolean> {
  try {
    const prompt = config.prompts.triage.replace("{user_input}", question);
    const raw = (
      await callAgent({
        model: config.models.triage,
        prompt,
        temperature: PARAMS.triage.temperature,
        maxTokens: PARAMS.triage.maxTokens,
      })
    ).toUpperCase();
    console.log(`🧭 Triage: ${raw}`);
    return (
      raw.includes(TRIAGE_LABELS.SENSITIVE) && !raw.includes(TRIAGE_LABELS.NOT_SENSITIVE)
    );
  } catch (error) {
    console.error("❌ Triage failed, continuing normal flow:", error);
    return false;
  }
}

// ── Intent ────────────────────────────────────────────────────────────────
export async function classifyIntent(
  question: string,
  config: BotConfig,
): Promise<IntentClassification> {
  try {
    const prompt = config.prompts.intent.replace("{user_input}", question);
    const text = await callAgent({
      model: config.models.intent,
      prompt,
      temperature: PARAMS.intent.temperature,
      maxTokens: PARAMS.intent.maxTokens,
    });

    const parsed = JSON.parse(stripCodeFence(text));
    const intent = parsed.intent as IntentType;
    if (!Object.values(INTENTS).includes(intent)) {
      console.warn(`⚠️ Unknown intent "${intent}" → FACTUAL`);
      return { intent: INTENTS.FACTUAL, confidence: 0.5 };
    }
    return { intent, confidence: Number(parsed.confidence) || 0.5 };
  } catch (error) {
    console.error("❌ Intent failed → FACTUAL:", error);
    return { intent: INTENTS.FACTUAL, confidence: 0.0 };
  }
}

// ── Librarian (theme filters) ─────────────────────────────────────────────
export async function runLibrarian(
  question: string,
  config: BotConfig,
): Promise<string[]> {
  try {
    const prompt = config.prompts.librarian.replace("{query}", question);
    const text = await callAgent({
      model: config.models.librarian,
      prompt,
      temperature: PARAMS.librarian.temperature,
      maxTokens: PARAMS.librarian.maxTokens,
    });
    const parsed = parseLibrarianJson(stripCodeFence(text));
    const valid = new Set(config.themeCategories);
    const themeFilters = (parsed.theme_filters || []).filter((t) => valid.has(t));
    console.log(`📚 Librarian themes: [${themeFilters.join(", ")}]`);
    return themeFilters;
  } catch (error) {
    console.error("❌ Librarian failed → no filters:", error);
    return [];
  }
}

// ── Doc router (ruteo de documentos) ──────────────────────────────────────
// Port del doc-routing del librarian legacy, adaptado al SaaS: en vez de
// categorías temáticas fijas, decide sobre el catálogo VIVO de documentos del
// workspace usando el "cuándo consultarlo" de cada uno (routing_hint editable
// por el usuario, fallback al summary). El prompt se arma en código porque el
// catálogo es dinámico. Devuelve ids de documentos; [] = sin filtro (todos).
export interface DocCatalogItem {
  id: string;
  name: string;
  hint: string;
}

export async function routeDocuments(
  question: string,
  catalog: DocCatalogItem[],
  config: BotConfig,
): Promise<string[]> {
  try {
    const listing = catalog
      .map((d, i) => `${i + 1}. "${d.name}"${d.hint ? ` — ${d.hint}` : ""}`)
      .join("\n");

    const prompt = `Sos el bibliotecario de un asistente conversacional. Tu única tarea es decidir qué documentos de la base de conocimiento hay que consultar para responder la pregunta del usuario.

Documentos disponibles (con la indicación de cuándo consultar cada uno):
${listing}

Reglas:
- Elegí SOLO los documentos claramente relevantes para la pregunta (la lista mínima).
- Si la pregunta es muy amplia, pide un resumen general, o ningún documento aplica claramente, devolvé una lista vacía (se consultarán todos).

Pregunta: "${question}"

Respondé SOLO con JSON válido: {"documents": [numeros de la lista]}`;

    const text = await callAgent({
      model: config.models.librarian,
      prompt,
      temperature: PARAMS.docRouter.temperature,
      maxTokens: PARAMS.docRouter.maxTokens,
    });

    const parsed = JSON.parse(stripCodeFence(text)) as { documents?: unknown };
    const indices = Array.isArray(parsed.documents) ? parsed.documents : [];
    const selected = indices
      .map((n) => catalog[Number(n) - 1])
      .filter((d): d is DocCatalogItem => Boolean(d));

    console.log(
      `📚 Doc router: ${selected.length ? selected.map((d) => `"${d.name}"`).join(", ") : "sin filtro (todos)"}`,
    );
    return selected.map((d) => d.id);
  } catch (error) {
    console.error("❌ Doc router failed → sin filtro (todos):", error);
    return [];
  }
}

// ── FACTUAL ────────────────────────────────────────────────────────────────
export async function factualAgent(
  query: string,
  context: string,
  language: string,
  historyString: string,
  config: BotConfig,
): Promise<string> {
  console.log("📚 FACTUAL agent...");

  // Contexto vacío → no alucinar. Intento la capa de identidad si está activa,
  // si no, el fallback canónico.
  if (context.trim() === "") {
    if (config.capabilities.org_identity && config.prompts.orgProfile) {
      const org = await tryOrgProfile(query, language, config);
      if (org) return org;
    }
    return config.prompts.factualNoContextFallback;
  }

  let prompt = config.prompts.factual.replace("{context}", context).replace("{query}", query);
  prompt = historyString + "\n\n" + prompt;
  prompt = applyLanguagePostfix(prompt, language);

  return callAgent({
    model: config.models.factual,
    prompt,
    temperature: PARAMS.factual.temperature,
    maxTokens: PARAMS.factual.maxTokens,
  });
}

// ── PLAN ─────────────────────────────────────────────────────────────────
export async function planAgent(
  query: string,
  context: string,
  language: string,
  historyString: string,
  config: BotConfig,
): Promise<string> {
  console.log("📋 PLAN agent...");
  let prompt = config.prompts.plan.replace("{context}", context).replace("{query}", query);
  prompt = historyString + "\n\n" + prompt;
  prompt = applyLanguagePostfix(prompt, language);
  return callAgent({
    model: config.models.plan,
    prompt,
    temperature: PARAMS.plan.temperature,
    maxTokens: PARAMS.plan.maxTokens,
  });
}

// ── IDEATE ───────────────────────────────────────────────────────────────
export async function ideateAgent(
  query: string,
  context: string,
  language: string,
  historyString: string,
  config: BotConfig,
): Promise<string> {
  console.log("💡 IDEATE agent...");
  let prompt = config.prompts.ideate.replace("{context}", context).replace("{query}", query);
  prompt = historyString + "\n\n" + prompt;
  prompt = applyLanguagePostfix(prompt, language);
  return callAgent({
    model: config.models.ideate,
    prompt,
    temperature: PARAMS.ideate.temperature,
    maxTokens: PARAMS.ideate.maxTokens,
  });
}

// ── SMALLTALK (sin retrieval, sin {context}) ──────────────────────────────
export async function smalltalkAgent(
  query: string,
  language: string,
  historyString: string,
  config: BotConfig,
): Promise<string> {
  console.log("💬 SMALLTALK agent...");
  let prompt = config.prompts.smalltalk.replace("{query}", query);
  prompt = historyString + "\n\n" + prompt;
  prompt = applyLanguagePostfix(prompt, language);
  return callAgent({
    model: config.models.smalltalk,
    prompt,
    temperature: PARAMS.smalltalk.temperature,
    maxTokens: PARAMS.smalltalk.maxTokens,
  });
}

// ── SENSITIVE (RAG-grounded en legacy; Fase 0: contexto vacío) ────────────
export async function sensitiveAgent(
  query: string,
  context: string,
  language: string,
  config: BotConfig,
): Promise<string> {
  console.log("🛡️ SENSITIVE agent...");
  try {
    let prompt = config.prompts.sensitive
      .replace("{user_input}", query)
      .replace("{context}", context);
    prompt = applyLanguagePostfix(prompt, language);
    const answer = await callAgent({
      model: config.models.sensitive,
      prompt,
      temperature: PARAMS.sensitive.temperature,
      maxTokens: PARAMS.sensitive.maxTokens,
    });
    if (!answer) return config.prompts.sensitiveFallback;
    return stripSeverityLabel(answer);
  } catch (error) {
    console.error("❌ SENSITIVE failed, using fallback:", error);
    return config.prompts.sensitiveFallback;
  }
}

// ── IDENTITY (perfil estático de la organización) ─────────────────────────
export async function identityAgent(
  query: string,
  language: string,
  config: BotConfig,
): Promise<string> {
  console.log("🪪 IDENTITY agent...");
  if (!config.prompts.orgProfile) return config.prompts.factualNoContextFallback;
  const answer = await tryOrgProfile(query, language, config);
  return answer ?? config.prompts.factualNoContextFallback;
}

// ── helpers ───────────────────────────────────────────────────────────────

/** Llama al perfil de organización; null si no aplica (sentinela NO_ORG) o vacío. */
async function tryOrgProfile(
  query: string,
  language: string,
  config: BotConfig,
): Promise<string | null> {
  let prompt = config.prompts.orgProfile.replace("{query}", query);
  prompt = applyLanguagePostfix(prompt, language);
  const answer = (
    await callAgent({
      model: config.models.factual,
      prompt,
      temperature: PARAMS.factual.temperature,
      maxTokens: PARAMS.factual.maxTokens,
    })
  ).trim();
  if (!answer || answer.toUpperCase().includes("NO_ORG")) return null;
  return answer;
}

function stripCodeFence(text: string): string {
  return text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

function parseLibrarianJson(text: string): { theme_filters?: string[] } {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/"theme_filters"\s*:\s*\[([^\]]*)\]/);
    if (m) {
      return { theme_filters: [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) };
    }
    return {};
  }
}

// Quita una primera línea que sea SOLO una etiqueta de severidad que el modelo
// sensible a veces filtra ("🔴 ALTA SEVERIDAD", "Clasificación interna: ...").
function stripSeverityLabel(text: string): string {
  const labelOnly =
    /^\s*(?:clasificaci[oó]n\s+interna\s*:?\s*)?(?:🔴|🟡)?\s*(?:alta\s+severidad|contenci[oó]n|high\s+severity|containment)\s*:?\s*$/i;
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length && labelOnly.test(lines[i])) {
    return lines.slice(i + 1).join("\n").trimStart();
  }
  return text;
}
