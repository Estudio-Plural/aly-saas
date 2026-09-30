// El webhook de punta a punta, sin base, sin Meta y sin LLM: store en memoria,
// Graph falso y processQuestion mockeado.

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { firmaValida, verifyMetaSignature } from "../src/whatsapp/meta-webhook";
import { sendWhatsAppText } from "../src/whatsapp/meta-cloud-api";
import { mensajesGate } from "../src/whatsapp/onboarding";
import { textosPorDefecto } from "../src/whatsapp/textos";
import {
  SECRETO,
  StoreMemoria,
  WS_A,
  WS_B,
  conexion,
  firmar,
  graphFalso,
  mensajeTexto,
  montar,
  payload,
  postear,
} from "./whatsapp-fakes";

const TEL = "573001112233";
const t = textosPorDefecto("Aly", "Programa");

/** Store con la conexión A (pnid 111) y la B (pnid 222). */
function storeBase() {
  const s = new StoreMemoria();
  s.conexiones = [conexion(WS_A, "111", "META_TOKEN_A"), conexion(WS_B, "222", "META_TOKEN_B")];
  return s;
}

/** Deja a la persona con consentimiento y la sesión viva. */
async function aceptada(canal: ReturnType<typeof montar>["canal"], de = TEL, pnid = "111") {
  await postear(canal, payload(mensajeTexto("hola", { from: de, pnid })));
  await postear(canal, payload(mensajeTexto("1", { from: de, pnid })));
}

describe("firma", () => {
  test("HMAC sobre los bytes crudos", () => {
    const raw = '{"a": 1}';
    expect(verifyMetaSignature(raw, firmar(raw), SECRETO)).toBe(true);
    // El mismo objeto re-serializado NO verifica: por eso se firma el crudo.
    expect(verifyMetaSignature(JSON.stringify(JSON.parse(raw)), firmar(raw), SECRETO)).toBe(false);
    expect(verifyMetaSignature(raw, "sha256=00", SECRETO)).toBe(false);
    expect(verifyMetaSignature(raw, undefined, SECRETO)).toBe(false);
  });

  test("acepta si firma con CUALQUIERA de los app secrets; sin secretos, nada", () => {
    const raw = "{}";
    expect(firmaValida(raw, firmar(raw, "otra-app"), ["x", "otra-app"])).toBe(true);
    expect(firmaValida(raw, firmar(raw), [])).toBe(false);
  });

  test("POST con firma inválida → 401 y no se contesta a nadie", async () => {
    const { canal, graph } = montar({ store: storeBase() });
    const raw = payload(mensajeTexto("hola", { from: TEL }));
    const r = await canal.recibir(raw, firmar(raw, "secreto-ajeno"));
    expect(r.status).toBe(401);
    expect(graph.envios).toHaveLength(0);
  });

  test("POST firmado pero no-JSON → 400", async () => {
    const { canal } = montar({ store: storeBase() });
    expect((await canal.recibir("no json", firmar("no json"))).status).toBe(400);
  });

  test("GET de verificación: challenge con el token correcto, 403 si no", async () => {
    const { canal, store } = montar({ store: storeBase() });
    const ok = await canal.verificar({ "hub.mode": "subscribe", "hub.verify_token": "verifica-esto", "hub.challenge": "42" });
    expect(ok).toEqual({ status: 200, body: "42" });
    expect(store.marcas).toContain("webhook:verificado");
    const mal = await canal.verificar({ "hub.mode": "subscribe", "hub.verify_token": "otro", "hub.challenge": "42" });
    expect(mal.status).toBe(403);
  });
});

