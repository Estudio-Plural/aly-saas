// Enriquecimiento automático con LLM — solo servidor.
// El usuario no-code nunca completa metadatos a mano: los documentos se
// enriquecen al subirlos y las conversaciones se analizan al cerrarse,
// contra las flag_rules que el dueño del workspace definió en su UI.
import { chatCompletion, getChatModel, isLlmConfigured } from "@/lib/llm";
import type { ChatMessage, FlagRule } from "@/lib/workspaces";

export type DocumentMetadata = {
  summary: string | null;
  keywords: string[];
  theme: string | null;
  /** Cuándo debe consultarse el documento (señal de ruteo para el engine) */
  routing: string | null;
};

export type ConversationAnalysis = {
  summary: string | null;
  keywords: string[];
  /** Formato del schema: "HIGH-detalle, MEDIUM-detalle" */
  flags: string | null;
  flagSeverity: "HIGH" | "MEDIUM" | "LOW" | null;
};

function parseJsonObject(reply: string): Record<string, unknown> | null {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(reply.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function asString(value: unknown, maxChars: number): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxChars)
    : null;
}

function asKeywords(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, max);
}

/** Summary + keywords + tema de un documento recién subido. Null si no hay LLM o falla. */
export async function enrichDocument(
  workspaceId: string,
  documentName: string,
  text: string
): Promise<DocumentMetadata | null> {
  if (!isLlmConfigured() || !text.trim()) return null;

  const prompt = `Analizá este documento de la base de conocimiento de un negocio y devolvé SOLO un JSON válido con esta forma exacta:
{"summary": "resumen de 1 o 2 frases en español", "keywords": ["entre 3 y 6 palabras clave en minúsculas"], "theme": "categoría corta de 1 a 3 palabras (ej: precios, productos, políticas, horarios)", "routing": "una frase que empiece con 'Consultar cuando' describiendo qué tipo de preguntas se responden con este documento (ej: 'Consultar cuando pregunten por precios, promociones o formas de pago')"}

Documento "${documentName}":
${text.slice(0, 8000)}`;

  try {
    const model = await getChatModel(workspaceId);
    const parsed = parseJsonObject(
      await chatCompletion([{ role: "user", content: prompt }], model)
    );
    if (!parsed) return null;
    return {
      summary: asString(parsed.summary, 500),
      keywords: asKeywords(parsed.keywords),
      theme: asString(parsed.theme, 60)?.toLowerCase() ?? null,
      routing: asString(parsed.routing, 300),
    };
  } catch (error) {
    console.error(`[enrichment] Falló el enriquecimiento de "${documentName}":`, error);
    return null;
  }
}

/**
 * Analiza una conversación cerrada contra las reglas de alerta del workspace.
 * La severidad de cada flag sale de la regla configurada (no del LLM).
 */
export async function analyzeConversation(
  workspaceId: string,
  messages: ChatMessage[],
  rules: FlagRule[]
): Promise<ConversationAnalysis | null> {
  if (!isLlmConfigured() || messages.length === 0) return null;

  const transcript = messages
    .map((msg) => `${msg.sender === "user" ? "Usuario" : "Asistente"}: ${msg.text}`)
    .join("\n")
    .slice(0, 8000);

  const rulesText = rules.length
    ? rules.map((rule) => `- [${rule.id}] ${rule.description}`).join("\n")
    : "(no hay reglas definidas: el array de flags debe quedar vacío)";

  const prompt = `Sos el analista de conversaciones de un asistente de WhatsApp. Analizá esta conversación y devolvé SOLO un JSON válido con esta forma exacta:
{"summary": "resumen de 1 o 2 frases en español de qué pasó y cómo terminó", "keywords": ["entre 2 y 5 palabras clave en minúsculas"], "flags": [{"rule_id": "id de la regla que se cumple", "detail": "qué pasó, en una frase corta"}]}

Reglas de alerta definidas por el dueño del negocio (solo marcá una si la conversación realmente la cumple; si ninguna aplica, devolvé "flags": []):
${rulesText}

Conversación:
${transcript}`;

  try {
    const model = await getChatModel(workspaceId);
    const parsed = parseJsonObject(
      await chatCompletion([{ role: "user", content: prompt }], model)
    );
    if (!parsed) return null;

    const rawFlags = Array.isArray(parsed.flags) ? parsed.flags : [];
    const matched: { severity: "HIGH" | "MEDIUM" | "LOW"; detail: string }[] = [];
    for (const flag of rawFlags) {
      if (typeof flag !== "object" || flag === null) continue;
      const ruleId = asString((flag as Record<string, unknown>).rule_id, 50);
      const rule = rules.find((r) => r.id === ruleId);
      if (!rule) continue; // el LLM inventó una regla: se ignora
      const detail =
        asString((flag as Record<string, unknown>).detail, 200) ?? rule.description;
      matched.push({
        severity: rule.severity.toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
        detail,
      });
    }

    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    matched.sort((a, b) => order[a.severity] - order[b.severity]);

    return {
      summary: asString(parsed.summary, 500),
      keywords: asKeywords(parsed.keywords, 5),
      flags: matched.length
        ? matched.map((f) => `${f.severity}-${f.detail}`).join(", ")
        : null,
      flagSeverity: matched.length ? matched[0].severity : null,
    };
  } catch (error) {
    console.error("[enrichment] Falló el análisis de la conversación:", error);
    return null;
  }
}
