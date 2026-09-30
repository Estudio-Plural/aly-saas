// Dobles de prueba del canal WhatsApp: store en memoria con la MISMA semántica
// de reserva que la de Postgres, un Graph falso y payloads de Meta.

import { createHmac } from "crypto";
import { crearCanal, type CanalDeps, type Procesar } from "../src/whatsapp/canal";
import type { EnviarTexto, SendResult } from "../src/whatsapp/meta-cloud-api";
import type { CanalStore, Conexion, Reserva, SenderKind } from "../src/whatsapp/store";

export const SECRETO = "secreto-de-prueba";

export function firmar(raw: string, secreto = SECRETO): string {
  return "sha256=" + createHmac("sha256", secreto).update(raw, "utf8").digest("hex");
}

type FilaSesion = {
  conversationId: string;
  estado: string;
  aceptado: boolean;
  lastAt: Date;
  senderKind: SenderKind;
};

export class StoreMemoria implements CanalStore {
  conexiones: Conexion[] = [];
  configs = new Map<string, Record<string, unknown>>();
  sesiones = new Map<string, FilaSesion>();
  usuarios = new Map<string, { senderKind: SenderKind; profile: Record<string, string> }>();
  mensajes = new Map<string, { estado: string; salidas: string[] | null; enviadas: number }>();
  cerradas: string[] = [];
  marcas: string[] = [];
  /** Nombres de métodos que deben lanzar (simula base caída). */
  fallar = new Set<string>();

  private check(que: string) {
    if (this.fallar.has(que) || this.fallar.has("*")) throw new Error(`base caída (${que})`);
  }
  private k(ws: string, id: string) {
    return `${ws}:${id}`;
  }

  async conexionesPorPnid(pnids: string[]) {
    this.check("conexionesPorPnid");
    return this.conexiones.filter((c) => pnids.includes(c.phoneNumberId));
  }
  async conexionDeWorkspace(ws: string) {
    this.check("conexionDeWorkspace");
    const c = this.conexiones.find((x) => x.workspaceId === ws);
    return c ? { phoneNumberId: c.phoneNumberId, tokenEnv: c.tokenEnv } : null;
  }
  async filaConfig(ws: string) {
    this.check("filaConfig");
    return this.configs.get(ws) ?? null;
  }
  async leerSesion(ws: string, id: string) {
    this.check("leerSesion");
    const s = this.sesiones.get(this.k(ws, id));
    if (!s) return { existe: false, conversationId: null, estado: "nuevo", aceptado: false, lastAt: null };
    return { existe: true, conversationId: s.conversationId, estado: s.estado, aceptado: s.aceptado, lastAt: s.lastAt };
  }
  async guardarSesion(s: Parameters<CanalStore["guardarSesion"]>[0]) {
    this.check("guardarSesion");
    const previa = this.sesiones.get(this.k(s.workspaceId, s.identidad));
    this.sesiones.set(this.k(s.workspaceId, s.identidad), {
      conversationId: s.conversationId,
      estado: s.estado,
      aceptado: s.aceptar || !!previa?.aceptado,
      lastAt: s.lastAt,
      senderKind: s.senderKind,
    });
  }
  async borrarPersona(ws: string, id: string) {
    this.check("borrarPersona");
    const s = this.sesiones.get(this.k(ws, id));
    if (s && !s.aceptado) this.sesiones.delete(this.k(ws, id));
  }
  async registrarAceptacion(ws: string, id: string, senderKind: SenderKind) {
    this.check("registrarAceptacion");
    const u = this.usuarios.get(this.k(ws, id));
    this.usuarios.set(this.k(ws, id), { senderKind, profile: u?.profile ?? {} });
  }
  async guardarPerfil(ws: string, id: string, clave: string, valor: string) {
    this.check("guardarPerfil");
    const u = this.usuarios.get(this.k(ws, id));
    if (u) u.profile[clave] = valor;
  }
  async cerrarConversacion(_ws: string, conv: string) {
    this.check("cerrarConversacion");
    this.cerradas.push(conv);
  }
  async reservar(wamid: string, _ws: string): Promise<Reserva> {
    if (this.fallar.has("reservar") || this.fallar.has("*")) return { tipo: "sin_reserva" };
    const m = this.mensajes.get(wamid);
    if (!m) {
      this.mensajes.set(wamid, { estado: "en_curso", salidas: null, enviadas: 0 });
      return { tipo: "nuevo" };
    }
    if (m.estado === "pendiente_envio") {
      m.estado = "en_curso";
      return m.salidas?.length ? { tipo: "reanudar", salidas: m.salidas, enviadas: m.enviadas } : { tipo: "nuevo" };
    }
    return m.estado === "en_curso" ? { tipo: "en_curso" } : { tipo: "duplicado" };
  }
  async guardarPendiente(wamid: string, salidas: string[], enviadas: number) {
    this.check("guardarPendiente");
    this.mensajes.set(wamid, { estado: "pendiente_envio", salidas: [...salidas], enviadas });
  }
  async marcarHecho(wamid: string) {
    this.check("marcarHecho");
    this.mensajes.set(wamid, { estado: "hecho", salidas: null, enviadas: 0 });
  }
  async liberar(wamid: string) {
    this.check("liberar");
    this.mensajes.delete(wamid);
  }
  async marcarRecibido(ws: string) {
    this.check("marcarRecibido");
    this.marcas.push(`recibido:${ws}`);
  }
  async marcarRespondido(ws: string) {
    this.check("marcarRespondido");
    this.marcas.push(`respondido:${ws}`);
  }
  async marcarError(ws: string, e: string) {
    this.check("marcarError");
    this.marcas.push(`error:${ws}:${e}`);
  }
  async marcarWebhook(evento: string) {
    this.check("marcarWebhook");
    this.marcas.push(`webhook:${evento}`);
  }
}

