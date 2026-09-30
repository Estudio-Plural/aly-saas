// Reporte semanal: correo (texto + HTML) y Excel con las MISMAS cifras.
//
// ⚠️ Este reporte sale hacia la organización y no lleva PII, nunca: ni números,
// ni nombres, ni fragmentos de conversación. Todo sale de `Cifras`, que ya es
// agregada. Si algún día hace falta un dato por persona, va por otro canal.
//
// El texto lo arma el código (esqueleto fijo, cifras calculadas). No hay prosa
// de modelo: un correo semanal que dice un número distinto al del Excel es
// peor que un correo sin adjetivos.

import {
  duracionHumana,
  MIN_CONVERSACIONES_POR_TEMA,
  MUESTRA_MINIMA,
  proporcionConBase,
  type Cifras,
} from "./cifras";
import { DEFAULT_TIMEZONE, fechaLarga, rangoHumano, type Periodo } from "./tiempo";
import { construirXlsx, type Fila, type Hoja } from "./xlsx";

export const CORREO_CONTACTO = "hola@estudio-plural.co";

export interface ReporteInput {
  programa: string;
  semana: Periodo;
  actual: Cifras;
  anterior: Cifras;
  /** ¿La organización tiene un protocolo ante riesgo activo? */
  protocoloActivo: boolean;
  /** Link al panel (opcional). */
  panelUrl?: string | null;
  tz?: string;
}

export interface Variacion {
  etiqueta: string;
  actual: number;
  anterior: number;
  texto: string;
}

export interface ReporteSemanal {
  asunto: string;
  rango: string;
  texto: string;
  html: string;
  variaciones: Variacion[];
  /** Solo agregados: es lo que se guarda en weekly_reports.summary. */
  resumen: {
    programa: string;
    semana: { desde: string; hasta: string };
    actual: Cifras;
    anterior: Cifras;
    protocoloActivo: boolean;
  };
}