describe("reparto por número", () => {
  test("cada phone_number_id habla con la voz (workspace y token) de su conexión", async () => {
    const { canal, graph } = montar({ store: storeBase() });
    const r = await postear(
      canal,
      payload(mensajeTexto("hola", { from: TEL, pnid: "111" }), mensajeTexto("hola", { from: "573009998877", pnid: "222" })),
    );
    expect(r.status).toBe(200);
    const a = graph.envios.filter((e) => e.phoneNumberId === "111");
    const b = graph.envios.filter((e) => e.phoneNumberId === "222");
    expect(a.every((e) => e.token === "token-a" && e.recipient === TEL)).toBe(true);
    expect(b.every((e) => e.token === "token-b" && e.recipient === "573009998877")).toBe(true);
    expect(a).toHaveLength(3); // el gate
    expect(b).toHaveLength(3);
  });

  test("número sin conexión (WABA compartida con otro bot) → se ignora, 200", async () => {
    const { canal, graph } = montar({ store: storeBase() });
    const r = await postear(canal, payload(mensajeTexto("hola", { from: TEL, pnid: "999" })));
    expect(r.status).toBe(200);
    expect(graph.envios).toHaveLength(0);
  });

  test("conexión pausada → no contesta", async () => {
    const s = storeBase();
    s.conexiones[0]!.enabled = false;
    const { canal, graph } = montar({ store: s });
    await postear(canal, payload(mensajeTexto("hola", { from: TEL, pnid: "111" })));
    expect(graph.envios).toHaveLength(0);
  });

  test("sin token en el entorno → 500 (Meta reintenta), nada enviado, error visible", async () => {
    const s = storeBase();
    s.conexiones[0]!.tokenEnv = "META_TOKEN_NO_EXISTE";
    const { canal, graph, store } = montar({ store: s });
    const r = await postear(canal, payload(mensajeTexto("hola", { from: TEL })));
    expect(r.status).toBe(500);
    expect(graph.envios).toHaveLength(0);
    expect(store.marcas.some((m) => m.includes("META_TOKEN_NO_EXISTE"))).toBe(true);
  });

  test("un token_env fuera de META_TOKEN_* nunca se lee (no se filtra otra variable)", async () => {
    const s = storeBase();
    s.conexiones[0]!.tokenEnv = "DATABASE_URL";
    const { canal, graph } = montar({ store: s, env: { DATABASE_URL: "postgres://secreto" } });
    await postear(canal, payload(mensajeTexto("hola", { from: TEL })));
    expect(graph.envios).toHaveLength(0);
  });

  test("si la base cae al leer conexiones, se rutea con la última foto", async () => {
    const { canal, store, graph } = montar({ store: storeBase() });
    await postear(canal, payload(mensajeTexto("hola", { from: TEL })));
    store.fallar.add("conexionesPorPnid");
    const r = await postear(canal, payload(mensajeTexto("hola", { from: "573005554433" })));
    expect(r.status).toBe(200);
    expect(graph.envios.filter((e) => e.recipient === "573005554433")).toHaveLength(3);
  });
});

describe("BSUID", () => {
  test("mensaje sin teléfono (solo from_user_id) se contesta al BSUID con isBsuid", async () => {
    const { canal, graph } = montar({ store: storeBase() });
    await postear(canal, payload(mensajeTexto("hola", { fromUserId: "CO.1529666775511825" })));
    expect(graph.envios).toHaveLength(3);
    expect(graph.envios.every((e) => e.isBsuid && e.recipient === "CO.1529666775511825")).toBe(true);
  });

  test("teléfono y BSUID juntos → gana el teléfono", async () => {
    const { canal, graph } = montar({ store: storeBase() });
    await postear(canal, payload(mensajeTexto("hola", { from: TEL, fromUserId: "CO.abc123" })));
    expect(graph.envios.every((e) => !e.isBsuid && e.recipient === TEL)).toBe(true);
  });

  test("sin identidad reconocible → no se adivina, no se contesta", async () => {
    const { canal, graph } = montar({ store: storeBase() });
    await postear(canal, payload(mensajeTexto("hola", { from: "no-es-telefono" })));
    expect(graph.envios).toHaveLength(0);
  });

  describe("sendWhatsAppText contra Graph (fetch mockeado)", () => {
    const fetchOriginal = globalThis.fetch;
    let cuerpos: any[] = [];
    beforeEach(() => {
      cuerpos = [];
      globalThis.fetch = mock(async (_url: any, init: any) => {
        cuerpos.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" }] }), { status: 200 });
      }) as any;
    });
    afterEach(() => {
      globalThis.fetch = fetchOriginal;
    });

    test("BSUID va en `recipient` y se OMITE `to`", async () => {
      const r = await sendWhatsAppText({ phoneNumberId: "111", token: "t", recipient: "CO.abc", isBsuid: true, text: "hola" });
      expect(r).toEqual({ ok: true, wamid: "wamid.OUT" });
      expect(cuerpos[0].recipient).toBe("CO.abc");
      expect("to" in cuerpos[0]).toBe(false);
    });

    test("teléfono va en `to`", async () => {
      await sendWhatsAppText({ phoneNumberId: "111", token: "t", recipient: TEL, isBsuid: false, text: "hola" });
      expect(cuerpos[0].to).toBe(TEL);
      expect("recipient" in cuerpos[0]).toBe(false);
    });

    test("error de Graph → ok:false sin filtrar el token", async () => {
      globalThis.fetch = mock(async () =>
        new Response(JSON.stringify({ error: { message: "Invalid OAuth", code: 190 } }), { status: 401 }),
      ) as any;
      const r = await sendWhatsAppText({ phoneNumberId: "111", token: "SUPER-SECRETO", recipient: TEL, isBsuid: false, text: "x" });
      expect(r).toEqual({ ok: false, error: "Invalid OAuth", code: 190 });
      expect(JSON.stringify(r)).not.toContain("SUPER-SECRETO");
    });
  });
});