export type Envio = { phoneNumberId: string; token: string; recipient: string; isBsuid: boolean; text: string };

/** Graph falso: registra envíos; `fallarEn` = índices (0-based, globales) que fallan. */
export function graphFalso() {
  const envios: Envio[] = [];
  let intento = 0;
  const fallarEn = new Set<number>();
  const enviar: EnviarTexto = async (o) => {
    const i = intento++;
    if (fallarEn.has(i)) return { ok: false, error: "Graph caído" } as SendResult;
    envios.push({ phoneNumberId: o.phoneNumberId, token: o.token, recipient: o.recipient, isBsuid: o.isBsuid, text: o.text });
    return { ok: true, wamid: `wamid.out.${i}` };
  };
  return { enviar, envios, fallarEn, textos: () => envios.map((e) => e.text) };
}

export function montar(opts: {
  store?: StoreMemoria;
  procesar?: Procesar;
  graph?: ReturnType<typeof graphFalso>;
  env?: Record<string, string>;
  ahora?: () => Date;
  extra?: Partial<CanalDeps>;
} = {}) {
  const store = opts.store ?? new StoreMemoria();
  const graph = opts.graph ?? graphFalso();
  const llamadas: Parameters<Procesar>[0][] = [];
  const procesar: Procesar =
    opts.procesar ??
    (async (input) => {
      llamadas.push(input);
      return { answer: `respuesta a: ${input.question}` };
    });
  const env: Record<string, string> = { META_TOKEN_A: "token-a", META_TOKEN_B: "token-b", ...(opts.env ?? {}) };
  const canal = crearCanal({
    store,
    procesar,
    enviar: graph.enviar,
    appSecrets: () => [SECRETO],
    verifyToken: () => "verifica-esto",
    leerEnv: (n) => env[n],
    ahora: opts.ahora,
    ...(opts.extra ?? {}),
  });
  return { canal, store, graph, llamadas };
}

export const WS_A = "00000000-0000-0000-0000-00000000000a";
export const WS_B = "00000000-0000-0000-0000-00000000000b";

export function conexion(ws: string, pnid: string, tokenEnv: string | null, extra: Partial<Conexion> = {}): Conexion {
  return { workspaceId: ws, phoneNumberId: pnid, tokenEnv, enabled: true, asistente: "Aly", organizacion: "Programa", ...extra };
}

let seq = 0;
export function mensajeTexto(
  texto: string,
  o: { from?: string; fromUserId?: string; pnid?: string; wamid?: string; type?: string } = {},
) {
  const wamid = o.wamid ?? `wamid.in.${++seq}`;
  const msg: any = { id: wamid, timestamp: "1", type: o.type ?? "text" };
  if (o.from !== undefined) msg.from = o.from;
  if (o.fromUserId !== undefined) msg.from_user_id = o.fromUserId;
  if ((o.type ?? "text") === "text") msg.text = { body: texto };
  const contact: any = { profile: { name: "Persona" } };
  if (o.from) contact.wa_id = o.from;
  if (o.fromUserId) contact.user_id = o.fromUserId;
  return { wamid, pnid: o.pnid ?? "111", msg, contact };
}

export function payload(...ms: ReturnType<typeof mensajeTexto>[]) {
  const porPnid = new Map<string, ReturnType<typeof mensajeTexto>[]>();
  for (const m of ms) porPnid.set(m.pnid, [...(porPnid.get(m.pnid) ?? []), m]);
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba",
        changes: [...porPnid.entries()].map(([pnid, lista]) => ({
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "570000000", phone_number_id: pnid },
            contacts: lista.map((m) => m.contact),
            messages: lista.map((m) => m.msg),
          },
        })),
      },
    ],
  });
}

/** POST firmado al canal. */
export function postear(canal: ReturnType<typeof crearCanal>, raw: string) {
  return canal.recibir(raw, firmar(raw));
}
