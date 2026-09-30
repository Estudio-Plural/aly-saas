// ── Canal WhatsApp: el webhook de Meta, de punta a punta ───────────────────
//
// Porta las invariantes de Aly (`router/webhook/atender.ts`, `post.ts`) y de
// Tranqui (`router/webhook/post.ts`), en producción las dos:
//
//  1. Firma HMAC sobre los bytes crudos, contra TODOS los app secrets.
//  2. Reparto por `phone_number_id` → workspace (tabla whatsapp_connections).
//     Un número sin conexión se ignora: una WABA compartida entrega mensajes de
//     otros bots, y contestarlos sería hablar con la voz equivocada.
//  3. Fila por persona: los turnos de una persona van de a uno y en orden;
//     personas distintas en paralelo. Todo el lote se encola ANTES de esperar
//     nada (Tranqui: si no, un mensaje de otra request se cuela entre dos del
//     lote, o un reintento "roba" el segundo).
//  4. Idempotencia por wamid (wa_processed_messages). Si el turno falla ANTES
//     de generar la respuesta, se libera el wamid para que el reintento de Meta
//     lo atienda. Si falla DESPUÉS (Graph caído), la respuesta queda guardada y
//     el reintento la REENVÍA sin regenerar: en el peor caso llega repetida,
//     nunca distinta (Tranqui, 2026-09-28: un "Si" produjo seis respuestas
//     distintas cuando Graph se colgó).
//  5. Timeouts en todo: base (store.ts), Graph (15 s), pipeline.
//  6. Un fallo de la base en la contabilidad (marcas de actividad, cierre,
//     perfil) NO cambia la respuesta a Meta. La única lectura que sí la cambia
//     es la sesión: sin saber si la persona aceptó el aviso no se le puede
//     contestar sin violar el gate, así que se pide reintento.
//  7. != 200 solo cuando hay algo que Meta pueda arreglar reintentando: envío
//     fallido, pipeline caído, sesión ilegible, token faltante.
//
// La fila es en memoria: el engine corre en UN proceso (systemd `aly-engine`).
// Con más de una réplica hace falta un candado en la base.

import type { QuestionInput } from "../engine/pipeline";
import {
  aFormatoWhatsApp,
  partirTexto,
  type EnviarTexto,
} from "./meta-cloud-api";
import {
  collectMessages,
  firmaValida,
  phoneNumberIdsDelPayload,
  type IncomingMessage,
} from "./meta-webhook";
import { nuevoConversationId, sesionSigueViva, siguientePaso } from "./onboarding";
import { conTimeout, type CanalStore, type Conexion, type Reserva } from "./store";
import { resolverTextos } from "./textos";

export type Procesar = (input: QuestionInput) => Promise<{ answer: string }>;

export interface CanalDeps {
  store: CanalStore;
  procesar: Procesar;
  enviar: EnviarTexto;
  appSecrets: () => string[];
  verifyToken: () => string;
  leerEnv: (nombre: string) => string | undefined;
  ahora?: () => Date;
  pipelineTimeoutMs?: number;
  /** TTL de la memoria de wamids atendidos / pendientes (fallback sin base). */
  memoriaTtlMs?: number;
}

export type RespuestaHttp = { status: number; body: string };

/** Solo variables `META_TOKEN_*`: desde el panel no se puede apuntar a otra. */
export const TOKEN_ENV_RE = /^META_TOKEN_[A-Z0-9_]{1,64}$/;

