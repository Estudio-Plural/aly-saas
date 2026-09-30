// ── Persistencia del canal ─────────────────────────────────────────────────
//
// Interfaz + implementación Postgres. El orquestador (canal.ts) solo conoce la
// interfaz, así los tests corren con una versión en memoria y sin base.
//
// Cada query lleva timeout: una base colgada no puede colgar el webhook (Meta
// da el POST por fallido y reintenta, y el turno original sigue vivo).

import type { Sql } from "../db";

export type SenderKind = "phone" | "bsuid";

export type Conexion = {
  workspaceId: string;
  phoneNumberId: string;
  tokenEnv: string | null;
  enabled: boolean;
  asistente: string;
  organizacion: string;
};

export type Sesion = {
  existe: boolean;
  conversationId: string;
  estado: string;
  aceptado: boolean;
  lastAt: Date | null;
};

/**
 * Resultado de reservar un wamid:
 *  - nuevo: este intento es el dueño; hay que generar la respuesta.
 *  - reanudar: un intento anterior ya generó la respuesta y no terminó de
 *    enviarla → se reenvía lo que falta, SIN regenerar.
 *  - duplicado: ya entregado.
 *  - en_curso: otro intento lo está atendiendo ahora mismo.
 *  - sin_reserva: la base falló; se atiende igual (fail open).
 */
export type Reserva =
  | { tipo: "nuevo" }
  | { tipo: "reanudar"; salidas: string[]; enviadas: number }
  | { tipo: "duplicado" }
  | { tipo: "en_curso" }
  | { tipo: "sin_reserva" };

export interface CanalStore {
  conexionesPorPnid(pnids: string[]): Promise<Conexion[]>;
  conexionDeWorkspace(workspaceId: string): Promise<{ phoneNumberId: string | null; tokenEnv: string | null } | null>;
  filaConfig(workspaceId: string): Promise<Record<string, unknown> | null>;
  leerSesion(workspaceId: string, identidad: string): Promise<Omit<Sesion, "conversationId"> & { conversationId: string | null }>;
  guardarSesion(s: {
    workspaceId: string;
    identidad: string;
    senderKind: SenderKind;
    conversationId: string;
    estado: string;
    aceptar: boolean;
    lastAt: Date;
  }): Promise<void>;
  /** Rechazo: no queda rastro de la persona. */
  borrarPersona(workspaceId: string, identidad: string): Promise<void>;
  registrarAceptacion(workspaceId: string, identidad: string, senderKind: SenderKind): Promise<void>;
  guardarPerfil(workspaceId: string, identidad: string, id: string, valor: string): Promise<void>;
  cerrarConversacion(workspaceId: string, conversationId: string): Promise<void>;
  reservar(wamid: string, workspaceId: string): Promise<Reserva>;
  guardarPendiente(wamid: string, salidas: string[], enviadas: number): Promise<void>;
  marcarHecho(wamid: string): Promise<void>;
  liberar(wamid: string): Promise<void>;
  marcarRecibido(workspaceId: string): Promise<void>;
  marcarRespondido(workspaceId: string): Promise<void>;
  marcarError(workspaceId: string, error: string): Promise<void>;
  marcarWebhook(evento: "verificado" | "post" | "firma_invalida"): Promise<void>;
}

/** Un intento `en_curso` más viejo que esto se da por muerto y se retoma. */
export const EN_CURSO_ABANDONADO_MIN = 5;

export function conTimeout<T>(p: Promise<T>, ms: number, que: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<never>((_, rej) => {
      t = setTimeout(() => rej(new Error(`timeout (${ms} ms) en ${que}`)), ms);
    }),
  ]).finally(() => clearTimeout(t));
}

