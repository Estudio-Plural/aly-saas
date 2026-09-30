// Cifras agregadas de Operar. Responden las preguntas del programa: ¿llega?,
// ¿conversa o solo saluda?, ¿de qué habla?, ¿cuándo?, ¿hubo situaciones
// sensibles?, ¿el asistente responde a tiempo?
//
// ⚠️ Sin PII: la entrada trae un identificador de persona (para contar
// personas distintas) pero la salida NUNCA lo incluye, ni texto de mensajes.
// La salida es lo que ve el rol cliente, lo que va al correo y al Excel.
//
// Funciones puras: las cifras las arma el código, nunca un modelo.

import { DIAS, DEFAULT_TIMEZONE, fechaLocal, partesLocales, type Periodo } from "./tiempo";

/** Por debajo de esta base se muestran conteos, no porcentajes (misma regla que Tranqui). */
export const MUESTRA_MINIMA = 20;

/** Un tema se muestra solo si aparece en al menos este número de conversaciones. */
export const MIN_CONVERSACIONES_POR_TEMA = 2;

export type MomentoKey = "opening" | "development" | "next_steps" | "closing";

export const MOMENTO_ETIQUETAS: Record<MomentoKey, string> = {
  opening: "Arranque",
  development: "Desarrollo",
  next_steps: "Lo que debe pasar después",
  closing: "Cierre",
};

const MOMENTOS: MomentoKey[] = ["opening", "development", "next_steps", "closing"];

/** Metadatos de un mensaje (sin texto). */
export interface MensajeMeta {
  conversationId: string;
  /** Identificador de la persona (número). Solo se usa para contar; nunca sale. */
  personKey: string;
  role: "user" | "assistant" | string;
  timestamp: Date;
}

/** Lo que el supervisor dejó de cada conversación (sin texto de mensajes). */
export interface AnalisisMeta {
  conversationId: string;
  momento: MomentoKey | null;
  keywords: string[];
  flagSeverity: string | null;
}

export interface CifrasInput {
  mensajes: MensajeMeta[];
  analisis: AnalisisMeta[];
  periodo: Periodo;
  tz?: string;
}

export interface Conteo {
  etiqueta: string;
  valor: number;
}

export interface Cifras {
  periodo: { desde: string; hasta: string };
  tz: string;
  /** Personas distintas que escribieron. */
  personas: number;
  /** Conversaciones que empezaron en el período. */
  conversaciones: number;
  /** Mensajes que escribieron las personas (sin contar al asistente). */
  mensajesDePersonas: number;
  enganche: {
    /** Escribieron 2 o más mensajes. */
    conversan: number;
    /** Escribieron un solo mensaje (casi siempre un saludo) y no siguieron. */
    soloSaludan: number;
    base: number;
  };
  mensajesPorPersona: { mediana: number | null; base: number };
  /** Hasta dónde llegó cada conversación analizada en el storyboard. */
  momentos: { items: (Conteo & { momento: MomentoKey })[]; sinArrancar: number; base: number };
  temas: { items: Conteo[]; ocultos: number; base: number };
  cuando: { porDia: Conteo[]; porHora: Conteo[]; base: number };
  diaADia: { fecha: string; conversaciones: number; personas: number; mensajes: number }[];
  /** Solo conteos: conversaciones con alguna alerta alta. */
  sensibles: { conversaciones: number; base: number };
  respuesta: { medianaSegundos: number | null; base: number };
}

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const s = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Porcentaje solo si la base da para leerlo; si no, «7 de 12». */
export function proporcion(parte: number, total: number): string {
  if (total <= 0) return "0 de 0";
  if (total >= MUESTRA_MINIMA) return `${Math.round((parte / total) * 100)}%`;
  return `${parte} de ${total}`;
}

/** «25% de 40 conversaciones» o, con base chica, «7 de 12 conversaciones». */
export function proporcionConBase(parte: number, total: number, uno: string, varios: string): string {
  const unidad = total === 1 ? uno : varios;
  if (total >= MUESTRA_MINIMA) return `${Math.round((parte / total) * 100)}% de ${total} ${unidad}`;
  return `${parte} de ${total} ${unidad}`;
}

