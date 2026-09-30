// Job del supervisor: busca conversaciones inactivas sin análisis al día, las
// analiza con el agente, guarda y avisa alertas HIGH nuevas. Idempotente:
// una conversación ya analizada hasta su último mensaje no se vuelve a
// seleccionar, y el upsert no pisa análisis más nuevos.
//
// Disparo: POST /internal/supervise (token) o, opcionalmente, un intervalo
// dentro del proceso del engine (SUPERVISOR_INTERVAL_MINUTES, off por defecto).
// Solo lee, analiza, guarda y avisa al equipo: nunca contacta al usuario ni
// cierra casos.

import { callAgent, isLlmConfigured } from "../engine/openrouter";
import { superviseConversation } from "./agent";
import { notifierFromEnv } from "./notify";
import { sqlSupervisorStore } from "./store";
import { flagsToText, maxSeverity } from "./verify";
import type {
  AlertNotifier,
  IdleConversation,
  LlmCall,
  SupervisedAnalysis,
  SupervisorMessage,
  SupervisorStore,
} from "./types";

export interface SupervisorSettings {
  /** Minutos sin mensajes para considerar la conversación terminada. */
  idleMinutes: number;
  /** Máximo de conversaciones por corrida (acota el costo de LLM). */
  batchLimit: number;
}

function intEnv(value: string | undefined, fallback: number, min: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}

export function settingsFromEnv(env: Record<string, string | undefined> = process.env): SupervisorSettings {
  return {
    idleMinutes: intEnv(env.SUPERVISOR_IDLE_MINUTES, 30, 1),
    batchLimit: intEnv(env.SUPERVISOR_BATCH_LIMIT, 20, 1),
  };
}

/**
 * Criterio de selección en TS (el SQL de store.ts lo implementa igual):
 * ≥ 2 mensajes, inactiva hace ≥ idleMinutes y análisis ausente o viejo.
 */
export function needsSupervision(
  conv: IdleConversation,
  now: Date,
  idleMinutes: number,
): boolean {
  if (conv.messagesCount < 2) return false;
  if (now.getTime() - conv.lastMessageAt.getTime() < idleMinutes * 60_000) return false;
  return !conv.analyzedThrough || conv.analyzedThrough < conv.lastMessageAt;
}

export interface SupervisorDeps {
  store: SupervisorStore;
  llm: LlmCall;
  notifier: AlertNotifier;
  isLlmConfigured: () => boolean;
}

export type ConversationOutcome =
  | "analyzed"
  | "stale" // otro análisis igual o más nuevo ya estaba guardado
  | "skipped" // workspace inexistente o sin mensajes suficientes
  | "failed"; // LLM caído / respuesta inválida: se reintenta en la próxima corrida

/** Resultado por conversación: ids y conteos, nunca texto. */
export interface ConversationResult {
  workspaceId: string;
  conversationId: string;
  outcome: ConversationOutcome;
  flags: number;
  discardedFlags: number;
  notified: number;
}

export interface SupervisorReport {
  ran: boolean;
  reason?: "already_running" | "llm_not_configured";
  selected: number;
  analyzed: number;
  failed: number;
  discardedFlags: number;
  notified: number;
  results: ConversationResult[];
}

function defaultDeps(): SupervisorDeps {
  return {
    store: sqlSupervisorStore,
    llm: ({ model, prompt }) => callAgent({ model, prompt, temperature: 0, maxTokens: 1200 }),
    notifier: notifierFromEnv(),
    isLlmConfigured,
  };
}

/** Flags con evidencia en mensajes posteriores al análisis anterior. */
function newFlags(
  analysis: SupervisedAnalysis,
  messages: SupervisorMessage[],
  previous: Date | null,
) {
  if (!previous) return analysis.flags;
  return analysis.flags.filter((flag) =>
    flag.evidence.some((e) => messages[e.messageIndex]!.timestamp > previous),
  );
}

