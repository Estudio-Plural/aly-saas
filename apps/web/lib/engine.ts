// Cliente del engine (apps/api) — el pipeline conversacional multi-tenant
// real (normalize → triage → intent ∥ librarian → retrieve → agente terminal).
// Solo importar desde código de servidor. La ruta de chat lo intenta primero
// y cae a lib/llm.ts (una sola llamada) si el engine no está disponible.

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8080";
const ENGINE_TIMEOUT_MS = 60_000;

/**
 * El engine exige `X-Engine-Token` (ENGINE_TOKEN, el mismo valor en web y api) en todo
 * lo que no es el webhook de Meta. Sin token el engine responde 401/503 y el chat cae
 * al camino de respaldo (lib/llm.ts).
 */
function engineHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = process.env.ENGINE_TOKEN;
  return token ? { ...extra, "X-Engine-Token": token } : extra;
}

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
  /** Banco de casos difíciles: sin historial, sin persistir, config fresca. */
  ephemeral?: boolean;
}): Promise<EngineResponse | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/rag/doQuestion`, {
      method: "POST",
      headers: engineHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ephemeral: params.ephemeral === true,
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

/**
 * Lo que el engine ve de su propio entorno para el canal WhatsApp (si el token
 * nombrado existe, si hay app secret y verify token). Solo booleanos y el
 * nombre de la variable: nunca secretos. null si el engine no responde.
 */
export async function getEngineWhatsappEstado(workspaceId: string): Promise<{
  tokenEnv: string | null;
  tokenCargado: boolean;
  firmaConfigurada: boolean;
  verifyTokenConfigurado: boolean;
} | null> {
  try {
    const res = await fetch(`${ENGINE_URL}/api/whatsapp/estado/${encodeURIComponent(workspaceId)}`, {
      headers: engineHeaders(),
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
