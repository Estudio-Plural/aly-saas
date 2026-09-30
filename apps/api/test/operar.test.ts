// Operar: cifras agregadas sobre datos sintéticos, reporte semanal sin PII,
// Excel válido y job del reporte (idempotencia, SMTP mockeado, sin SMTP).
// Sin DB, sin SMTP real, sin LLM.

import { describe, expect, mock, test } from "bun:test";

mock.module("../src/db", () => ({
  sql: Object.assign(
    () => {
      throw new Error("DB no disponible en tests");
    },
    { json: (v: unknown) => v },
  ),
}));

const {
  calcularCifras,
  construirExcelReporte,
  construirReporte,
  duracionHumana,
  mediana,
  proporcion,
  proporcionConBase,
  semanaAnterior,
  semanaPrevia,
  fechaLocal,
  rangoHumano,
  partesLocales,
} = await import("@aly-saas/operar");
type AnalisisMeta = import("@aly-saas/operar").AnalisisMeta;
type MensajeMeta = import("@aly-saas/operar").MensajeMeta;
type Periodo = import("@aly-saas/operar").Periodo;
const { runWeeklyReports } = await import("../src/operar/weekly");
type WeeklyStore = import("../src/operar/weekly").WeeklyStore;
const { createApp } = await import("../src/app");

const TZ = "America/Bogota"; // UTC-5 fijo

// Lunes 21 al domingo 27 de septiembre de 2026 (hora de Bogotá)
const SEMANA: Periodo = {
  desde: new Date("2026-09-21T05:00:00Z"),
  hasta: new Date("2026-09-28T05:00:00Z"),
};

/** Hora local de Bogotá → Date. */
const bog = (iso: string) => new Date(`${iso}-05:00`);

const PII = ["+573001112233", "+573004445566", "+573007778899", "Mariana Pérez", "calle Falsa 123"];

/**
 * Conversación sintética: la persona escribe `userTurns` mensajes y el
 * asistente responde a cada uno a los `delaySec` segundos.
 */
function conv(
  id: string,
  person: string,
  startIso: string,
  userTurns: number,
  delaySec = 5,
): MensajeMeta[] {
  const start = bog(startIso).getTime();
  const out: MensajeMeta[] = [];
  for (let i = 0; i < userTurns; i++) {
    const t = start + i * 120_000;
    out.push({ conversationId: id, personKey: person, role: "user", timestamp: new Date(t) });
    out.push({ conversationId: id, personKey: person, role: "assistant", timestamp: new Date(t + delaySec * 1000) });
  }
  return out;
}

function datosSinteticos() {
  const mensajes: MensajeMeta[] = [
    // Mariana (+57300111…): dos conversaciones, lunes 20h (5 turnos) y miércoles 20h (1 turno)
    ...conv("c1", PII[0]!, "2026-09-21T20:00:00", 5, 4),
    ...conv("c2", PII[0]!, "2026-09-23T20:10:00", 1, 6),
    // Otra persona: martes 9h, 3 turnos
    ...conv("c3", PII[1]!, "2026-09-22T09:00:00", 3, 10),
    // Otra: lunes 20h, solo saluda
    ...conv("c4", PII[2]!, "2026-09-21T20:30:00", 1, 2),
    // Fuera del período (la semana anterior): no cuenta
    ...conv("c-vieja", PII[2]!, "2026-09-15T10:00:00", 4),
  ];
  const analisis: AnalisisMeta[] = [
    { conversationId: "c1", momento: "next_steps", keywords: ["ansiedad", "Sueño", "Mariana Pérez"], flagSeverity: "HIGH" },
    { conversationId: "c3", momento: "development", keywords: ["ansiedad", "sueño", "calle Falsa 123"], flagSeverity: "MEDIUM" },
    { conversationId: "c4", momento: null, keywords: [], flagSeverity: null },
    { conversationId: "c-vieja", momento: "closing", keywords: ["ansiedad"], flagSeverity: "HIGH" },
  ];
  return { mensajes, analisis };
}