export function crearCanal(deps: CanalDeps) {
  const ahora = deps.ahora ?? (() => new Date());
  const pipelineTimeoutMs = deps.pipelineTimeoutMs ?? 60_000;
  const memoriaTtlMs = deps.memoriaTtlMs ?? 30 * 60_000;
  const { store } = deps;

  // ── Estado en memoria ─────────────────────────────────────────────────────
  const colas = new Map<string, Promise<unknown>>();
  /** wamids que se están atendiendo ahora (incluye los que esperan en la fila). */
  const enCurso = new Set<string>();
  /** Fallback cuando la base no pudo reservar: evita duplicar en este proceso. */
  const atendidosMem = new Map<string, number>();
  const pendientesMem = new Map<string, { salidas: string[]; enviadas: number; t: number }>();
  /** Última foto buena de las conexiones: si la base cae, se sigue ruteando. */
  const cacheConexiones = new Map<string, Conexion>();

  function purgar() {
    const limite = Date.now() - memoriaTtlMs;
    for (const [k, t] of atendidosMem) if (t < limite) atendidosMem.delete(k);
    for (const [k, p] of pendientesMem) if (p.t < limite) pendientesMem.delete(k);
  }

  function enFila<T>(clave: string, tarea: () => Promise<T>): Promise<T> {
    const previa = colas.get(clave) ?? Promise.resolve();
    // Un fallo del turno anterior no traba la cola.
    const actual = previa.catch(() => {}).then(tarea);
    const cola = actual.catch(() => {});
    colas.set(clave, cola);
    void cola.finally(() => {
      if (colas.get(clave) === cola) colas.delete(clave);
    });
    return actual;
  }

  /** Contabilidad: se intenta, se loguea si falla, y nunca cambia el resultado. */
  async function seguro<T>(p: () => Promise<T>, que: string): Promise<T | undefined> {
    try {
      return await p();
    } catch (e: any) {
      console.error(`⚠️ [wa] ${que} falló (no cambia la respuesta a Meta): ${e?.message ?? e}`);
      return undefined;
    }
  }

  function tokenDe(c: Conexion): string | undefined {
    if (!c.tokenEnv || !TOKEN_ENV_RE.test(c.tokenEnv)) return undefined;
    return deps.leerEnv(c.tokenEnv) || undefined;
  }

  // ── GET: verificación del webhook ─────────────────────────────────────────
  async function verificar(query: Record<string, string | undefined>): Promise<RespuestaHttp> {
    const esperado = deps.verifyToken();
    if (query["hub.mode"] === "subscribe" && esperado && query["hub.verify_token"] === esperado) {
      await seguro(() => store.marcarWebhook("verificado"), "marcar verificación");
      console.log("✅ [wa] WEBHOOK_VERIFIED");
      return { status: 200, body: query["hub.challenge"] ?? "" };
    }
    console.warn("🛑 [wa] Verificación de webhook fallida: token o modo inválido");
    return { status: 403, body: "Forbidden" };
  }

  // ── POST: mensajes ────────────────────────────────────────────────────────
  async function recibir(raw: string, firma: string | null | undefined): Promise<RespuestaHttp> {
    if (!firmaValida(raw, firma, deps.appSecrets())) {
      void seguro(() => store.marcarWebhook("firma_invalida"), "marcar firma inválida");
      console.warn("🛑 [wa] Firma de Meta inválida — descartado");
      return { status: 401, body: "invalid signature" };
    }

    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return { status: 400, body: "bad json" };
    }
    void seguro(() => store.marcarWebhook("post"), "marcar post");
    purgar();

    const pnids = phoneNumberIdsDelPayload(payload);
    if (pnids.length === 0) return { status: 200, body: "ok" };

    let todoOk = true;
    const porPnid = new Map<string, Conexion>();
    try {
      for (const c of await store.conexionesPorPnid(pnids)) {
        porPnid.set(c.phoneNumberId, c);
        cacheConexiones.set(c.phoneNumberId, c);
      }
    } catch (e: any) {
      console.error(`❌ [wa] No se pudieron leer las conexiones: ${e?.message ?? e} — se usa la última foto`);
      for (const p of pnids) {
        const c = cacheConexiones.get(p);
        if (c) porPnid.set(p, c);
        // Sin foto no sabemos de quién es: reintento (si trae mensajes).
        else if (payloadTieneMensajesPara(payload, p)) todoOk = false;
      }
    }

    const activos = [...porPnid.values()].filter((c) => c.enabled).map((c) => c.phoneNumberId);
    const { mensajes, ambiguos, ajenos } = collectMessages(payload, activos);
    for (const a of ambiguos) {
      // Falla cerrado: no se adivina destinatario.
      console.error(`🛑 [wa] Mensaje sin identidad clara (${a.reason}) wamid=${a.wamid} — retenido`);
    }
    if (ajenos > 0) console.log(`ℹ️ [wa] ${ajenos} mensaje(s) para números sin conexión activa — ignorados`);

    const turnos: Promise<boolean>[] = [];
    for (const m of mensajes) {
      const c = porPnid.get(m.phoneNumberId)!;
      if (atendidosMem.has(m.wamid)) continue;
      if (enCurso.has(m.wamid)) {
        // Reintento de Meta mientras el original sigue corriendo: que vuelva luego.
        todoOk = false;
        continue;
      }
      enCurso.add(m.wamid);
      turnos.push(
        enFila(`${c.workspaceId}:${m.identidad}`, () => atenderUno(m, c))
          .catch((e) => {
            console.error("❌ [wa] Turno falló con excepción:", e);
            return false;
          })
          .finally(() => enCurso.delete(m.wamid)),
      );
    }
    for (const ok of await Promise.all(turnos)) if (!ok) todoOk = false;

    return todoOk ? { status: 200, body: "ok" } : { status: 500, body: "retry" };
  }

  // ── Un turno ──────────────────────────────────────────────────────────────
  async function atenderUno(m: IncomingMessage, c: Conexion): Promise<boolean> {
    const token = tokenDe(c);
    if (!token) {
      const msg = `Falta el token: la variable ${c.tokenEnv ?? "(sin nombre)"} no está en el entorno del engine`;
      console.error(`❌ [wa] ${msg} (workspace ${c.workspaceId})`);
      await seguro(() => store.marcarError(c.workspaceId, msg), "marcar error");
      return false; // Meta reintenta: si se carga el token, se recupera.
    }

    let reserva: Reserva;
    try {
      reserva = await store.reservar(m.wamid, c.workspaceId);
    } catch {
      reserva = { tipo: "sin_reserva" };
    }
    if (reserva.tipo === "duplicado") {
      console.log(`↩️ [wa] ${m.wamid} ya atendido — no se contesta de nuevo`);
      return true;
    }
    if (reserva.tipo === "en_curso") return false;
    const propia = reserva.tipo !== "sin_reserva";

    let p: { salidas: string[]; enviadas: number };
    if (reserva.tipo === "reanudar") {
      console.log(`↩️ [wa] Reintento: se reenvía lo ya generado (${reserva.salidas.length - reserva.enviadas} mensaje/s)`);
      p = { salidas: reserva.salidas, enviadas: reserva.enviadas };
    } else if (pendientesMem.has(m.wamid)) {
      // La base no alcanzó a guardar lo generado, pero este proceso lo recuerda.
      p = pendientesMem.get(m.wamid)!;
    } else {
      await seguro(() => store.marcarRecibido(c.workspaceId), "marcar recibido");
      try {
        p = { salidas: await generar(m, c), enviadas: 0 };
      } catch (e: any) {
        console.error(`❌ [wa] No se pudo generar la respuesta: ${e?.message ?? e}`);
        await seguro(() => store.marcarError(c.workspaceId, `Turno fallido: ${e?.message ?? e}`), "marcar error");
        if (propia) await seguro(() => store.liberar(m.wamid), "liberar wamid");
        return false;
      }
      pendientesMem.set(m.wamid, { ...p, t: Date.now() });
      if (propia) await seguro(() => store.guardarPendiente(m.wamid, p.salidas, 0), "guardar pendiente");
    }

    // ── Entregar lo que falte ───────────────────────────────────────────────
    while (p.enviadas < p.salidas.length) {
      const r = await deps.enviar({
        phoneNumberId: m.phoneNumberId,
        token,
        recipient: m.recipient,
        isBsuid: m.isBsuid,
        text: p.salidas[p.enviadas]!,
      });
      if (!r.ok) {
        console.error(`❌ [wa] Envío falló (${r.code ?? "-"}): ${r.error}`);
        pendientesMem.set(m.wamid, { ...p, t: Date.now() });
        await seguro(() => store.marcarError(c.workspaceId, `Envío a Meta falló: ${r.error}`), "marcar error");
        if (propia) await seguro(() => store.guardarPendiente(m.wamid, p.salidas, p.enviadas), "guardar pendiente");
        return false;
      }
      p.enviadas++;
    }

    pendientesMem.delete(m.wamid);
    atendidosMem.set(m.wamid, Date.now());
    if (propia) await seguro(() => store.marcarHecho(m.wamid), "marcar hecho");
    if (p.salidas.length > 0) await seguro(() => store.marcarRespondido(c.workspaceId), "marcar respondido");
    return true;
  }

  /** Decide qué contestar y aplica los efectos del onboarding. Lanza si hay que reintentar. */
  async function generar(m: IncomingMessage, c: Conexion): Promise<string[]> {
    const fila = await seguro(() => store.filaConfig(c.workspaceId), "leer textos del workspace");
    const textos = resolverTextos(fila ?? null, c.asistente, c.organizacion);

    // Solo texto: audio, imagen, documento, sticker → aviso fijo, sin tocar la sesión.
    if (m.type !== "text" || !m.text.trim()) return [textos.soloTexto];

    const senderKind = m.isBsuid ? "bsuid" : "phone";
    // Esta lectura SÍ falla el turno (ver cabecera, punto 6).
    const sesion = await store.leerSesion(c.workspaceId, m.identidad);
    const t = ahora();
    const esNueva = !sesion.existe || !sesionSigueViva(sesion.lastAt, t);
    const conversationId =
      !esNueva && sesion.conversationId ? sesion.conversationId : nuevoConversationId(m.identidad, t);

    const paso = siguientePaso({
      estado: sesion.estado,
      aceptado: sesion.aceptado,
      esNueva,
      mensaje: m.text,
      textos,
    });

    const guardar = (estado: string, aceptar: boolean, lastAt = t) =>
      seguro(
        () =>
          store.guardarSesion({
            workspaceId: c.workspaceId,
            identidad: m.identidad,
            senderKind,
            conversationId,
            estado,
            aceptar,
            lastAt,
          }),
        "guardar sesión",
      );

    switch (paso.accion.tipo) {
      case "rechazar":
        // No queda NADA: ni sesión, ni perfil, ni turnos.
        await seguro(() => store.borrarPersona(c.workspaceId, m.identidad), "borrar persona");
        break;
      case "aceptar":
        await guardar(paso.estado, true);
        await seguro(() => store.registrarAceptacion(c.workspaceId, m.identidad, senderKind), "registrar aceptación");
        break;
      case "perfil": {
        const { id, valor } = paso.accion;
        await seguro(() => store.guardarPerfil(c.workspaceId, m.identidad, id, valor), "guardar perfil");
        await guardar(paso.estado, false);
        break;
      }
      case "cerrar_sesion":
        // Cerrar es fecharla fuera de la ventana: el próximo mensaje abre otra.
        await guardar(paso.estado, false, new Date(0));
        await seguro(() => store.cerrarConversacion(c.workspaceId, conversationId), "cerrar conversación");
        break;
      default:
        await guardar(paso.estado, false);
    }

    const salidas = [...paso.responder];
    if (paso.alPipeline) {
      // El pipeline guarda el par user+assistant en users_interactions (donde
      // el engine lee el historial). Solo se llega acá con consentimiento.
      const r = await conTimeout(
        deps.procesar({
          question: m.text,
          userNumber: m.identidad,
          conversationId,
          workspaceId: c.workspaceId,
          language: "es",
        }),
        pipelineTimeoutMs,
        "pipeline",
      );
      const texto = aFormatoWhatsApp(r.answer ?? "");
      salidas.push(...(texto ? partirTexto(texto) : [textos.errorTecnico]));
    }
    return salidas;
  }

  /** Estado del entorno para el panel (sin exponer secretos). */
  async function estadoEntorno(workspaceId: string) {
    const conexion = await seguro(() => store.conexionDeWorkspace(workspaceId), "leer conexión");
    const tokenEnv = conexion?.tokenEnv ?? null;
    const tokenValido = !!tokenEnv && TOKEN_ENV_RE.test(tokenEnv);
    return {
      tokenEnv,
      tokenCargado: tokenValido ? !!deps.leerEnv(tokenEnv!) : false,
      firmaConfigurada: deps.appSecrets().length > 0,
      verifyTokenConfigurado: !!deps.verifyToken(),
    };
  }

  return {
    verificar,
    recibir,
    estadoEntorno,
    /** Solo para tests. */
    _estado: () => ({ colas: colas.size, enCurso: enCurso.size, pendientes: pendientesMem.size }),
  };
}

function payloadTieneMensajesPara(payload: any, pnid: string): boolean {
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.value?.metadata?.phone_number_id === pnid && (change?.value?.messages ?? []).length > 0) {
        return true;
      }
    }
  }
  return false;
}

export type Canal = ReturnType<typeof crearCanal>;
