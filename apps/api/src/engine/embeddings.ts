// Embedding de la query del usuario para la búsqueda vectorial (pgvector).
// Mismo modelo que usa apps/web/lib/embeddings.ts al indexar documentos —
// si difieren, la similitud coseno no significa nada.
// Devuelve null si no hay API key o si OpenRouter falla: el retrieval decide
// su failsafe (caer al puente de texto plano).

const EMBEDDING_MODEL =
  process.env.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-large";
const EMBEDDING_DIMS = 3072;

export async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !text.trim()) return null;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`❌ embedQuery: OpenRouter ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      data?: { embedding: number[] }[];
    };
    const embedding = data.data?.[0]?.embedding;
    if (!embedding || embedding.length !== EMBEDDING_DIMS) {
      console.error(`❌ embedQuery: embedding inválido (${embedding?.length ?? 0} dims)`);
      return null;
    }
    return embedding;
  } catch (error) {
    console.error("❌ embedQuery falló:", error);
    return null;
  }
}