describe("cifras agregadas", () => {
  test("responden ¿llega?, ¿conversa?, ¿de qué habla?, ¿cuándo? sobre datos sintéticos", () => {
    const c = calcularCifras({ ...datosSinteticos(), periodo: SEMANA, tz: TZ });

    expect(c.personas).toBe(3);
    expect(c.conversaciones).toBe(4);
    expect(c.mensajesDePersonas).toBe(5 + 1 + 3 + 1);
    expect(c.enganche).toEqual({ conversan: 2, soloSaludan: 2, base: 4 });
    // Mensajes por persona: 6, 3, 1 → mediana 3
    expect(c.mensajesPorPersona).toEqual({ mediana: 3, base: 3 });

    // Momentos: solo analizadas del período (c1, c3, c4)
    expect(c.momentos.base).toBe(3);
    expect(c.momentos.items.find((m) => m.momento === "next_steps")!.valor).toBe(1);
    expect(c.momentos.items.find((m) => m.momento === "development")!.valor).toBe(1);
    expect(c.momentos.items.find((m) => m.momento === "closing")!.valor).toBe(0);
    expect(c.momentos.sinArrancar).toBe(1);

    // Temas: normalizados, solo los que aparecen en ≥ 2 conversaciones
    expect(c.temas.items).toEqual([
      { etiqueta: "ansiedad", valor: 2 },
      { etiqueta: "sueño", valor: 2 },
    ]);
    expect(c.temas.ocultos).toBe(2);

    // Cuándo: mensajes de las personas por día (lunes = 5+1) y hora local
    expect(c.cuando.base).toBe(10);
    expect(c.cuando.porDia[0]).toEqual({ etiqueta: "lunes", valor: 6 });
    expect(c.cuando.porDia[1]!.valor).toBe(3);
    expect(c.cuando.porDia[2]!.valor).toBe(1);
    expect(c.cuando.porHora[20]!.valor).toBe(7);
    expect(c.cuando.porHora[9]!.valor).toBe(3);

    // Día a día (fecha local)
    expect(c.diaADia.map((d) => d.fecha)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
    expect(c.diaADia[0]).toEqual({ fecha: "2026-09-21", conversaciones: 2, personas: 2, mensajes: 6 });

    // Sensibles: solo conteo, solo del período
    expect(c.sensibles).toEqual({ conversaciones: 1, base: 3 });

    // Respuesta: 10 pares; mediana de [4×5, 6, 10×3, 2] = 4
    expect(c.respuesta.base).toBe(10);
    expect(c.respuesta.medianaSegundos).toBe(4);
  });

  test("la salida no trae identificadores de personas ni temas únicos", () => {
    const c = calcularCifras({ ...datosSinteticos(), periodo: SEMANA, tz: TZ });
    const json = JSON.stringify(c);
    for (const leak of PII) expect(json.toLowerCase()).not.toContain(leak.toLowerCase());
    expect(json).not.toContain("c1");
  });

  test("período vacío: todo en cero, sin medianas inventadas", () => {
    const c = calcularCifras({ mensajes: [], analisis: [], periodo: SEMANA, tz: TZ });
    expect(c.conversaciones).toBe(0);
    expect(c.mensajesPorPersona.mediana).toBeNull();
    expect(c.respuesta.medianaSegundos).toBeNull();
    expect(c.temas.items).toEqual([]);
  });

  test("helpers: mediana, proporción con muestra mínima, duración", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
    expect(proporcion(7, 12)).toBe("7 de 12");
    expect(proporcion(10, 40)).toBe("25%");
    expect(proporcion(0, 0)).toBe("0 de 0");
    expect(proporcionConBase(2, 4, "conversación", "conversaciones")).toBe("2 de 4 conversaciones");
    expect(proporcionConBase(10, 40, "conversación", "conversaciones")).toBe("25% de 40 conversaciones");
    expect(duracionHumana(4)).toBe("4 s");
    expect(duracionHumana(180)).toBe("3 min");
    expect(duracionHumana(7800)).toBe("2 h 10 min");
    expect(duracionHumana(null)).toBe("sin datos");
  });

  test("semanas en la zona del programa (lunes a domingo)", () => {
    // Miércoles 30-sep 10:00 Bogotá → la semana anterior es 21 al 27
    const s = semanaAnterior(bog("2026-09-30T10:00:00"), TZ);
    expect(s.desde.toISOString()).toBe(SEMANA.desde.toISOString());
    expect(s.hasta.toISOString()).toBe(SEMANA.hasta.toISOString());
    // Lunes 28 a las 00:30 Bogotá (05:30 UTC) → también 21 al 27
    expect(semanaAnterior(new Date("2026-09-28T05:30:00Z"), TZ).desde.toISOString()).toBe(SEMANA.desde.toISOString());
    // Domingo 27 a las 23:00 Bogotá (lunes 04:00 UTC) → todavía 14 al 20
    expect(fechaLocal(semanaAnterior(new Date("2026-09-28T04:00:00Z"), TZ).desde, TZ)).toBe("2026-09-14");
    expect(fechaLocal(semanaPrevia(SEMANA, TZ).desde, TZ)).toBe("2026-09-14");
    expect(rangoHumano(SEMANA, TZ)).toBe("21 al 27 de septiembre");
    expect(partesLocales(bog("2026-09-21T20:00:00"), TZ)).toMatchObject({ weekday: 0, hour: 20 });
  });
});

