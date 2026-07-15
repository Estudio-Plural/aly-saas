// Parámetros compartidos del pipeline (temperaturas, budgets, headers, labels).
// Portados de LangchainConstants.ts (Aly-legacy). Los MODELOS por agente NO
// viven acá: se resuelven por-workspace en resolveBotConfig (config.models).

export const PARAMS = {
  normalize: { temperature: 0.1, maxTokens: 200 },
  triage: { temperature: 0.0, maxTokens: 16 },
  intent: { temperature: 0.1, maxTokens: 150 },
  librarian: { temperature: 0.1, maxTokens: 80 },
  keyword: { temperature: 0.1, maxTokens: 200 },
  factual: { temperature: 0.3, maxTokens: 800 },
  plan: { temperature: 0.5, maxTokens: 500 },
  ideate: { temperature: 0.8, maxTokens: 500 },
  sensitive: { temperature: 0.3, maxTokens: 600 },
  smalltalk: { temperature: 0.6, maxTokens: 200 },
} as const;

export const HISTORY_LIMIT = 4;
export const HISTORY_MESSAGE_TRUNCATE = 4000;

export const GREETING_INSTRUCTION =
  "\n\n## First Interaction\nThis is the user's first message. Start with a brief, warm greeting before answering.";

export const HISTORY_HEADER = `\n\n## Conversation History (REFERENCE ONLY)
Use this history ONLY to understand what the new question refers to. Do NOT imitate, repeat or extend previous answers. Answer ONLY the new question, following the instructions and the context provided below.\n`;

export const AUTO_DETECT_LANGUAGE_POSTFIX = `

IMPORTANT LANGUAGE INSTRUCTION: Detect the language of the user's question and respond ENTIRELY in that same language. If the question is in English, respond in English. If in Spanish, respond in Spanish. If in Portuguese, respond in Portuguese. This overrides any other language instruction above.`;

export const INTENTS = {
  FACTUAL: "FACTUAL",
  PLAN: "PLAN",
  IDEATE: "IDEATE",
  SENSITIVE: "SENSITIVE",
  SMALLTALK: "SMALLTALK",
  IDENTITY: "IDENTITY",
} as const;

export type IntentType = (typeof INTENTS)[keyof typeof INTENTS];

export const TRIAGE_LABELS = {
  SENSITIVE: "SENSITIVE",
  NOT_SENSITIVE: "NOT_SENSITIVE",
} as const;

export function applyLanguagePostfix(prompt: string, language: string): string {
  return language === "auto" ? prompt + AUTO_DETECT_LANGUAGE_POSTFIX : prompt;
}
