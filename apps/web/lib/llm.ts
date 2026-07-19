// Cliente LLM vía OpenRouter — solo servidor.
import { sql } from "@/lib/db";
import { getKnowledgeText } from "@/lib/data/documents";
import { getCorePrompt, getStoryboard } from "@/lib/data/program";
import { compileIdentityBlock, type Workspace } from "@/lib/workspaces";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * System prompt del asistente: identidad compilada (prompt núcleo + storyboard)
 * + knowledge base en texto plano (hasta tener RAG con pgvector).
 */
export async function buildSystemPrompt(workspace: Workspace): Promise<string> {
  const [corePrompt, storyboard, knowledge] = await Promise.all([
    getCorePrompt(workspace.id),
    getStoryboard(workspace.id),
    getKnowledgeText(workspace.id),
  ]);

  const parts = [
    compileIdentityBlock(
      workspace.assistant_name,
      workspace.name,
      corePrompt,
      storyboard
    ),
  ];

  if (knowledge.length) {
    parts.push(
      `Basate en esta base de conocimiento del negocio para responder:\n\n` +
        knowledge.map((doc) => `### ${doc.name}\n${doc.text}`).join("\n\n")
    );
    parts.push(
      `Si la respuesta no está en la base de conocimiento, decilo honestamente y ofrecé derivar la consulta a una persona del equipo.`
    );
  } else {
    parts.push(
      `Todavía no hay documentos en la base de conocimiento. Respondé lo mejor posible y aclará cuando no tengas información específica del negocio.`
    );
  }

  return parts.join("\n\n");
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

/** Tokens de la respuesta a medida que llegan (SSE de OpenRouter). */
export async function* streamChatCompletion(
  messages: LlmMessage[],
  model: string
): AsyncGenerator<string> {
  const res = await openRouterFetch({ model, messages, max_tokens: 600, stream: true });
  if (!res.body) {
    throw new Error("OpenRouter no devolvió stream");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      // OpenRouter intercala comentarios (": OPENROUTER PROCESSING") — ignorarlos
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield delta;
      } catch {
        // línea parcial o keep-alive: se completa con el próximo chunk
      }
    }
  }
}