export function crearStorePostgres(sql: Sql, dbTimeoutMs = 5_000): CanalStore {
  const q = <T>(p: Promise<T>, que: string) => conTimeout(p, dbTimeoutMs, que);

  return {
    async conexionesPorPnid(pnids) {
      if (pnids.length === 0) return [];
      const rows = await q(
        sql<
          {
            workspace_id: string;
            phone_number_id: string;
            token_env: string | null;
            enabled: boolean;
            assistant_name: string;
            name: string;
          }[]
        >`
          SELECT c.workspace_id, c.phone_number_id, c.token_env, c.enabled, w.assistant_name, w.name
          FROM whatsapp_connections c JOIN workspaces w ON w.id = c.workspace_id
          WHERE c.phone_number_id IN ${sql(pnids)}
        `,
        "conexionesPorPnid",
      );
      return rows.map((r) => ({
        workspaceId: r.workspace_id,
        phoneNumberId: r.phone_number_id,
        tokenEnv: r.token_env,
        enabled: r.enabled,
        asistente: r.assistant_name,
        organizacion: r.name,
      }));
    },

    async conexionDeWorkspace(workspaceId) {
      const rows = await q(
        sql<{ phone_number_id: string | null; token_env: string | null }[]>`
          SELECT phone_number_id, token_env FROM whatsapp_connections WHERE workspace_id = ${workspaceId}
        `,
        "conexionDeWorkspace",
      );
      const r = rows[0];
      return r ? { phoneNumberId: r.phone_number_id, tokenEnv: r.token_env } : null;
    },

    async filaConfig(workspaceId) {
      // to_jsonb(wc): trae TODAS las columnas que existan, así una columna que
      // la 012 todavía no creó simplemente no está (sin error de SQL).
      const rows = await q(
        sql<{ fila: Record<string, unknown> }[]>`
          SELECT to_jsonb(wc) AS fila FROM workspace_configs wc WHERE wc.workspace_id = ${workspaceId}
        `,
        "filaConfig",
      );
      return rows[0]?.fila ?? null;
    },

    async leerSesion(workspaceId, identidad) {
      const rows = await q(
        sql<{ conversation_id: string; onboarding_state: string; consent: string; last_at: Date }[]>`
          SELECT conversation_id, onboarding_state, consent, last_at
          FROM wa_sessions WHERE workspace_id = ${workspaceId} AND identidad = ${identidad}
        `,
        "leerSesion",
      );
      const r = rows[0];
      if (!r) return { existe: false, conversationId: null, estado: "nuevo", aceptado: false, lastAt: null };
      return {
        existe: true,
        conversationId: r.conversation_id,
        estado: r.onboarding_state,
        aceptado: r.consent === "aceptado",
        lastAt: r.last_at,
      };
    },

    async guardarSesion(s) {
      await q(
        sql`
          INSERT INTO wa_sessions
            (workspace_id, identidad, sender_kind, conversation_id, onboarding_state, consent, consent_at, last_at)
          VALUES
            (${s.workspaceId}, ${s.identidad}, ${s.senderKind}, ${s.conversationId}, ${s.estado},
             ${s.aceptar ? "aceptado" : "pendiente"}, ${s.aceptar ? new Date() : null}, ${s.lastAt})
          ON CONFLICT (workspace_id, identidad) DO UPDATE SET
            sender_kind = EXCLUDED.sender_kind,
            conversation_id = EXCLUDED.conversation_id,
            onboarding_state = EXCLUDED.onboarding_state,
            -- El consentimiento solo sube: una vez aceptado, no vuelve a pendiente.
            consent = CASE WHEN EXCLUDED.consent = 'aceptado' THEN 'aceptado' ELSE wa_sessions.consent END,
            consent_at = COALESCE(wa_sessions.consent_at, EXCLUDED.consent_at),
            last_at = EXCLUDED.last_at,
            updated_at = NOW()
        `,
        "guardarSesion",
      );
    },

    async borrarPersona(workspaceId, identidad) {
      // Solo se llega acá SIN consentimiento: no hay perfil ni turnos (nada se
      // guarda antes de aceptar), así que basta con la fila de sesión. El
      // filtro por `pendiente` impide que un bug borre a alguien que aceptó.
      await q(
        sql`DELETE FROM wa_sessions WHERE workspace_id = ${workspaceId} AND identidad = ${identidad} AND consent = 'pendiente'`,
        "borrarPersona",
      );
    },

    async registrarAceptacion(workspaceId, identidad, senderKind) {
      await q(
        sql`
          INSERT INTO users_data (workspace_id, number, whatsapp_id, sender_kind)
          VALUES (${workspaceId}, ${identidad}, ${identidad}, ${senderKind})
          ON CONFLICT (workspace_id, number) DO UPDATE SET
            whatsapp_id = EXCLUDED.whatsapp_id, sender_kind = EXCLUDED.sender_kind, updated_at = NOW()
        `,
        "registrarAceptacion",
      );
    },

    async guardarPerfil(workspaceId, identidad, id, valor) {
      await q(
        sql`
          UPDATE users_data SET profile = profile || ${sql.json({ [id]: valor })}, updated_at = NOW()
          WHERE workspace_id = ${workspaceId} AND number = ${identidad}
        `,
        "guardarPerfil",
      );
    },

    async cerrarConversacion(workspaceId, conversationId) {
      await q(
        sql`UPDATE users_interactions SET status = 'closed' WHERE workspace_id = ${workspaceId} AND conversation_id = ${conversationId}`,
        "cerrarConversacion",
      );
    },

    async reservar(wamid, workspaceId) {
      if (!wamid) return { tipo: "sin_reserva" };
      try {
        // Insert con clave primaria (no select-then-insert: los reintentos de
        // Meta llegan en paralelo). En conflicto solo se "retoma" una fila
        // pendiente de envío o un en_curso abandonado.
        const rows = await q(
          sql<{ insertado: boolean; salidas: string[] | null; enviadas: number }[]>`
            INSERT INTO wa_processed_messages (wamid, workspace_id, estado)
            VALUES (${wamid}, ${workspaceId}, 'en_curso')
            ON CONFLICT (wamid) DO UPDATE SET estado = 'en_curso', updated_at = NOW()
              WHERE wa_processed_messages.estado = 'pendiente_envio'
                 OR (wa_processed_messages.estado = 'en_curso'
                     AND wa_processed_messages.updated_at < NOW() - make_interval(mins => ${EN_CURSO_ABANDONADO_MIN}))
            RETURNING (xmax = 0) AS insertado, salidas, enviadas
          `,
          "reservar",
        );
        const r = rows[0];
        if (r) {
          if (r.insertado || !r.salidas || r.salidas.length === 0) return { tipo: "nuevo" };
          return { tipo: "reanudar", salidas: r.salidas, enviadas: r.enviadas };
        }
        const [actual] = await q(
          sql<{ estado: string }[]>`SELECT estado FROM wa_processed_messages WHERE wamid = ${wamid}`,
          "reservar/estado",
        );
        return actual?.estado === "en_curso" ? { tipo: "en_curso" } : { tipo: "duplicado" };
      } catch (e: any) {
        console.error(`❌ [wa] No se pudo reservar ${wamid}: ${e?.message ?? e} — se atiende igual`);
        return { tipo: "sin_reserva" };
      }
    },

    async guardarPendiente(wamid, salidas, enviadas) {
      await q(
        sql`
          UPDATE wa_processed_messages
          SET estado = 'pendiente_envio', salidas = ${sql.json(salidas)}, enviadas = ${enviadas}, updated_at = NOW()
          WHERE wamid = ${wamid}
        `,
        "guardarPendiente",
      );
    },

    async marcarHecho(wamid) {
      await q(
        sql`UPDATE wa_processed_messages SET estado = 'hecho', salidas = NULL, updated_at = NOW() WHERE wamid = ${wamid}`,
        "marcarHecho",
      );
    },

    async liberar(wamid) {
      await q(sql`DELETE FROM wa_processed_messages WHERE wamid = ${wamid}`, "liberar");
    },

    async marcarRecibido(workspaceId) {
      await q(
        sql`UPDATE whatsapp_connections SET last_inbound_at = NOW(), updated_at = NOW() WHERE workspace_id = ${workspaceId}`,
        "marcarRecibido",
      );
    },

    async marcarRespondido(workspaceId) {
      await q(
        sql`UPDATE whatsapp_connections SET last_reply_at = NOW(), last_error = NULL, updated_at = NOW() WHERE workspace_id = ${workspaceId}`,
        "marcarRespondido",
      );
    },

    async marcarError(workspaceId, error) {
      await q(
        sql`UPDATE whatsapp_connections SET last_error = ${error.slice(0, 500)}, last_error_at = NOW() WHERE workspace_id = ${workspaceId}`,
        "marcarError",
      );
    },

    async marcarWebhook(evento) {
      const col =
        evento === "verificado" ? "last_verified_at" : evento === "post" ? "last_post_at" : "last_bad_signature_at";
      await q(
        sql`
          INSERT INTO wa_webhook_state (id, ${sql(col)}) VALUES (1, NOW())
          ON CONFLICT (id) DO UPDATE SET ${sql(col)} = NOW()
        `,
        "marcarWebhook",
      );
    },
  };
}
