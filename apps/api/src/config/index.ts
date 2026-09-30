// Config-driven engine (Fase 0). Ver docs/phase-0-config-driven-engine.md.
export type {
  AgentPrompts,
  BotConfig,
  Capabilities,
  RawPromptStore,
} from "./types";
export {
  DEFAULT_CAPABILITIES,
  DEFAULT_MODELS,
  DEFAULT_RAW_PROMPTS,
  DEFAULT_THEME_CATEGORIES,
} from "./defaults";
export {
  clearBotConfigCache,
  invalidateBotConfig,
  resolveBotConfig,
} from "./resolve";
export {
  SAFETY_RULES,
  NO_HELP_ROUTES_BLOCK,
  compileBoundaries,
  compileHelpRoutes,
  type Boundaries,
  type BoundaryRule,
  type HelpRoute,
} from "./guardrails";
export { compileIdentity } from "./identity";