describe("onboarding del lado servidor", () => {
  test("gate → acepta → conversación por processQuestion con la misma conversación", async () => {
    const { canal, graph, store, llamadas } = montar({ store: storeBase() });
    await postear(canal, payload(mensajeTexto("hola", { from: TEL })));
    expect(graph.textos()).toEqual(mensajesGate(t));

    await postear(canal, payload(mensajeTexto("sí, acepto", { from: TEL })));
    expect(graph.textos().at(-1)).toBe(t.cierreOnboarding);
    expect(llamadas).toHaveLength(0); // su "sí, acepto" no es una pregunta
    expect(store.usuarios.has(`${WS_A}:${TEL}`)).toBe(true);

    await postear(canal, payload(mensajeTexto("¿cómo planeo la sesión?", { from: TEL })));
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toMatchObject({ workspaceId: WS_A, userNumber: TEL, language: "es" });
    expect(llamadas[0]!.conversationId).toBe(store.sesiones.get(`${WS_A}:${TEL}`)!.conversationId);
    expect(graph.textos().at(-1)).toBe("respuesta a: ¿cómo planeo la sesión?");
    expect(store.marcas).toContain(`respondido:${WS_A}`);
  });

  test("rechazar no guarda NADA y quien vuelve recibe el gate otra vez", async () => {
    const { canal, graph, store, llamadas } = montar({ store: storeBase() });
    await postear(canal, payload(mensajeTexto("hola", { from: TEL })));
    await postear(canal, payload(mensajeTexto("no entiendo", { from: TEL })));
    expect(graph.textos().at(-1)).toBe(t.despedidaRechazo);
    expect(store.sesiones.size).toBe(0);
    expect(store.usuarios.size).toBe(0);
    expect(llamadas).toHaveLength(0);

    const antes = graph.envios.length;
    await postear(canal, payload(mensajeTexto("hola de nuevo", { from: TEL })));
    expect(graph.textos().slice(antes)).toEqual(mensajesGate(t));
  });

  test("«hola» en el gate repite la pregunta, sin pipeline", async () => {
    const { canal, graph, llamadas } = montar({ store: storeBase() });
    await postear(canal, payload(mensajeTexto("hola", { from: TEL })));
    await postear(canal, payload(mensajeTexto("hola", { from: TEL })));
    expect(graph.textos().at(-1)).toBe(t.preguntaConsentimiento);
    expect(llamadas).toHaveLength(0);
  });

  test("preguntas de perfil de la config del workspace se guardan tras aceptar", async () => {
    const s = storeBase();
    s.configs.set(WS_A, {
      whatsapp_onboarding: { preguntas_perfil: [{ id: "rol", pregunta: "¿Tu rol?", opciones: ["Docente", "Otro"] }] },
    });
    const { canal, store, graph } = montar({ store: s });
    await aceptada(canal);
    expect(graph.textos().at(-1)).toContain("1. Docente");
    await postear(canal, payload(mensajeTexto("1", { from: TEL })));
    expect(store.usuarios.get(`${WS_A}:${TEL}`)!.profile).toEqual({ rol: "Docente" });
    expect(graph.textos().at(-1)).toBe(t.cierreOnboarding);
  });

  test("audio → «solo texto», sin tocar la sesión ni el pipeline", async () => {
    const { canal, graph, store, llamadas } = montar({ store: storeBase() });
    await postear(canal, payload(mensajeTexto("", { from: TEL, type: "audio" })));
    expect(graph.textos()).toEqual([t.soloTexto]);
    expect(store.sesiones.size).toBe(0);
    expect(llamadas).toHaveLength(0);
  });

  test("70 min de silencio → conversación nueva; el consentimiento se conserva", async () => {
    let ahora = new Date("2026-09-30T10:00:00Z");
    const { canal, store, llamadas, graph } = montar({ store: storeBase(), ahora: () => ahora });
    await aceptada(canal);
    await postear(canal, payload(mensajeTexto("pregunta 1", { from: TEL })));
    const conv1 = llamadas[0]!.conversationId;

    ahora = new Date(ahora.getTime() + 71 * 60_000);
    const antes = graph.envios.length;
    await postear(canal, payload(mensajeTexto("pregunta 2", { from: TEL })));
    expect(llamadas[1]!.conversationId).not.toBe(conv1);
    expect(graph.textos().slice(antes)).toEqual(["respuesta a: pregunta 2"]); // sin gate
    expect(store.sesiones.get(`${WS_A}:${TEL}`)!.aceptado).toBe(true);
  });

  test("«salir» cierra: despedida y el siguiente mensaje abre otra conversación", async () => {
    const { canal, store, llamadas, graph } = montar({ store: storeBase() });
    await aceptada(canal);
    await postear(canal, payload(mensajeTexto("pregunta", { from: TEL })));
    const conv1 = llamadas[0]!.conversationId;
    await postear(canal, payload(mensajeTexto("salir", { from: TEL })));
    expect(graph.textos().at(-1)).toBe(t.despedidaSalir);
    expect(store.cerradas).toContain(conv1);
    await postear(canal, payload(mensajeTexto("otra", { from: TEL })));
    expect(llamadas[1]!.conversationId).not.toBe(conv1);
  });

  test("respuesta del engine: markdown → WhatsApp y sin marcadores de adjuntos", async () => {
    const { canal, graph } = montar({
      store: storeBase(),
      procesar: async () => ({ answer: "## Plan\n**Paso 1** [[adjunto:abc]]" }),
    });
    await aceptada(canal);
    await postear(canal, payload(mensajeTexto("dame un plan", { from: TEL })));
    expect(graph.textos().at(-1)).toBe("Plan\n*Paso 1*");
  });
});

