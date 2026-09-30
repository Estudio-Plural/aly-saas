// El "agente" supervisor, por conversación. Diseño acotado a propósito:
// las herramientas (leer mensajes, reglas de alerta, criterio de éxito y
// storyboard) son funciones del engine que se ejecutan SIEMPRE y de antemano,
// y el LLM recibe todo junto en UNA llamada con salida JSON. No hay
// tool-calling: la conversación y la config son chicas y fijas, así que un
// loop de herramientas solo sumaría latencia, costo y no-determinismo sin
// darle al modelo información que no tenga ya. Lo que el modelo devuelve pasa
// después por la verificación determinista de verify.ts.

import type { StoryboardMomentKey } from "../config/identity";
import { verifyAnalysis } from "./verify";
import type {
  LlmCall,
  SupervisedAnalysis,
  SupervisorMessage,
  WorkspaceContext,
} from "./types";

/** Presupuesto de transcript: los mensajes más recientes que entren. */
const TRANSCRIPT_BUDGET_CHARS = 12000;
const MESSAGE_MAX_CHARS = 1500;

const MOMENT_LABELS: Record<StoryboardMomentKey, string> = {
  opening: "Arranque",
  development: "Desarrollo",
  next_steps: "Lo que debe pasar después",
  closing: "Cierre",
};

/**
 * Transcript con índice por mensaje ([0], [1]…) — el LLM cita esos índices
 * como evidencia. Si no entra todo, se omiten los más viejos (los índices
 * siguen siendo los reales).
 */
export function formatTranscript(messages: SupervisorMessage[]): string {
  const lines: string[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    const who = msg.role === "user" ? "Usuario" : "Asistente";
    const text = msg.text.length > MESSAGE_MAX_CHARS ? `${msg.text.slice(0, MESSAGE_MAX_CHARS)}…` : msg.text;
    const line = `[${i}] ${who}: ${text}`;
    if (used + line.length > TRANSCRIPT_BUDGET_CHARS && lines.length > 0) {
      lines.unshift(`(se omitieron los mensajes 0 a ${i})`);
      break;
    }
    lines.unshift(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

export function buildSupervisorPrompt(
  ctx: WorkspaceContext,
  messages: SupervisorMessage[],
): string {
  const rulesText = ctx.rules.length
    ? ctx.rules.map((r) => `- [${r.id}] ${r.description}`).join("\n")
    : '(no hay reglas definidas: "flags" debe quedar vacío)';
  const moments = (Object.keys(MOMENT_LABELS) as StoryboardMomentKey[])
    .map((key) => `- ${key} (${MOMENT_LABELS[key]}): ${ctx.storyboard[key]}`)
    .join("\n");

  return `Sos el supervisor de conversaciones de un programa conversacional por WhatsApp ("${ctx.name}"). Leés una conversación ya terminada y devolvés SOLO un JSON válido con esta forma exacta:
{"summary": "1 o 2 frases en español: qué pasó y cómo terminó, sin nombres ni datos personales", "keywords": ["entre 2 y 5 palabras clave en minúsculas"], "momento_alcanzado": "opening | development | next_steps | closing | null", "cumplio_criterio_exito": {"valor": true, "evidencia": [3, 5]}, "flags": [{"rule_id": "id de la regla", "detail": "qué pasó, en una frase corta y sin datos personales", "evidencia": [{"mensaje": 4, "fragmento": "copia textual exacta de una parte de ese mensaje"}]}]}

Instrucciones:
- "momento_alcanzado": el momento MÁS AVANZADO del arco al que llegó la conversación (null si ni siquiera arrancó).
- "cumplio_criterio_exito": true solo si la conversación cumple el criterio de éxito; "evidencia" son los números [n] de los mensajes que lo muestran.
- "flags": marcá una regla solo si la conversación realmente la cumple. Cada flag DEBE citar evidencia: el número [n] del mensaje y un fragmento copiado TEXTUAL de ese mensaje (sin parafrasear ni corregir). Un flag sin evidencia textual se descarta. No inventes reglas: usá solo los ids de la lista. Si ninguna aplica, "flags": [].
- La severidad la define cada regla; no la incluyas.

Criterio de éxito del programa: ${ctx.core.success_criteria}

Momentos del arco (storyboard):
${moments}

Reglas de alerta del equipo:
${rulesText}

Conversación (cada mensaje con su número):
${formatTranscript(messages)}`;
}

/**
 * Analiza una conversación. Null si el LLM falla o devuelve algo no parseable
 * (el job lo cuenta como fallido y la reintenta en la próxima corrida).
 */
export async function superviseConversation(
  ctx: WorkspaceContext,
  messages: SupervisorMessage[],
  llm: LlmCall,
): Promise<SupervisedAnalysis | null> {
  if (messages.length === 0) return null;
  const reply = await llm({ model: ctx.model, prompt: buildSupervisorPrompt(ctx, messages) });
  return verifyAnalysis(reply, messages, ctx.rules, ctx.model);
}