export function variacion(etiqueta: string, actual: number, anterior: number): Variacion {
  const d = actual - anterior;
  const texto =
    d === 0
      ? "igual que la semana anterior"
      : `${Math.abs(d)} ${d > 0 ? "más" : "menos"} que la semana anterior (${anterior})`;
  return { etiqueta, actual, anterior, texto };
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function maximo<T extends { etiqueta: string; valor: number }>(items: T[]): T | null {
  const top = [...items].sort((a, b) => b.valor - a.valor)[0];
  return top && top.valor > 0 ? top : null;
}

interface Seccion {
  titulo: string;
  lineas: string[];
}

function secciones(input: ReporteInput): Seccion[] {
  const { actual: a, anterior: b } = input;
  if (a.conversaciones === 0) {
    return [
      {
        titulo: "En cifras",
        lineas: [
          "Esta semana no hubo conversaciones reales con el asistente.",
          b.conversaciones > 0
            ? `La semana anterior hubo ${plural(b.conversaciones, "conversación", "conversaciones")}.`
            : "Tampoco hubo la semana anterior.",
        ],
      },
    ];
  }

  const cifras: string[] = [
    `Personas que escribieron: ${a.personas} (la semana anterior, ${b.personas}).`,
    `Conversaciones: ${a.conversaciones} (la semana anterior, ${b.conversaciones}).`,
    `Conversan (escribieron 2 mensajes o más): ${proporcionConBase(a.enganche.conversan, a.enganche.base, "conversación", "conversaciones")}. Solo saludaron: ${a.enganche.soloSaludan}.`,
    `Mensajes por persona (mediana): ${a.mensajesPorPersona.mediana ?? 0}, de ${plural(a.mensajesPorPersona.base, "persona", "personas")}.`,
    `Tiempo de respuesta del asistente (mediana): ${duracionHumana(a.respuesta.medianaSegundos)}, de ${plural(a.respuesta.base, "respuesta", "respuestas")}.`,
  ];
  const sensibles = `Situaciones sensibles: ${plural(a.sensibles.conversaciones, "conversación", "conversaciones")} de ${plural(a.sensibles.base, "analizada", "analizadas")}.`;
  cifras.push(
    input.protocoloActivo
      ? `${sensibles} Se avisaron según tu protocolo ante riesgo.`
      : `${sensibles} Las revisa el equipo de Plural.`,
  );
  if (a.conversaciones < MUESTRA_MINIMA) {
    cifras.push(`Con menos de ${MUESTRA_MINIMA} conversaciones mostramos conteos, no porcentajes.`);
  }

  const temas: string[] = [];
  if (a.temas.items.length) {
    temas.push(
      `Temas más frecuentes: ${a.temas.items
        .slice(0, 6)
        .map((t) => `${t.etiqueta} (${t.valor})`)
        .join(", ")}; de ${plural(a.temas.base, "conversación analizada", "conversaciones analizadas")}.`,
    );
  } else {
    temas.push(`Todavía no hay temas que se repitan en ${MIN_CONVERSACIONES_POR_TEMA} conversaciones o más.`);
  }
  if (a.momentos.base > 0) {
    temas.push(
      `Hasta dónde llegan en el programa: ${a.momentos.items
        .map((m) => `${m.etiqueta.toLowerCase()} ${m.valor}`)
        .join(", ")}; sin arrancar ${a.momentos.sinArrancar}.`,
    );
  }

  const cuando: string[] = [];
  const dia = maximo(a.cuando.porDia);
  const hora = maximo(a.cuando.porHora);
  if (dia && hora) {
    cuando.push(
      `El día con más mensajes fue el ${dia.etiqueta} (${dia.valor}) y la hora con más mensajes, las ${hora.etiqueta.replace("h", "")}:00 (${hora.valor}); de ${plural(a.cuando.base, "mensaje", "mensajes")}.`,
    );
  }

  return [
    { titulo: "En cifras", lineas: cifras },
    { titulo: "De qué hablan", lineas: temas },
    ...(cuando.length ? [{ titulo: "Cuándo escriben", lineas: cuando }] : []),
  ];
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function construirReporte(input: ReporteInput): ReporteSemanal {
  const tz = input.tz ?? DEFAULT_TIMEZONE;
  const rango = rangoHumano(input.semana, tz);
  const asunto = `Resumen semanal de ${input.programa}: ${rango}`;
  const intro = `Este es el resumen de ${input.programa} del ${rango}. Son cifras agregadas: no incluyen nombres, números de teléfono ni mensajes.`;
  const cuerpo = secciones(input);
  const pie = [
    input.panelUrl ? `Puedes ver el detalle y descargar el Excel en Operar: ${input.panelUrl}` : null,
    `¿Dudas? Escríbenos a ${CORREO_CONTACTO}.`,
  ].filter(Boolean) as string[];

  const texto = [
    "Hola:",
    "",
    intro,
    ...cuerpo.flatMap((s) => ["", s.titulo, ...s.lineas.map((l) => `- ${l}`)]),
    "",
    ...pie,
  ].join("\n");

  const html = [
    `<p>Hola:</p>`,
    `<p>${escHtml(intro)}</p>`,
    ...cuerpo.map(
      (s) => `<p><strong>${escHtml(s.titulo)}</strong><br>${s.lineas.map((l) => `– ${escHtml(l)}`).join("<br>")}</p>`,
    ),
    `<p>${pie
      .map((l) => escHtml(l).replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>'))
      .join("<br>")}</p>`,
  ].join("\n");

  const a = input.actual;
  const b = input.anterior;
  return {
    asunto,
    rango,
    texto,
    html,
    variaciones: [
      variacion("Personas que escribieron", a.personas, b.personas),
      variacion("Conversaciones", a.conversaciones, b.conversaciones),
      variacion("Conversan (2 mensajes o más)", a.enganche.conversan, b.enganche.conversan),
      variacion("Solo saludaron", a.enganche.soloSaludan, b.enganche.soloSaludan),
      variacion("Mensajes de las personas", a.mensajesDePersonas, b.mensajesDePersonas),
      variacion("Situaciones sensibles", a.sensibles.conversaciones, b.sensibles.conversaciones),
    ],
    resumen: {
      programa: input.programa,
      semana: { desde: input.semana.desde.toISOString(), hasta: input.semana.hasta.toISOString() },
      actual: a,
      anterior: b,
      protocoloActivo: input.protocoloActivo,
    },
  };
}

// ── Excel ───────────────────────────────────────────────────────────────────

const t = (valor: string) => ({ valor, estilo: "titulo" as const });
const h = (valor: string) => ({ valor, estilo: "encabezado" as const });
const nota = (valor: string) => ({ valor, estilo: "nota" as const });

export function construirExcelReporte(reporte: ReporteSemanal, tz: string = DEFAULT_TIMEZONE): Uint8Array {
  const { actual: a, anterior: b, programa, semana } = reporte.resumen;
  const desde = new Date(semana.desde);
  const hastaIncl = new Date(new Date(semana.hasta).getTime() - 1);

  const comoLeer: Hoja = {
    nombre: "Cómo leer este reporte",
    anchos: [100],
    filas: [
      [t("Cómo leer este reporte")],
      [`Programa: ${programa}.`],
      [`Período: ${fechaLarga(desde, tz)} a ${fechaLarga(hastaIncl, tz)} (lunes a domingo, hora de ${tz}).`],
      [null],
      [{ valor: "Qué cuenta cada cifra", estilo: "negrita" }],
      ["Personas: números de WhatsApp distintos que escribieron en conversaciones que empezaron en la semana."],
      ["Conversaciones: conversaciones que empezaron en la semana. No se cuentan las del chat de prueba del panel."],
      ["Conversan: la persona escribió 2 mensajes o más. Solo saludaron: escribió uno y no siguió."],
      ["Mensajes por persona: mediana de los mensajes que escribió cada persona (sin contar las respuestas del asistente)."],
      ["Tiempo de respuesta: mediana entre un mensaje de la persona y la respuesta del asistente."],
      ["Temas y momentos: salen del análisis automático de cada conversación. Una conversación puede tener varios temas."],
      [`Un tema solo aparece si se repite en ${MIN_CONVERSACIONES_POR_TEMA} conversaciones o más: uno que aparece una sola vez puede identificar a alguien.`],
      ["Situaciones sensibles: conversaciones con una alerta de severidad alta. Solo el conteo."],
      [`Con menos de ${MUESTRA_MINIMA} conversaciones conviene leer conteos, no porcentajes.`],
      [null],
      [nota("Este reporte no tiene nombres, números de teléfono ni fragmentos de conversación, y no debe completarse con ellos.")],
      [nota(`Contacto: ${CORREO_CONTACTO}`)],
    ],
  };

  const resumen: Hoja = {
    nombre: "Resumen",
    anchos: [42, 16, 22, 50],
    filas: [
      [t(`Resumen: ${reporte.rango}`)],
      [h("Cifra"), h("Esta semana"), h("Semana anterior"), h("Base")],
      ["Personas que escribieron", a.personas, b.personas, "Números distintos"],
      ["Conversaciones", a.conversaciones, b.conversaciones, "Empezaron en la semana"],
      ["Conversan (2 mensajes o más)", a.enganche.conversan, b.enganche.conversan, `De ${a.enganche.base} conversaciones`],
      ["Solo saludaron", a.enganche.soloSaludan, b.enganche.soloSaludan, `De ${a.enganche.base} conversaciones`],
      ["Mensajes por persona (mediana)", a.mensajesPorPersona.mediana ?? 0, b.mensajesPorPersona.mediana ?? 0, `De ${a.mensajesPorPersona.base} personas`],
      ["Tiempo de respuesta (mediana, segundos)", a.respuesta.medianaSegundos === null ? "sin datos" : Math.round(a.respuesta.medianaSegundos), b.respuesta.medianaSegundos === null ? "sin datos" : Math.round(b.respuesta.medianaSegundos), `De ${a.respuesta.base} respuestas`],
      ["Situaciones sensibles", a.sensibles.conversaciones, b.sensibles.conversaciones, `De ${a.sensibles.base} conversaciones analizadas`],
      [null],
      [nota(reporte.resumen.protocoloActivo ? "Las situaciones sensibles se avisan según el protocolo ante riesgo de la organización." : "Sin protocolo ante riesgo, las situaciones sensibles las revisa el equipo de Plural.")],
    ],
  };

  const diaADia: Hoja = {
    nombre: "Día a día",
    anchos: [14, 16, 12, 22],
    filas: [
      [t("Día a día")],
      [h("Fecha"), h("Conversaciones"), h("Personas"), h("Mensajes de personas")],
      ...(a.diaADia.length
        ? a.diaADia.map((d): Fila => [d.fecha, d.conversaciones, d.personas, d.mensajes])
        : [["Sin conversaciones esta semana"]]),
    ],
  };

  const temas: Hoja = {
    nombre: "Temas",
    anchos: [40, 18],
    filas: [
      [t("De qué hablan")],
      [h("Tema"), h("Conversaciones")],
      ...(a.temas.items.length
        ? a.temas.items.map((x): Fila => [x.etiqueta, x.valor])
        : [["Todavía no hay temas que se repitan"]]),
      [null],
      [nota(`Base: ${a.temas.base} conversaciones analizadas. ${a.temas.ocultos} temas aparecieron en una sola conversación y no se muestran.`)],
    ],
  };

  const alcance: Hoja = {
    nombre: "Alcance",
    anchos: [40, 18],
    filas: [
      [t("Hasta dónde llegan en el programa")],
      [h("Momento del programa"), h("Conversaciones")],
      ...a.momentos.items.map((m): Fila => [m.etiqueta, m.valor]),
      ["Sin arrancar el programa", a.momentos.sinArrancar],
      [null],
      [nota(`Base: ${a.momentos.base} conversaciones analizadas. Cada conversación cuenta en el momento más avanzado al que llegó.`)],
    ],
  };

  const cuando: Hoja = {
    nombre: "Cuándo",
    anchos: [14, 12, 4, 10, 12],
    filas: [
      [t("Cuándo escriben")],
      [h("Día"), h("Mensajes"), null, h("Hora"), h("Mensajes")],
      ...a.cuando.porHora.map((hr, i): Fila => {
        const d = a.cuando.porDia[i];
        return [d?.etiqueta ?? null, d?.valor ?? null, null, hr.etiqueta, hr.valor];
      }),
      [null],
      [nota(`Base: ${a.cuando.base} mensajes de personas. Hora de ${tz}.`)],
    ],
  };

  return construirXlsx([comoLeer, resumen, diaADia, temas, alcance, cuando]);
}