describe("idempotencia por wamid", () => {
  test("el mismo wamid dos veces se contesta una sola", async () => {
    const { canal, graph } = montar({ store: storeBase() });
    const m = mensajeTexto("hola", { from: TEL });
    await postear(canal, payload(m));
    const r = await postear(canal, payload(m));
    expect(r.status).toBe(200);
    expect(graph.envios).toHaveLength(3);
  });

  test("pipeline caído → 500, wamid liberado, y el reintento sí se atiende", async () => {
    let falla = true;
    const llamadas: string[] = [];
    const { canal, graph, store } = montar({
      store: storeBase(),
      procesar: async (i) => {
        llamadas.push(i.question);
        if (falla) throw new Error("OpenRouter caído");
        return { answer: "ok" };
      },
    });
    await aceptada(canal);
    const m = mensajeTexto("pregunta", { from: TEL });
    expect((await postear(canal, payload(m))).status).toBe(500);
    expect(store.mensajes.has(m.wamid)).toBe(false); // liberado
    falla = false;
    expect((await postear(canal, payload(m))).status).toBe(200);
    expect(graph.textos().at(-1)).toBe("ok");
    expect(llamadas).toEqual(["pregunta", "pregunta"]);
  });

  test("envío fallido → el reintento REENVÍA lo ya generado, sin regenerar", async () => {
    let n = 0;
    const graph = graphFalso();
    const { canal, store } = montar({
      store: storeBase(),
      graph,
      procesar: async () => ({ answer: `respuesta ${++n}` }),
    });
    await aceptada(canal); // 4 envíos (índices 0..3)
    graph.fallarEn.add(4); // la respuesta del pipeline no sale
    const m = mensajeTexto("pregunta", { from: TEL });
    expect((await postear(canal, payload(m))).status).toBe(500);
    expect(store.mensajes.get(m.wamid)).toMatchObject({ estado: "pendiente_envio", salidas: ["respuesta 1"] });

    expect((await postear(canal, payload(m))).status).toBe(200);
    expect(n).toBe(1); // el modelo corrió UNA vez
    expect(graph.textos().at(-1)).toBe("respuesta 1");
    expect(store.mensajes.get(m.wamid)).toMatchObject({ estado: "hecho", salidas: null });
  });

  test("gate de 3 burbujas que falla en la 2ª: el reintento no repite la 1ª", async () => {
    const graph = graphFalso();
    graph.fallarEn.add(1);
    const { canal } = montar({ store: storeBase(), graph });
    const m = mensajeTexto("hola", { from: TEL });
    expect((await postear(canal, payload(m))).status).toBe(500);
    expect((await postear(canal, payload(m))).status).toBe(200);
    expect(graph.textos()).toEqual(mensajesGate(t));
  });

  test("base caída en la contabilidad → la respuesta a Meta no cambia", async () => {
    const s = storeBase();
    const { canal, graph, store } = montar({ store: s });
    await aceptada(canal);
    for (const f of ["reservar", "guardarPendiente", "marcarHecho", "marcarRecibido", "marcarRespondido", "marcarWebhook", "filaConfig", "guardarSesion"]) {
      store.fallar.add(f);
    }
    const r = await postear(canal, payload(mensajeTexto("pregunta", { from: TEL })));
    expect(r.status).toBe(200);
    expect(graph.textos().at(-1)).toBe("respuesta a: pregunta");
  });

  test("sin reserva en la base, la memoria igual evita la respuesta doble", async () => {
    const { canal, graph, store } = montar({ store: storeBase() });
    store.fallar.add("reservar");
    const m = mensajeTexto("hola", { from: TEL });
    await postear(canal, payload(m));
    await postear(canal, payload(m));
    expect(graph.envios).toHaveLength(3);
  });

  test("sesión ilegible → 500 y wamid liberado (no se contesta sin saber si aceptó)", async () => {
    const { canal, graph, store } = montar({ store: storeBase() });
    store.fallar.add("leerSesion");
    const m = mensajeTexto("hola", { from: TEL });
    expect((await postear(canal, payload(m))).status).toBe(500);
    expect(graph.envios).toHaveLength(0);
    expect(store.mensajes.has(m.wamid)).toBe(false);
  });
});

