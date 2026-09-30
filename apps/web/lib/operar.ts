// Tipos y opciones de Operar compartidos entre server y cliente (sin DB).

export type PeriodoKey = "7" | "30" | "90" | "todo";

export const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: "7", label: "Últimos 7 días" },
  { key: "30", label: "Últimos 30 días" },
  { key: "90", label: "Últimos 90 días" },
  { key: "todo", label: "Todo" },
];

export function parsePeriodo(value: string | string[] | undefined): PeriodoKey {
  const v = Array.isArray(value) ? value[0] : value;
  return PERIODOS.some((p) => p.key === v) ? (v as PeriodoKey) : "30";
}

export type AlertChannel = "email" | "telegram" | "whatsapp";

export const CHANNEL_LABELS: Record<AlertChannel, string> = {
  email: "Correo",
  telegram: "Telegram",
  whatsapp: "WhatsApp del equipo",
};

export const CHANNEL_TARGET_LABELS: Record<AlertChannel, { label: string; placeholder: string }> = {
  email: { label: "Correo del responsable", placeholder: "coordinacion@tuorganizacion.org" },
  telegram: { label: "Chat o grupo de Telegram (id)", placeholder: "-1001234567890" },
  whatsapp: { label: "Número de WhatsApp del equipo", placeholder: "+57 300 000 0000" },
};

export interface AlertProtocol {
  responsibleName: string;
  channel: AlertChannel | null;
  channelTarget: string;
  responseTimeHours: number | null;
  active: boolean;
  updatedAt: string | null;
}

export const EMPTY_PROTOCOL: AlertProtocol = {
  responsibleName: "",
  channel: null,
  channelTarget: "",
  responseTimeHours: null,
  active: false,
  updatedAt: null,
};

/** Validación del destino según el canal (null = válido). */
export function channelTargetError(channel: AlertChannel, target: string): string | null {
  const t = target.trim();
  if (!t) return "Falta el destino del aviso";
  if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Ese correo no parece válido";
  if (channel === "telegram" && !/^(-?\d{5,}|@[A-Za-z0-9_]{5,})$/.test(t)) {
    return "Usa el id numérico del chat (p. ej. -1001234567890) o el @nombre del canal";
  }
  if (channel === "whatsapp" && !/^\+?[\d\s-]{8,20}$/.test(t)) return "Ese número no parece válido";
  return null;
}
