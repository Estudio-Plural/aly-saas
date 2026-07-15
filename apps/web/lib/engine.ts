// Cliente del engine (apps/api) — el pipeline conversacional multi-tenant
// real (normalize → triage → intent ∥ librarian → retrieve → agente terminal).
// Solo importar desde código de servidor. La ruta de chat lo intenta primero
// y cae a lib/llm.ts (una sola llamada) si el engine no está disponible.

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8080";
const ENGINE_TIMEOUT_MS = 60_000;

export interface EngineResponse {
  answer: string;
  intent: string;
  confidence: number;
  chunks: { documentName: string; text: string }[];
}

/**
 * Pregunta al pipeline real. El engine persiste el par user+assistant en
 * `users_interactions` por su cuenta (la ruta NO debe volver a guardarlos).
 * Devuelve null ante cualquier falla para que la ruta haga fallback.
 */
export async function askEngine(params: {
  workspaceId: string;
  conversationId: string;
  userNumber: string;
  question: string;
  language?: string;
}): Promise<EngineResponse | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/rag/doQuestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userQuestion: params.question,
        userNumber: params.userNumber,
        conversationId: params.conversationId,
        workspaceId: params.workspaceId,
        language: params.language ?? "es",
      }),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[engine] doQuestion respondió ${res.status}`);
      return null;
    }
    const data = (await res.json()) as EngineResponse;
    if (!data?.answer?.trim()) {
      console.error("[engine] doQuestion devolvió una respuesta vacía");
      return null;
    }
    return data;
  } catch (error) {
    console.error("[engine] no disponible, fallback a lib/llm:", error);
    return null;
  }
}
