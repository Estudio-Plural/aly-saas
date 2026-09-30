// Verificación determinista de lo que propone el LLM. El modelo sugiere; esto
// decide. Reglas:
// - Un flag solo sobrevive si su regla existe y tiene al menos UNA evidencia
//   cuyo fragmento aparece textual en el mensaje citado (normalizando espacios
//   y mayúsculas, nada más). Si no, se descarta y se cuenta.
// - La severidad sale SIEMPRE de la regla configurada, nunca del LLM.
// - "Cumplió el criterio de éxito" sin índices de mensaje válidos → false.
// - Un momento del storyboard fuera del enum → null.

import type { StoryboardMomentKey } from "../config/identity";
import type {
  FlagEvidence,
  FlagRule,
  Severity,
  SupervisedAnalysis,
  SupervisorMessage,
  VerifiedFlag,
} from "./types";

const MOMENTS: StoryboardMomentKey[] = ["opening", "development", "next_steps", "closing"];
const SEVERITY_ORDER: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Fragmentos más cortos que esto no prueban nada ("sí", "ok"). */
export const MIN_FRAGMENT_CHARS = 3;
const MAX_FRAGMENT_CHARS = 300;

export function parseJsonObject(reply: string): Record<string, unknown> | null {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(reply.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function asString(value: unknown, maxChars: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxChars) : null;
}

function asKeywords(value: unknown, max = 5): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, max);
}

function asIndex(value: unknown, messages: SupervisorMessage[]): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n < messages.length
    ? n
    : null;
}

/** Normalización mínima para comparar: NFC, espacios colapsados, minúsculas. */
function normalizeText(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
}

/** ¿El fragmento aparece textual en el mensaje? */
export function fragmentInMessage(fragment: string, message: string): boolean {
  const needle = normalizeText(fragment);
  if (needle.replace(/\s/g, "").length < MIN_FRAGMENT_CHARS) return false;
  return normalizeText(message).includes(needle);
}

export function ruleSeverity(rule: FlagRule): Severity {
  const upper = String(rule.severity).toUpperCase();
  return upper === "HIGH" || upper === "MEDIUM" || upper === "LOW" ? upper : "MEDIUM";
}

function verifyEvidence(raw: unknown, messages: SupervisorMessage[]): FlagEvidence[] {
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const verified: FlagEvidence[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const index = asIndex(obj.mensaje ?? obj.message_index ?? obj.index, messages);
    const fragment = typeof obj.fragmento === "string" ? obj.fragmento : obj.fragment;
    if (index === null || typeof fragment !== "string") continue;
    const message = messages[index]!;
    if (!fragmentInMessage(fragment, message.text)) continue;
    if (verified.some((e) => e.messageIndex === index && e.fragment === fragment.trim())) continue;
    verified.push({
      messageIndex: index,
      messageId: message.id,
      fragment: fragment.trim().slice(0, MAX_FRAGMENT_CHARS),
    });
  }
  return verified;
}

/**
 * Convierte la respuesta cruda del LLM en un análisis verificado.
 * Null solo si la respuesta no es un JSON utilizable.
 */
export function verifyAnalysis(
  reply: string,
  messages: SupervisorMessage[],
  rules: FlagRule[],
  model: string,
): SupervisedAnalysis | null {
  const parsed = parseJsonObject(reply);
  if (!parsed) return null;

  // Flags: regla existente + evidencia textual, o afuera
  const rawFlags = Array.isArray(parsed.flags) ? parsed.flags : [];
  const byRule = new Map<string, VerifiedFlag>();
  let discarded = 0;
  for (const raw of rawFlags) {
    if (typeof raw !== "object" || raw === null) {
      discarded++;
      continue;
    }
    const obj = raw as Record<string, unknown>;
    const ruleId = asString(obj.rule_id, 50);
    const rule = rules.find((r) => r.id === ruleId);
    const evidence = rule ? verifyEvidence(obj.evidencia ?? obj.evidence, messages) : [];
    if (!rule || evidence.length === 0) {
      discarded++;
      continue;
    }
    const existing = byRule.get(rule.id);
    if (existing) {
      // El mismo rule_id dos veces: se unen las evidencias
      for (const e of evidence) {
        if (!existing.evidence.some((x) => x.messageIndex === e.messageIndex && x.fragment === e.fragment)) {
          existing.evidence.push(e);
        }
      }
      continue;
    }
    byRule.set(rule.id, {
      ruleId: rule.id,
      ruleDescription: rule.description,
      severity: ruleSeverity(rule),
      detail: asString(obj.detail ?? obj.detalle, 200) ?? rule.description,
      evidence,
    });
  }
  const flags = [...byRule.values()].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  // Criterio de éxito: un "sí" sin mensajes que lo respalden no cuenta
  const rawCriterio = parsed.cumplio_criterio_exito;
  const criterioObj =
    typeof rawCriterio === "object" && rawCriterio !== null
      ? (rawCriterio as Record<string, unknown>)
      : { valor: rawCriterio };
  const criterioIdx = (Array.isArray(criterioObj.evidencia) ? criterioObj.evidencia : [])
    .map((v) => asIndex(v, messages))
    .filter((v): v is number => v !== null);
  const uniqueIdx = [...new Set(criterioIdx)].sort((a, b) => a - b);
  const claimed = criterioObj.valor === true || criterioObj.value === true;
  const criterioValue = claimed && uniqueIdx.length > 0;

  const momento = parsed.momento_alcanzado;
  return {
    version: 1,
    summary: asString(parsed.summary ?? parsed.resumen, 500),
    keywords: asKeywords(parsed.keywords),
    momentoAlcanzado: MOMENTS.includes(momento as StoryboardMomentKey)
      ? (momento as StoryboardMomentKey)
      : null,
    cumplioCriterioExito: {
      value: criterioValue,
      evidence: criterioValue
        ? uniqueIdx.map((i) => ({ messageIndex: i, messageId: messages[i]!.id }))
        : [],
    },
    flags,
    discardedFlags: discarded,
    model,
  };
}

/** CSV legacy de conversations_data.flags ("HIGH-detalle, MEDIUM-detalle"). */
export function flagsToText(flags: VerifiedFlag[]): string | null {
  return flags.length ? flags.map((f) => `${f.severity}-${f.detail}`).join(", ") : null;
}

export function maxSeverity(flags: VerifiedFlag[]): Severity | null {
  return flags[0]?.severity ?? null; // ya vienen ordenados por severidad
}