async function superviseOne(
  conv: IdleConversation,
  deps: SupervisorDeps,
): Promise<ConversationResult> {
  const result: ConversationResult = {
    workspaceId: conv.workspaceId,
    conversationId: conv.conversationId,
    outcome: "skipped",
    flags: 0,
    discardedFlags: 0,
    notified: 0,
  };

  // "Herramientas" del agente: mensajes + reglas + criterio/storyboard
  const [ctx, messages] = await Promise.all([
    deps.store.getWorkspaceContext(conv.workspaceId),
    deps.store.getMessages(conv.workspaceId, conv.conversationId),
  ]);
  if (!ctx || messages.length < 2) return result;

  const analysis = await superviseConversation(ctx, messages, deps.llm);
  if (!analysis) {
    result.outcome = "failed";
    return result;
  }
  result.flags = analysis.flags.length;
  result.discardedFlags = analysis.discardedFlags;

  const fresh = newFlags(analysis, messages, conv.analyzedThrough);
  const saved = await deps.store.saveAnalysis({
    conversation: { ...conv, messagesCount: messages.length },
    analysis,
    flagsText: flagsToText(analysis.flags),
    flagSeverity: maxSeverity(analysis.flags),
    analyzedThrough: messages[messages.length - 1]!.timestamp,
    resetReview: fresh.length > 0,
  });
  if (!saved) {
    result.outcome = "stale";
    return result;
  }
  result.outcome = "analyzed";

  // Solo después de persistir, y solo alertas HIGH nuevas (sin texto)
  for (const flag of fresh) {
    if (flag.severity !== "HIGH") continue;
    await deps.notifier.notify({
      workspaceSlug: ctx.slug,
      conversationId: conv.conversationId,
      ruleId: flag.ruleId,
      ruleDescription: flag.ruleDescription,
      severity: "HIGH",
    });
    result.notified++;
  }
  return result;
}

let running = false;

/**
 * Una corrida del supervisor. Nunca lanza por una conversación puntual: la
 * cuenta como fallida y sigue. Dos corridas en el mismo proceso no se pisan.
 */
export async function runSupervisor(
  settings: SupervisorSettings = settingsFromEnv(),
  deps: SupervisorDeps = defaultDeps(),
): Promise<SupervisorReport> {
  const report: SupervisorReport = {
    ran: false,
    selected: 0,
    analyzed: 0,
    failed: 0,
    discardedFlags: 0,
    notified: 0,
    results: [],
  };
  if (running) return { ...report, reason: "already_running" };
  if (!deps.isLlmConfigured()) return { ...report, reason: "llm_not_configured" };

  running = true;
  try {
    report.ran = true;
    const candidates = await deps.store.listIdleConversations(
      settings.idleMinutes,
      settings.batchLimit,
    );
    report.selected = candidates.length;

    for (const conv of candidates) {
      let result: ConversationResult;
      try {
        result = await superviseOne(conv, deps);
      } catch (error) {
        console.error(
          `[supervisor] Falló el análisis de ${conv.workspaceId}/${conv.conversationId}:`,
          error instanceof Error ? error.message : error,
        );
        result = {
          workspaceId: conv.workspaceId,
          conversationId: conv.conversationId,
          outcome: "failed",
          flags: 0,
          discardedFlags: 0,
          notified: 0,
        };
      }
      report.results.push(result);
      if (result.outcome === "analyzed") report.analyzed++;
      if (result.outcome === "failed") report.failed++;
      report.discardedFlags += result.discardedFlags;
      report.notified += result.notified;
    }

    if (report.selected) {
      console.log(
        `[supervisor] ${report.analyzed}/${report.selected} analizadas, ${report.failed} fallidas, ` +
          `${report.discardedFlags} flags descartados por evidencia, ${report.notified} alertas HIGH`,
      );
    }
    return report;
  } finally {
    running = false;
  }
}

/**
 * Intervalo opcional dentro del proceso (SUPERVISOR_INTERVAL_MINUTES > 0).
 * Devuelve el timer (o null si está desactivado) para poder frenarlo.
 */
export function startSupervisorInterval(
  env: Record<string, string | undefined> = process.env,
): ReturnType<typeof setInterval> | null {
  const minutes = Number(env.SUPERVISOR_INTERVAL_MINUTES ?? 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const timer = setInterval(() => {
    runSupervisor().catch((error) => console.error("[supervisor] Corrida fallida:", error));
  }, minutes * 60_000);
  timer.unref?.();
  console.log(`[supervisor] intervalo activo cada ${minutes} min`);
  return timer;
}
