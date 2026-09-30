// «Probar» — banco de casos difíciles (migración 014) — solo servidor.
// Los casos fijos viven en lib/casos.ts; aquí los propios de la organización, la
// última corrida y la corrida en sí (contra el engine, efímera: sin historial y
// sin guardarse como conversación).
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { askEngine } from "@/lib/engine";
import { getDesign } from "@/lib/data/design";
import { listDocuments } from "@/lib/data/documents";
import {
  CASOS_FIJOS,
  MAX_CASOS_PROPIOS,
  chequear,
  estimarCosto,
  resumirCorrida,
  type Caso,
  type Corrida,
  type Estimado,
  type ResultadoCaso,
} from "@/lib/casos";
import { respuestaSimulada } from "@/lib/casos-simulados";

type PropioRow = { id: string; mensaje: string };

export async function listCasosPropios(workspaceId: string): Promise<Caso[]> {
  const rows = await sql<PropioRow[]>`
    SELECT id, mensaje FROM casos_propios WHERE workspace_id = ${workspaceId} ORDER BY creado_en
  `;
  return rows.map((r, i) => ({
    id: r.id,
    titulo: `Caso propio ${i + 1}`,
    mensaje: r.mensaje,
    tipo: "propio",
    fijo: false,
  }));
}

export async function listCasos(workspaceId: string): Promise<Caso[]> {
  return [...CASOS_FIJOS, ...(await listCasosPropios(workspaceId))];
}

export class DemasiadosCasosError extends Error {
  constructor() {
    super(`Puedes tener hasta ${MAX_CASOS_PROPIOS} casos propios.`);
    this.name = "DemasiadosCasosError";
  }
}

export async function addCasoPropio(workspaceId: string, mensaje: string, por: string): Promise<void> {
  const [{ n }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM casos_propios WHERE workspace_id = ${workspaceId}
  `;
  if (n >= MAX_CASOS_PROPIOS) throw new DemasiadosCasosError();
  await sql`
    INSERT INTO casos_propios (workspace_id, mensaje, creado_por) VALUES (${workspaceId}, ${mensaje}, ${por})
  `;
}

/** Borra un caso propio del programa. false si no existe (o es de otro programa). */
export async function deleteCasoPropio(workspaceId: string, id: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const rows = await sql`
    DELETE FROM casos_propios WHERE workspace_id = ${workspaceId} AND id = ${id} RETURNING 1
  `;
  return rows.length > 0;
}

async function preferenciasDeModelo(workspaceId: string): Promise<Record<string, string> | null> {
  const rows = await sql<{ model_preferences: Record<string, string> | null }[]>`
    SELECT model_preferences FROM workspace_configs WHERE workspace_id = ${workspaceId}
  `;
  return rows[0]?.model_preferences ?? null;
}

export async function getEstimado(workspaceId: string, casos: Caso[]): Promise<Estimado> {
  return estimarCosto(casos, await preferenciasDeModelo(workspaceId));
}

type CorridaRow = {
  resultados: ResultadoCaso[];
  seguridad_ok: boolean;
  advertencias: number;
  casos: number;
  modelo: string | null;
  costo_estimado_usd: string | null;
  simulada: boolean;
  corrida_por: string;
  corrida_en: Date;
};

export async function getUltimaCorrida(workspaceId: string): Promise<Corrida | null> {
  const rows = await sql<CorridaRow[]>`
    SELECT resultados, seguridad_ok, advertencias, casos, modelo, costo_estimado_usd, simulada,
           corrida_por, corrida_en
    FROM casos_corridas WHERE workspace_id = ${workspaceId}
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    resultados: r.resultados,
    seguridadOk: r.seguridad_ok,
    advertencias: r.advertencias,
    casos: r.casos,
    modelo: r.modelo,
    costoEstimadoUsd: r.costo_estimado_usd === null ? null : Number(r.costo_estimado_usd),
    simulada: r.simulada,
    corridaPor: r.corrida_por,
    corridaEn: r.corrida_en.toISOString(),
  };
}

/** Respuestas simuladas: solo en desarrollo y con CASOS_RESPUESTAS_SIMULADAS=1 (sin LLM). */
export const usaRespuestasSimuladas = () =>
  process.env.NODE_ENV !== "production" && process.env.CASOS_RESPUESTAS_SIMULADAS === "1";

/**
 * Corre todos los casos contra el engine con la config actual (efímero: sin historial,
 * sin guardar en users_interactions), aplica los chequeos en código y guarda la corrida
 * (pisa la anterior).
 */
export async function correrCasos(
  workspace: { id: string; assistant_name: string },
  por: string,
): Promise<Corrida> {
  const [casos, design, documentos] = await Promise.all([
    listCasos(workspace.id),
    getDesign(workspace.id),
    listDocuments(workspace.id),
  ]);
  const rutas = (design.help_routes ?? []).map((r) => ({ name: r.name ?? "", contact: r.contact ?? "" }));
  const ctx = { rutas, archivos: documentos.map((d) => d.name) };
  const simulada = usaRespuestasSimuladas();
  const estimado = await getEstimado(workspace.id, casos);

  const correrUno = async (caso: Caso): Promise<ResultadoCaso> => {
    const base = { caso: { id: caso.id, titulo: caso.titulo, mensaje: caso.mensaje, tipo: caso.tipo } };
    const res = simulada
      ? respuestaSimulada(caso, design.help_routes ?? [])
      : await askEngine({
          workspaceId: workspace.id,
          conversationId: `casos-${randomUUID()}`,
          userNumber: "casos-dificiles",
          question: caso.mensaje,
          ephemeral: true,
        });
    if (!res) {
      return { ...base, respuesta: null, intent: null, error: "El asistente no respondió.", chequeos: [] };
    }
    return { ...base, respuesta: res.answer, intent: res.intent, error: null, chequeos: chequear(caso, res.answer, ctx) };
  };

  // De a 3 en paralelo: rápido sin saturar el engine.
  const resultados: ResultadoCaso[] = [];
  for (let i = 0; i < casos.length; i += 3) {
    resultados.push(...(await Promise.all(casos.slice(i, i + 3).map(correrUno))));
  }

  const { seguridadOk, advertencias } = resumirCorrida(resultados);
  const corrida: Corrida = {
    resultados,
    seguridadOk,
    advertencias,
    casos: casos.length,
    modelo: estimado.modelo,
    costoEstimadoUsd: simulada ? 0 : estimado.usd,
    simulada,
    corridaPor: por,
    corridaEn: new Date().toISOString(),
  };
  await sql`
    INSERT INTO casos_corridas
      (workspace_id, resultados, seguridad_ok, advertencias, casos, modelo, costo_estimado_usd, simulada, corrida_por, corrida_en)
    VALUES
      (${workspace.id}, ${sql.json(JSON.parse(JSON.stringify(resultados)))}, ${seguridadOk}, ${advertencias},
       ${casos.length}, ${corrida.modelo}, ${corrida.costoEstimadoUsd}, ${simulada}, ${por}, ${corrida.corridaEn})
    ON CONFLICT (workspace_id) DO UPDATE SET
      resultados = EXCLUDED.resultados, seguridad_ok = EXCLUDED.seguridad_ok,
      advertencias = EXCLUDED.advertencias, casos = EXCLUDED.casos, modelo = EXCLUDED.modelo,
      costo_estimado_usd = EXCLUDED.costo_estimado_usd, simulada = EXCLUDED.simulada,
      corrida_por = EXCLUDED.corrida_por, corrida_en = EXCLUDED.corrida_en
  `;
  return corrida;
}
