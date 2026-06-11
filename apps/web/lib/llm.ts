// Cliente LLM vía OpenRouter — solo servidor.
import { sql } from "@/lib/db";
import { getKnowledgeText } from "@/lib/data/documents";
import type { Workspace } from "@/lib/workspaces";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * System prompt del asistente: identidad del workspace + override de config
 * + knowledge base en texto plano (hasta tener RAG con pgvector).
 */
export async function buildSystemPrompt(workspace: Workspace): Promise<string> {
  const configRows = await sql<{ prompts: Record<string, string> }[]>`
    SELECT prompts FROM workspace_configs WHERE workspace_id = ${workspace.id}
  `;
  const customSystem = configRows[0]?.prompts?.system;

  const knowledge = await getKnowledgeText(workspace.id);

  const parts = [
    customSystem ??
      `Sos ${workspace.assistant_name}, el asistente virtual de "${workspace.name}". ` +
        `Respondés en español rioplatense, con mensajes breves y cálidos, como en un chat de WhatsApp. ` +
        `Tu objetivo es ayudar a los usuarios con sus consultas sobre el negocio.`,
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

export async function chatCompletion(
  messages: LlmMessage[],
  model: string
): Promise<string> {
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
      "X-Title": "Aly SaaS (local)",
    },
    body: JSON.stringify({ model, messages, max_tokens: 600 }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter devolvió una respuesta vacía");
  }
  return content.trim();
}