describe("fila por persona", () => {
  test("dos POSTs de la misma persona se atienden en orden aunque el primero sea lento", async () => {
    const orden: string[] = [];
    const { canal, graph } = montar({
      store: storeBase(),
      procesar: async (i) => {
        orden.push(`inicio ${i.question}`);
        if (i.question === "primera") await Bun.sleep(40);
        orden.push(`fin ${i.question}`);
        return { answer: `r-${i.question}` };
      },
    });
    await aceptada(canal);
    const antes = graph.envios.length;
    await Promise.all([
      postear(canal, payload(mensajeTexto("primera", { from: TEL }))),
      postear(canal, payload(mensajeTexto("segunda", { from: TEL }))),
    ]);
    expect(orden).toEqual(["inicio primera", "fin primera", "inicio segunda", "fin segunda"]);
    expect(graph.textos().slice(antes)).toEqual(["r-primera", "r-segunda"]);
  });

  test("personas distintas corren en paralelo", async () => {
    const orden: string[] = [];
    const { canal } = montar({
      store: storeBase(),
      procesar: async (i) => {
        orden.push(`inicio ${i.userNumber}`);
        await Bun.sleep(20);
        orden.push(`fin ${i.userNumber}`);
        return { answer: "ok" };
      },
    });
    await aceptada(canal, TEL);
    await aceptada(canal, "573007776655");
    await postear(
      canal,
      payload(mensajeTexto("a", { from: TEL }), mensajeTexto("b", { from: "573007776655" })),
    );
    expect(orden.slice(0, 2)).toEqual([`inicio ${TEL}`, "inicio 573007776655"]);
  });

  test("reintento de Meta mientras el original sigue corriendo → 500 sin tocar nada", async () => {
    let soltar!: () => void;
    const bloqueo = new Promise<void>((r) => (soltar = r));
    let corridas = 0;
    const { canal, graph } = montar({
      store: storeBase(),
      procesar: async () => {
        corridas++;
        await bloqueo;
        return { answer: "lenta" };
      },
    });
    await aceptada(canal);
    const m = mensajeTexto("pregunta", { from: TEL });
    const original = postear(canal, payload(m));
    await Bun.sleep(5);
    const reintento = await postear(canal, payload(m));
    expect(reintento.status).toBe(500);
    soltar();
    expect((await original).status).toBe(200);
    expect(corridas).toBe(1);
    expect(graph.textos().filter((x) => x === "lenta")).toHaveLength(1);
    expect(canal._estado()).toMatchObject({ enCurso: 0 });
  });

  test("un turno fallido no traba la fila de esa persona", async () => {
    let primera = true;
    const { canal, graph } = montar({
      store: storeBase(),
      procesar: async () => {
        if (primera) {
          primera = false;
          throw new Error("boom");
        }
        return { answer: "sigo" };
      },
    });
    await aceptada(canal);
    await postear(canal, payload(mensajeTexto("uno", { from: TEL })));
    const r = await postear(canal, payload(mensajeTexto("dos", { from: TEL })));
    expect(r.status).toBe(200);
    expect(graph.textos().at(-1)).toBe("sigo");
  });
});

describe("timeouts", () => {
  test("pipeline colgado → timeout, 500 y wamid liberado", async () => {
    const { canal, store } = montar({
      store: storeBase(),
      procesar: () => new Promise(() => {}),
      extra: { pipelineTimeoutMs: 30 },
    });
    await aceptada(canal);
    const m = mensajeTexto("pregunta", { from: TEL });
    expect((await postear(canal, payload(m))).status).toBe(500);
    expect(store.mensajes.has(m.wamid)).toBe(false);
  });
});