/** «45 s», «3 min», «2 h 10 min». */
export function duracionHumana(segundos: number | null): string {
  if (segundos === null) return "sin datos";
  if (segundos < 60) return `${Math.round(segundos)} s`;
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

function normalizarTema(k: string): string {
  return k.trim().toLowerCase().replace(/\s+/g, " ");
}

export function calcularCifras({ mensajes, analisis, periodo, tz = DEFAULT_TIMEZONE }: CifrasInput): Cifras {
  // Agrupar por conversación y quedarse con las que EMPIEZAN en el período
  const porConv = new Map<string, MensajeMeta[]>();
  for (const m of mensajes) {
    const list = porConv.get(m.conversationId);
    if (list) list.push(m);
    else porConv.set(m.conversationId, [m]);
  }
  const convs: { id: string; mensajes: MensajeMeta[]; inicio: Date }[] = [];
  for (const [id, list] of porConv) {
    list.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const inicio = list[0]!.timestamp;
    if (inicio >= periodo.desde && inicio < periodo.hasta) convs.push({ id, mensajes: list, inicio });
  }
  const convIds = new Set(convs.map((c) => c.id));

  // Personas y mensajes por persona (solo lo que escribieron ellas)
  const mensajesPorPersona = new Map<string, number>();
  let conversan = 0;
  let soloSaludan = 0;
  let mensajesDePersonas = 0;
  const porDia = new Array(7).fill(0) as number[];
  const porHora = new Array(24).fill(0) as number[];
  const tiemposRespuesta: number[] = [];
  const diario = new Map<string, { conversaciones: number; personas: Set<string>; mensajes: number }>();

  for (const conv of convs) {
    const persona = conv.mensajes.find((m) => m.role === "user")?.personKey ?? conv.mensajes[0]!.personKey;
    const deLaPersona = conv.mensajes.filter((m) => m.role === "user");
    mensajesPorPersona.set(persona, (mensajesPorPersona.get(persona) ?? 0) + deLaPersona.length);
    if (deLaPersona.length >= 2) conversan++;
    else soloSaludan++;
    mensajesDePersonas += deLaPersona.length;

    const dia = fechaLocal(conv.inicio, tz);
    const d = diario.get(dia) ?? { conversaciones: 0, personas: new Set<string>(), mensajes: 0 };
    d.conversaciones++;
    d.personas.add(persona);
    d.mensajes += deLaPersona.length;
    diario.set(dia, d);

    for (const m of deLaPersona) {
      const p = partesLocales(m.timestamp, tz);
      porDia[p.weekday]!++;
      porHora[p.hour]!++;
    }

    // Tiempo de respuesta: mensaje de la persona seguido de uno del asistente
    for (let i = 0; i < conv.mensajes.length - 1; i++) {
      const a = conv.mensajes[i]!;
      const b = conv.mensajes[i + 1]!;
      if (a.role === "user" && b.role === "assistant") {
        tiemposRespuesta.push(Math.max(0, (b.timestamp.getTime() - a.timestamp.getTime()) / 1000));
      }
    }
  }

  // Lo que dejó el supervisor, solo de conversaciones del período
  const analizadas = analisis.filter((a) => convIds.has(a.conversationId));
  const conMomento = new Map<MomentoKey, number>();
  let sinArrancar = 0;
  const temas = new Map<string, number>();
  let sensibles = 0;
  for (const a of analizadas) {
    if (a.momento && MOMENTOS.includes(a.momento)) conMomento.set(a.momento, (conMomento.get(a.momento) ?? 0) + 1);
    else sinArrancar++;
    for (const t of new Set(a.keywords.map(normalizarTema).filter(Boolean))) {
      temas.set(t, (temas.get(t) ?? 0) + 1);
    }
    if ((a.flagSeverity ?? "").toUpperCase() === "HIGH") sensibles++;
  }
  // Un tema que aparece en una sola conversación puede identificar a alguien
  // (un nombre, un lugar): no se muestra, se cuenta como oculto.
  const temasVisibles = [...temas.entries()]
    .filter(([, n]) => n >= MIN_CONVERSACIONES_POR_TEMA)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([etiqueta, valor]) => ({ etiqueta, valor }));
  const ocultos = [...temas.values()].filter((n) => n < MIN_CONVERSACIONES_POR_TEMA).length;

  return {
    periodo: { desde: periodo.desde.toISOString(), hasta: periodo.hasta.toISOString() },
    tz,
    personas: mensajesPorPersona.size,
    conversaciones: convs.length,
    mensajesDePersonas,
    enganche: { conversan, soloSaludan, base: convs.length },
    mensajesPorPersona: { mediana: mediana([...mensajesPorPersona.values()]), base: mensajesPorPersona.size },
    momentos: {
      items: MOMENTOS.map((momento) => ({
        momento,
        etiqueta: MOMENTO_ETIQUETAS[momento],
        valor: conMomento.get(momento) ?? 0,
      })),
      sinArrancar,
      base: analizadas.length,
    },
    temas: { items: temasVisibles, ocultos, base: analizadas.length },
    cuando: {
      porDia: DIAS.map((etiqueta, i) => ({ etiqueta, valor: porDia[i]! })),
      porHora: porHora.map((valor, h) => ({ etiqueta: `${String(h).padStart(2, "0")}h`, valor })),
      base: mensajesDePersonas,
    },
    diaADia: [...diario.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, d]) => ({
        fecha,
        conversaciones: d.conversaciones,
        personas: d.personas.size,
        mensajes: d.mensajes,
      })),
    sensibles: { conversaciones: sensibles, base: analizadas.length },
    respuesta: { medianaSegundos: mediana(tiemposRespuesta), base: tiemposRespuesta.length },
  };
}
