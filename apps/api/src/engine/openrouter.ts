// Cliente OpenRouter del engine — vía fetch (sin SDK). Todos los agentes hacen
// una llamada chat.completions con un ÚNICO mensaje `user` (mismo shape que el
// Aly-legacy: el prompt ya trae system + historia + contexto + query juntos).

interface CallOptions {
  model: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Una llamada al LLM. Devuelve el texto (trim). Lanza si OpenRouter falla o
 * devuelve vacío — cada agente decide su propio failsafe.
 */
export async function callAgent({
  model,
  prompt,
  temperature,
  maxTokens,
}: CallOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY no configurada");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:8080",
      "X-Title": "Plural Conversational System (engine)",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}
