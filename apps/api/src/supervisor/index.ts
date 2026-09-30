// Supervisor de conversaciones: análisis post-conversación con evidencia
// verificada, severidad por regla y alertas HIGH sin PII.
export { runSupervisor, settingsFromEnv, startSupervisorInterval, needsSupervision } from "./job";
export type { SupervisorDeps, SupervisorReport, SupervisorSettings } from "./job";
export { notifierFromEnv, formatAlertMessage } from "./notify";
export type * from "./types";
