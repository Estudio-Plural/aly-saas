// resolveBotConfig — resuelve la config de un workspace para un idioma, con
// cache in-memory (TTL 5min) y fallback campo-a-campo al template default.
//
// Reemplaza a getAgentPrompts + BOT_ID_PROGRAMS del Aly-legacy: el pipeline
// llama a esto en vez de leer clases hardcodeadas.

import { sql } from "../db";
import type { AgentPrompts, BotConfig, Capabilities, RawPromptStore } from "./types";
import {
  DEFAULT_CAPABILITIES,
  DEFAULT_MODELS,
  DEFAULT_RAW_PROMPTS,
  DEFAULT_THEME_CATEGORIES,
} from "./defaults";
import {
  DEFAULT_CORE_PROMPT,
  DEFAULT_STORYBOARD,
  compileIdentity,
  type CorePrompt,
  type Storyboard,
} from "./identity";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  config: BotConfig;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

interface ConfigRow {
  prompts: RawPromptStore | null;
  model_preferences: Record<string, string> | null;
  capabilities: Partial<Capabilities> | null;
  programs: string[] | null;
  theme_categories: string[] | null;
  core_prompt: CorePrompt | null;
  storyboard: Storyboard | null;
  assistant_name: string;
  workspace_name: string;
}

type LangKey = "es" | "en";

function langKey(language: string): LangKey {
  return language === "en" ? "en" : "es";
}

/** Un campo bilingüe: valor del workspace → default, según idioma. */
function bilingual(
  raw: RawPromptStore,
  esKey: keyof RawPromptStore,
  enKey: keyof RawPromptStore,
  lang: LangKey,
): string {
  const key = lang === "en" ? enKey : esKey;
  return raw[key] ?? DEFAULT_RAW_PROMPTS[key as keyof typeof DEFAULT_RAW_PROMPTS] ?? "";
}

/** Un campo compartido (sin variante de idioma). */
function shared(raw: RawPromptStore, key: keyof RawPromptStore): string {
  return raw[key] ?? DEFAULT_RAW_PROMPTS[key as keyof typeof DEFAULT_RAW_PROMPTS] ?? "";
}

function resolvePrompts(raw: RawPromptStore, lang: LangKey): AgentPrompts {
  return {
    normalizeQuestion: bilingual(raw, "normalize_es", "normalize_en", lang),
    triage: bilingual(raw, "triage_es", "triage_en", lang),
    intent: shared(raw, "intent"),
    librarian: bilingual(raw, "librarian_es", "librarian_en", lang),
    keywordExtraction: shared(raw, "keyword_extraction"),
    factual: bilingual(raw, "factual_es", "factual_en", lang),
    plan: bilingual(raw, "plan_es", "plan_en", lang),
    ideate: bilingual(raw, "ideate_es", "ideate_en", lang),
    sensitive: bilingual(raw, "sensitive_es", "sensitive_en", lang),
    smalltalk: bilingual(raw, "smalltalk_es", "smalltalk_en", lang),
    factualNoContextFallback: bilingual(
      raw,
      "factual_no_context_fallback_es",
      "factual_no_context_fallback_en",
      lang,
    ),
    sensitiveFallback: shared(raw, "sensitive_message"),
    orgProfile: bilingual(raw, "org_profile_es", "org_profile_en", lang),
  };
}

function mergeCapabilities(stored: Partial<Capabilities> | null | undefined): Capabilities {
  return {
    sensitive_safety: stored?.sensitive_safety ?? DEFAULT_CAPABILITIES.sensitive_safety,
    context_gathering: {
      on: stored?.context_gathering?.on ?? DEFAULT_CAPABILITIES.context_gathering.on,
      slots: stored?.context_gathering?.slots ?? DEFAULT_CAPABILITIES.context_gathering.slots,
    },
    org_identity: stored?.org_identity ?? DEFAULT_CAPABILITIES.org_identity,
  };
}

/**
 * Resuelve la config del pipeline para un workspace + idioma.
 * Un workspace inexistente o con campos vacíos cae al template default.
 */
export async function resolveBotConfig(
  workspaceId: string,
  language: string,
): Promise<BotConfig> {
  const lang = langKey(language);
  const cacheKey = `${workspaceId}:${lang}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  const rows = await sql<ConfigRow[]>`
    SELECT c.prompts, c.model_preferences, c.capabilities, c.programs,
           c.theme_categories, c.core_prompt, c.storyboard,
           w.assistant_name, w.name AS workspace_name
    FROM workspaces w
    LEFT JOIN workspace_configs c ON c.workspace_id = w.id
    WHERE w.id = ${workspaceId}
  `;
  const row = rows[0];
  const raw = (row?.prompts ?? {}) as RawPromptStore;

  const config: BotConfig = {
    prompts: resolvePrompts(raw, lang),
    models: { ...DEFAULT_MODELS, ...(row?.model_preferences ?? {}) },
    programs: row?.programs?.length ? row.programs : [],
    capabilities: mergeCapabilities(row?.capabilities),
    themeCategories: row?.theme_categories?.length
      ? row.theme_categories
      : DEFAULT_THEME_CATEGORIES,
    identity: row
      ? compileIdentity(
          row.assistant_name,
          row.workspace_name,
          row.core_prompt ?? DEFAULT_CORE_PROMPT,
          row.storyboard ?? DEFAULT_STORYBOARD,
        )
      : "",
  };

  cache.set(cacheKey, { config, expiresAt: Date.now() + CACHE_TTL_MS });
  return config;
}

/** Invalida la cache de un workspace (llamar al guardar su config en Settings). */
export function invalidateBotConfig(workspaceId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${workspaceId}:`)) cache.delete(key);
  }
}

/** Vacía toda la cache (útil en tests). */
export function clearBotConfigCache(): void {
  cache.clear();
}