// ── Reporte ──────────────────────────────────────────────────────────────
function reporteSintetico(protocoloActivo = false) {
  const d = datosSinteticos();
  return construirReporte({
    programa: "Apapáchar",
    semana: SEMANA,
    actual: calcularCifras({ ...d, periodo: SEMANA, tz: TZ }),
    anterior: calcularCifras({ ...d, periodo: semanaPrevia(SEMANA, TZ), tz: TZ }),
    protocoloActivo,
    panelUrl: "https://panel.test/apapachar/operar",
    tz: TZ,
  });
}

/** Texto de todas las hojas del .xlsx (sin compresión: el XML va en claro). */
function textoXlsx(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("reporte semanal", () => {
  test("cifras armadas por código, con base declarada y variación", () => {
    const r = reporteSintetico();
    expect(r.asunto).toBe("Resumen semanal de Apapáchar: 21 al 27 de septiembre");
    expect(r.texto).toContain("Personas que escribieron: 3 (la semana anterior, 1).");
    expect(r.texto).toContain("Conversaciones: 4 (la semana anterior, 1).");
    expect(r.texto).toContain("2 de 4 conversaciones"); // base < 20 → conteo, no %
    expect(r.texto).toContain("ansiedad (2), sueño (2)");
    expect(r.texto).toContain("Situaciones sensibles: 1 conversación de 3 analizadas. Las revisa el equipo de Plural.");
    expect(r.texto).toContain("hola@estudio-plural.co");
    expect(r.variaciones.find((v) => v.etiqueta === "Conversaciones")).toMatchObject({
      actual: 4,
      anterior: 1,
      texto: "3 más que la semana anterior (1)",
    });
  });

  test("con protocolo activo lo dice; sin protocolo no promete alertas", () => {
    expect(reporteSintetico(true).texto).toContain("Se avisaron según tu protocolo ante riesgo.");
    expect(reporteSintetico(false).texto).not.toContain("protocolo ante riesgo.");
  });

  test("sin PII: ni números, ni nombres, ni temas únicos en correo, HTML, resumen ni Excel", () => {
    const r = reporteSintetico();
    const xlsx = construirExcelReporte(r, TZ);
    const todo = [r.asunto, r.texto, r.html, JSON.stringify(r.resumen), textoXlsx(xlsx)].join("\n").toLowerCase();
    for (const leak of PII) expect(todo).not.toContain(leak.toLowerCase());
  });

  test("Excel: zip válido con las hojas del reporte", () => {
    const xlsx = construirExcelReporte(reporteSintetico(), TZ);
    // Firma de zip + las partes OOXML
    expect([xlsx[0], xlsx[1], xlsx[2], xlsx[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = textoXlsx(xlsx);
    for (const part of ["[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet6.xml"]) {
      expect(text).toContain(part);
    }
    for (const hoja of ["Cómo leer este reporte", "Resumen", "Día a día", "Temas", "Alcance", "Cuándo"]) {
      expect(text).toContain(`name="${hoja}"`);
    }
  });

  test("semana sin conversaciones: lo dice en vez de mostrar ceros", () => {
    const vacia = calcularCifras({ mensajes: [], analisis: [], periodo: SEMANA, tz: TZ });
    const r = construirReporte({ programa: "X", semana: SEMANA, actual: vacia, anterior: vacia, protocoloActivo: false, tz: TZ });
    expect(r.texto).toContain("Esta semana no hubo conversaciones reales");
  });
});

// ── Job del reporte ──────────────────────────────────────────────────────
class MemoryWeeklyStore implements WeeklyStore {
  runs = new Map<string, { status: "generated" | "sent" | "failed"; summary: unknown; recipientsCount: number }>();
  recipients: string[] = ["equipo@org.test", "coordinacion@org.test"];
  vacio = false;
  async listWorkspaces() {
    return [{ id: "ws1", slug: "apapachar", name: "Apapáchar" }];
  }
  async leerDatos() {
    return this.vacio ? { mensajes: [], analisis: [] } : datosSinteticos();
  }
  async protocoloActivo() {
    return false;
  }
  async destinatarios() {
    return this.recipients;
  }
  async getRun(workspaceId: string, weekStart: string) {
    return this.runs.get(`${workspaceId}/${weekStart}`) ?? null;
  }
  async saveRun(run: Parameters<WeeklyStore["saveRun"]>[0]) {
    const key = `${run.workspaceId}/${run.weekStart}`;
    if (this.runs.get(key)?.status === "sent") return;
    this.runs.set(key, { status: run.status, summary: run.summary, recipientsCount: run.recipientsCount });
  }
}

const NOW = bog("2026-09-30T10:00:00");
const settings = { now: NOW, tz: TZ, panelUrl: "https://panel.test" };

describe("job del reporte semanal", () => {
  test("con SMTP (mock): manda a los miembros en copia oculta con Excel, y no reenvía", async () => {
    const store = new MemoryWeeklyStore();
    const sent: import("../src/mailer").MailMessage[] = [];
    const mailer = { send: async (m: import("../src/mailer").MailMessage) => void sent.push(m) };

    const first = await runWeeklyReports(settings, { store, mailer });
    expect(first.weekStart).toBe("2026-09-21");
    expect(first.results).toEqual([{ workspaceSlug: "apapachar", outcome: "sent", recipients: 2 }]);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toEqual(store.recipients);
    expect(sent[0]!.text).toContain("https://panel.test/apapachar/operar");
    expect(sent[0]!.attachments?.[0]?.filename).toBe("resumen-semanal-apapachar-2026-09-21.xlsx");

    const payload = [sent[0]!.subject, sent[0]!.text, sent[0]!.html ?? "", textoXlsx(sent[0]!.attachments![0]!.content)]
      .join("\n")
      .toLowerCase();
    for (const leak of PII) expect(payload).not.toContain(leak.toLowerCase());

    const second = await runWeeklyReports(settings, { store, mailer });
    expect(second.results[0]!.outcome).toBe("already_sent");
    expect(sent).toHaveLength(1);
  });

  test("sin SMTP: queda generado para descargar, sin intentar mandar", async () => {
    const store = new MemoryWeeklyStore();
    const r = await runWeeklyReports(settings, { store, mailer: null });
    expect(r.results[0]!.outcome).toBe("generated");
    expect(store.runs.get("ws1/2026-09-21")!.status).toBe("generated");
    expect((await runWeeklyReports(settings, { store, mailer: null })).results[0]!.outcome).toBe("already_generated");
  });

  test("sin miembros con correo o semana vacía: no manda", async () => {
    const sin = new MemoryWeeklyStore();
    sin.recipients = [];
    let calls = 0;
    const mailer = { send: async () => void calls++ };
    expect((await runWeeklyReports(settings, { store: sin, mailer })).results[0]!.outcome).toBe("generated");

    const vacia = new MemoryWeeklyStore();
    vacia.vacio = true;
    expect((await runWeeklyReports(settings, { store: vacia, mailer })).results[0]!.outcome).toBe("empty");
    expect(calls).toBe(0);
  });

  test("SMTP caído: queda como fallido y la próxima corrida reintenta", async () => {
    const store = new MemoryWeeklyStore();
    let fail = true;
    const mailer = {
      send: async () => {
        if (fail) throw new Error("SMTP 421");
      },
    };
    expect((await runWeeklyReports(settings, { store, mailer })).results[0]!.outcome).toBe("failed");
    fail = false;
    expect((await runWeeklyReports(settings, { store, mailer })).results[0]!.outcome).toBe("sent");
  });
});

describe("POST /internal/weekly-report", () => {
  const call = (app: ReturnType<typeof createApp>, auth?: string) =>
    app.handle(
      new Request("http://localhost/internal/weekly-report", {
        method: "POST",
        headers: auth ? { authorization: auth } : {},
      }),
    );

  test("cerrado sin token; 401 con token incorrecto; corre con el correcto", async () => {
    let runs = 0;
    const weeklyReport = async () => {
      runs++;
      return { ok: true };
    };
    expect((await call(createApp({ supervisorToken: "", weeklyReport }), "Bearer x")).status).toBe(503);
    const app = createApp({ supervisorToken: "secreto", weeklyReport });
    expect((await call(app)).status).toBe(401);
    expect((await call(app, "Bearer otro")).status).toBe(401);
    expect(runs).toBe(0);
    const ok = await call(app, "Bearer secreto");
    expect(ok.status).toBe(200);
    expect(runs).toBe(1);
  });
});
