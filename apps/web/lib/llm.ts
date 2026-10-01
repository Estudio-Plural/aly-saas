// Cliente LLM vía OpenRouter — solo servidor. Lo usan las tareas de fondo del panel
// (enrichment, extracción). El chat NO: lo responde siempre el engine (lib/engine.ts).
import { sql } from "@/lib/db";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function getChatModel(workspaceId: string): Promise<string> {
  const rows = await sql<{ model_preferences: Record<string, string> }[]>`
    SELECT model_preferences FROM workspace_configs WHERE workspace_id = ${workspaceId}
  `;
  return rows[0]?.model_preferences?.chat ?? DEFAULT_MODEL;
}

async function openRouterFetch(body: Record<string, unknown>): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY no configurada");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Plural Conversational System (local)",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

export async function chatCompletion(
  messages: LlmMessage[],
  model: string
): Promise<string> {
  const res = await openRouterFetch({ model, messages, max_tokens: 600 });
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter devolvió una respuesta vacía");
  }
  return content.trim();
}
