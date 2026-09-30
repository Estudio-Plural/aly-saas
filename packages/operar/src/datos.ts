// Lectura de la DB para las cifras. Solo metadatos: NUNCA se lee el texto de
// los mensajes (columna `message`) ni datos de users_data. El número de la
// persona se lee solo para contar personas distintas y no sale de calcularCifras.
//
// Recibe el cliente postgres.js de cada app (web y engine tienen el suyo).

import type { AnalisisMeta, MensajeMeta, MomentoKey } from "./cifras";
import type { Periodo } from "./tiempo";

/** Conversaciones del chat de prueba del panel: no son conversaciones reales. */
export const WEB_PREVIEW_NUMBER = "web-preview";

// Firma mínima del tagged template de postgres.js (evita depender del paquete).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTag = (strings: TemplateStringsArray, ...values: any[]) => PromiseLike<any>;

export interface DatosCifras {
  mensajes: MensajeMeta[];
  analisis: AnalisisMeta[];
}

export async function leerDatosCifras(sql: SqlTag, workspaceId: string, periodo: Periodo): Promise<DatosCifras> {
  const filas = (await sql`
    WITH convs AS (
      SELECT conversation_id
      FROM users_interactions
      WHERE workspace_id = ${workspaceId} AND client_number <> ${WEB_PREVIEW_NUMBER}
      GROUP BY conversation_id
      HAVING MIN(timestamp) >= ${periodo.desde} AND MIN(timestamp) < ${periodo.hasta}
    )
    SELECT ui.conversation_id, ui.client_number, ui.role, ui.timestamp
    FROM users_interactions ui
    JOIN convs USING (conversation_id)
    WHERE ui.workspace_id = ${workspaceId}
    ORDER BY ui.timestamp ASC
  `) as { conversation_id: string; client_number: string; role: string; timestamp: Date }[];

  const ids = [...new Set(filas.map((f) => f.conversation_id))];
  const analisis = ids.length
    ? ((await sql`
        SELECT conversation_id, analysis->>'momentoAlcanzado' AS momento, keywords, flag_severity
        FROM conversations_data
        WHERE workspace_id = ${workspaceId} AND conversation_id = ANY(${ids})
      `) as { conversation_id: string; momento: string | null; keywords: string[] | null; flag_severity: string | null }[])
    : [];

  return {
    mensajes: filas.map((f) => ({
      conversationId: f.conversation_id,
      personKey: f.client_number,
      role: f.role,
      timestamp: new Date(f.timestamp),
    })),
    analisis: analisis.map((a) => ({
      conversationId: a.conversation_id,
      momento: (a.momento as MomentoKey | null) ?? null,
      keywords: a.keywords ?? [],
      flagSeverity: a.flag_severity,
    })),
  };
}

/** ¿Hubo alguna vez una conversación real (no del chat de prueba)? */
export async function hayConversacionesReales(sql: SqlTag, workspaceId: string): Promise<boolean> {
  const rows = (await sql`
    SELECT 1 FROM users_interactions
    WHERE workspace_id = ${workspaceId} AND client_number <> ${WEB_PREVIEW_NUMBER}
    LIMIT 1
  `) as unknown[];
  return rows.length > 0;
}
