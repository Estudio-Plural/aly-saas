// Reglas exactas de Aly: los mismos casos que protegen el canal de WhatsApp.
import { describe, expect, test } from "bun:test";
import { esAceptacion, esRechazo, evaluarConsentimiento } from "../src";

describe("consentimiento (reglas exactas de Aly)", () => {
  test.each(["1", "sí", "Si", "  ACEPTO ", "sí acepto", "sí, acepto", "Sí, acepto", "estoy de acuerdo", "Estoy de acuerdo"])(
    "acepta %p",
    (m) => {
      expect(esAceptacion(m)).toBe(true);
      expect(evaluarConsentimiento(m)).toBe("acepta");
    },
  );
  test.each(["hola", "ok", "dale", "sí claro", "acepto!", "de acuerdo", "1️⃣", "2", "no"])("no acepta %p", (m) =>
    expect(esAceptacion(m)).toBe(false),
  );
  test.each(["2", "no", "No", "no acepto", "no entiendo", "No gracias", "NO."])("rechaza %p", (m) => {
    expect(esRechazo(m)).toBe(true);
    expect(evaluarConsentimiento(m)).toBe("rechaza");
  });
  test.each(["hola", "nomás pregunto", "1", "¿qué es esto?", "ahora no", "sí claro", "acepto!"])(
    "no rechaza %p",
    (m) => expect(esRechazo(m)).toBe(false),
  );
  test.each(["hola", "¿qué es esto?", "ahora no", "sí claro", "ok"])("repite con %p", (m) =>
    expect(evaluarConsentimiento(m)).toBe("repite"),
  );
});
