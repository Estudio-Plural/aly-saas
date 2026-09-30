// Fechas en la zona del programa. Sin librerías: Intl alcanza para sacar día
// de la semana, hora y medianoche local, que es todo lo que Operar necesita.

/** Zona por defecto de los programas (Colombia/Ecuador/Perú: UTC-5, sin DST). */
export const DEFAULT_TIMEZONE = "America/Bogota";

export const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export interface PartesLocales {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  /** 0 = lunes … 6 = domingo */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    formatters.set(tz, f);
  }
  return f;
}

export function partesLocales(date: Date, tz: string = DEFAULT_TIMEZONE): PartesLocales {
  const parts: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday ?? "Mon"] ?? 0,
  };
}

/** Diferencia (ms) entre la hora local de `tz` y UTC en ese instante. */
function offsetMs(date: Date, tz: string): number {
  const p = partesLocales(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

/** Instante UTC de la medianoche local de y-m-d en `tz`. */
export function medianocheLocal(year: number, month: number, day: number, tz: string = DEFAULT_TIMEZONE): Date {
  const guess = Date.UTC(year, month - 1, day);
  let result = guess - offsetMs(new Date(guess), tz);
  // Segunda pasada por si el offset cambió entre guess y result (DST)
  result = guess - offsetMs(new Date(result), tz);
  return new Date(result);
}

/** Fecha local "YYYY-MM-DD". */
export function fechaLocal(date: Date, tz: string = DEFAULT_TIMEZONE): string {
  const p = partesLocales(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function sumarDias(year: number, month: number, day: number, dias: number) {
  const d = new Date(Date.UTC(year, month - 1, day + dias));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export interface Periodo {
  /** Inclusivo */
  desde: Date;
  /** Exclusivo */
  hasta: Date;
}

/** Semana completa (lunes a domingo, zona local) anterior a la que contiene `now`. */
export function semanaAnterior(now: Date, tz: string = DEFAULT_TIMEZONE): Periodo {
  const p = partesLocales(now, tz);
  const lunesActual = sumarDias(p.year, p.month, p.day, -p.weekday);
  const lunesPrevio = sumarDias(lunesActual.year, lunesActual.month, lunesActual.day, -7);
  return {
    desde: medianocheLocal(lunesPrevio.year, lunesPrevio.month, lunesPrevio.day, tz),
    hasta: medianocheLocal(lunesActual.year, lunesActual.month, lunesActual.day, tz),
  };
}

/** La semana inmediatamente anterior a `semana` (para la variación). */
export function semanaPrevia(semana: Periodo, tz: string = DEFAULT_TIMEZONE): Periodo {
  const p = partesLocales(semana.desde, tz);
  const lunes = sumarDias(p.year, p.month, p.day, -7);
  return { desde: medianocheLocal(lunes.year, lunes.month, lunes.day, tz), hasta: semana.desde };
}

/** Últimos N días completos + hoy (desde la medianoche local de hace N-1 días). */
export function ultimosDias(now: Date, dias: number, tz: string = DEFAULT_TIMEZONE): Periodo {
  const p = partesLocales(now, tz);
  const inicio = sumarDias(p.year, p.month, p.day, -(dias - 1));
  return { desde: medianocheLocal(inicio.year, inicio.month, inicio.day, tz), hasta: now };
}

/** "1 de septiembre de 2026" (a mano: no depende del locale del proceso). */
export function fechaLarga(date: Date, tz: string = DEFAULT_TIMEZONE): string {
  const p = partesLocales(date, tz);
  return `${p.day} de ${MESES[p.month - 1]} de ${p.year}`;
}

/** "1 al 7 de septiembre" — el mes se repite solo si cambia. `hasta` exclusivo. */
export function rangoHumano(periodo: Periodo, tz: string = DEFAULT_TIMEZONE): string {
  const a = partesLocales(periodo.desde, tz);
  const b = partesLocales(new Date(periodo.hasta.getTime() - 1), tz);
  if (a.month === b.month && a.year === b.year) {
    return `${a.day} al ${b.day} de ${MESES[a.month - 1]}`;
  }
  return `${a.day} de ${MESES[a.month - 1]} al ${b.day} de ${MESES[b.month - 1]}`;
}
