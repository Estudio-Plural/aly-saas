// La máquina de onboarding, en puro. Los casos del gate son los de Aly
// (reglas del 2026-09-25): no se aflojan.

import { describe, expect, test } from "bun:test";
import {
  esAceptacion,
  esRechazo,
  mensajesGate,
  nuevoConversationId,
  sesionSigueViva,
  siguientePaso,
} from "../src/whatsapp/onboarding";
import { resolverTextos, textosPorDefecto } from "../src/whatsapp/textos";

const t = textosPorDefecto("Aly", "Semillas");
const conPerfil = {
  ...t,
  preguntasPerfil: [
    { id: "rol", pregunta: "¿Cuál es tu rol?", opciones: ["Docente", "Facilitador/a"] },
    { id: "ciudad", pregunta: "¿En qué ciudad estás?", opciones: [] },
  ],
};

const paso = (estado: string, mensaje: string, o: { aceptado?: boolean; esNueva?: boolean; textos?: typeof t } = {}) =>
  siguientePaso({ estado, mensaje, aceptado: o.aceptado ?? false, esNueva: o.esNueva ?? false, textos: o.textos ?? t });

describe("reglas de aceptación y rechazo (exactas de Aly)", () => {
  test.each(["1", "sí", "Si", "  ACEPTO ", "sí acepto", "sí, acepto", "Sí, acepto", "estoy de acuerdo", "Estoy de acuerdo"])(
    "acepta %p",
    (m) => expect(esAceptacion(m)).toBe(true),
  );
  test.each(["hola", "ok", "dale", "sí claro", "acepto!", "2", "no"])("no acepta %p", (m) =>
    expect(esAceptacion(m)).toBe(false),
  );
  test.each(["2", "no", "No", "no acepto", "no entiendo", "No gracias", "NO."])("rechaza %p", (m) =>
    expect(esRechazo(m)).toBe(true),
  );
  test.each(["hola", "nomás pregunto", "1", "¿qué es esto?", "ahora no"])("no rechaza %p", (m) =>
    expect(esRechazo(m)).toBe(false),
  );
});

describe("gate de privacidad", () => {
  test("persona nueva recibe bienvenida + aviso + pregunta, y nada va al pipeline", () => {
    const p = paso("nuevo", "hola, quiero ayuda", { esNueva: true });
    expect(p.responder).toEqual(mensajesGate(t));
    expect(p.responder).toHaveLength(3);
    expect(p.estado).toBe("esperando_privacidad");
    expect(p.alPipeline).toBe(false);
    expect(p.accion.tipo).toBe("ninguna");
  });

  test("«sí, acepto» acepta y su mensaje no va al pipeline", () => {
    const p = paso("esperando_privacidad", "sí, acepto");
    expect(p.accion.tipo).toBe("aceptar");
    expect(p.estado).toBe("listo");
    expect(p.alPipeline).toBe(false);
    expect(p.responder).toEqual([t.cierreOnboarding]);
  });

  test("«no entiendo» despide (y la acción es rechazar: no se guarda nada)", () => {
    const p = paso("esperando_privacidad", "no entiendo");
    expect(p.accion.tipo).toBe("rechazar");
    expect(p.responder).toEqual([t.despedidaRechazo]);
    expect(p.alPipeline).toBe(false);
  });

  test("«2» despide", () => {
    expect(paso("esperando_privacidad", "2").accion.tipo).toBe("rechazar");
  });

  test("«hola» repite SOLO la pregunta", () => {
    const p = paso("esperando_privacidad", "hola");
    expect(p.responder).toEqual([t.preguntaConsentimiento]);
    expect(p.estado).toBe("esperando_privacidad");
    expect(p.accion.tipo).toBe("ninguna");
  });

  test("rechazado que vuelve (sin fila → nuevo) recibe el gate de nuevo", () => {
    const rechazo = paso("esperando_privacidad", "no");
    expect(rechazo.estado).toBe("nuevo");
    const vuelve = paso("nuevo", "hola otra vez", { esNueva: true });
    expect(vuelve.responder).toEqual(mensajesGate(t));
  });

  test("gate a medias con la sesión vencida → gate completo, aunque diga 1", () => {
    const p = paso("esperando_privacidad", "1", { esNueva: true });
    expect(p.accion.tipo).toBe("ninguna");
    expect(p.responder).toEqual(mensajesGate(t));
  });

  test("el link de la política aparece en el aviso cuando está configurado", () => {
    const tt = { ...t, politicaUrl: "https://ejemplo.org/politica" };
    expect(mensajesGate(tt)[1]).toContain("https://ejemplo.org/politica");
  });

  test("sin consentimiento, «salir» no esquiva el gate", () => {
    expect(paso("nuevo", "salir", { esNueva: true }).responder).toEqual(mensajesGate(t));
  });
});

describe("preguntas de perfil opcionales", () => {
  test("aceptar con preguntas → transición + primera pregunta con opciones numeradas", () => {
    const p = paso("esperando_privacidad", "1", { textos: conPerfil });
    expect(p.accion.tipo).toBe("aceptar");
    expect(p.estado).toBe("perfil:0");
    expect(p.responder[1]).toContain("1. Docente");
    expect(p.responder[1]).toContain("2. Facilitador/a");
  });

  test("respuesta por número guarda la opción y pasa a la siguiente", () => {
    const p = paso("perfil:0", "2", { aceptado: true, textos: conPerfil });
    expect(p.accion).toEqual({ tipo: "perfil", id: "rol", valor: "Facilitador/a" });
    expect(p.estado).toBe("perfil:1");
    expect(p.responder).toEqual(["¿En qué ciudad estás?"]);
  });

  test("respuesta inválida repite la pregunta", () => {
    const p = paso("perfil:0", "7", { aceptado: true, textos: conPerfil });
    expect(p.accion.tipo).toBe("ninguna");
    expect(p.estado).toBe("perfil:0");
  });

  test("«saltar» avanza sin guardar", () => {
    const p = paso("perfil:1", "saltar", { aceptado: true, textos: conPerfil });
    expect(p.accion.tipo).toBe("ninguna");
    expect(p.estado).toBe("listo");
    expect(p.responder).toEqual([t.cierreOnboarding]);
  });

  test("texto libre en la última cierra el onboarding", () => {
    const p = paso("perfil:1", "Bogotá", { aceptado: true, textos: conPerfil });
    expect(p.accion).toEqual({ tipo: "perfil", id: "ciudad", valor: "Bogotá" });
    expect(p.estado).toBe("listo");
    expect(p.alPipeline).toBe(false);
  });

  test("perfil a medias con sesión nueva → sigue a la conversación", () => {
    const p = paso("perfil:1", "¿cómo planeo la sesión 3?", { aceptado: true, esNueva: true, textos: conPerfil });
    expect(p.alPipeline).toBe(true);
    expect(p.estado).toBe("listo");
  });
});

describe("conversación", () => {
  test("listo → pipeline", () => {
    const p = paso("listo", "no sé cómo empezar", { aceptado: true });
    expect(p.alPipeline).toBe(true);
    expect(p.responder).toEqual([]);
  });

  test("«salir» cierra la sesión", () => {
    const p = paso("listo", "Salir", { aceptado: true });
    expect(p.accion.tipo).toBe("cerrar_sesion");
    expect(p.responder).toEqual([t.despedidaSalir]);
    expect(p.alPipeline).toBe(false);
  });

  test("sesión: viva a los 69 min, nueva a los 70", () => {
    const ahora = new Date("2026-09-30T12:00:00Z");
    expect(sesionSigueViva(new Date(ahora.getTime() - 69 * 60_000), ahora)).toBe(true);
    expect(sesionSigueViva(new Date(ahora.getTime() - 70 * 60_000), ahora)).toBe(false);
    expect(sesionSigueViva(null, ahora)).toBe(false);
    expect(sesionSigueViva(new Date(0), ahora)).toBe(false);
    expect(nuevoConversationId("573001112233", ahora)).toStartWith("573001112233-");
  });
});

describe("textos del workspace (contrato con la 012, lectura tolerante)", () => {
  test("sin columna → defaults", () => {
    expect(resolverTextos({ workspace_id: "x", prompts: {} }, "Aly", "P")).toEqual(textosPorDefecto("Aly", "P"));
    expect(resolverTextos(null)).toEqual(textosPorDefecto());
  });

  test("lee whatsapp_onboarding, ignora vacíos y URL inválidas", () => {
    const r = resolverTextos({
      whatsapp_onboarding: {
        bienvenida: "Hola, soy Semillas",
        aviso_privacidad: "  ",
        politica_url: "javascript:alert(1)",
        preguntas_perfil: [{ id: "rol", pregunta: "¿Rol?", opciones: ["A", "", "B"] }, { pregunta: "" }],
      },
    });
    expect(r.bienvenida).toBe("Hola, soy Semillas");
    expect(r.avisoPrivacidad).toBe(textosPorDefecto().avisoPrivacidad);
    expect(r.politicaUrl).toBeNull();
    expect(r.preguntasPerfil).toEqual([{ id: "rol", pregunta: "¿Rol?", opciones: ["A", "B"] }]);
  });

  test("lee la columna `welcome` con la forma EXACTA de la 012 de Diseñar", () => {
    const r = resolverTextos({
      welcome: {
        welcome_message: "¡Hola! Soy Aly",
        privacy_notice: "Guardamos lo que escribes para…",
        privacy_policy_url: "",
        profile_questions: [
          { id: "q1", question: "¿En qué región vives?", variable: "region", options: [] },
          { id: "q2", question: "¿Género?", variable: "genero", options: ["Mujer", "Hombre"] },
        ],
      },
    });
    expect(r.bienvenida).toBe("¡Hola! Soy Aly");
    expect(r.avisoPrivacidad).toBe("Guardamos lo que escribes para…");
    expect(r.politicaUrl).toBeNull();
    expect(r.preguntasPerfil).toEqual([
      { id: "region", pregunta: "¿En qué región vives?", opciones: [] },
      { id: "genero", pregunta: "¿Género?", opciones: ["Mujer", "Hombre"] },
    ]);
  });

  test("acepta alias en inglés", () => {
    const r = resolverTextos({
      whatsapp_onboarding: {
        welcome: "Hi",
        policy_url: "https://x.org/p",
        profile_questions: [{ question: "Role?", options: ["X"] }],
      },
    });
    expect(r.bienvenida).toBe("Hi");
    expect(r.politicaUrl).toBe("https://x.org/p");
    expect(r.preguntasPerfil[0]).toEqual({ id: "pregunta_1", pregunta: "Role?", opciones: ["X"] });
  });
});
