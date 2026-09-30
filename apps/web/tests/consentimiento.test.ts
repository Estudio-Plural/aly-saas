/// <reference types="bun-types" />
// UNA sola regla de consentimiento: el chat de prueba del panel y el canal de
// WhatsApp del engine usan la MISMA función de packages/consentimiento (no una copia).
// Los casos de la regla están en packages/consentimiento/test.
import { describe, expect, test } from "bun:test";
import * as paquete from "@aly-saas/consentimiento";
import * as design from "@/lib/design";
import * as canal from "../../api/src/whatsapp/onboarding";

describe("consentimiento compartido", () => {
  test("el panel usa la función del paquete", () => {
    expect(design.evaluarConsentimiento).toBe(paquete.evaluarConsentimiento);
    expect(design.PREGUNTA_CONSENTIMIENTO).toBe(paquete.PREGUNTA_CONSENTIMIENTO);
  });

  test("el canal de WhatsApp usa las funciones del paquete", () => {
    expect(canal.esAceptacion).toBe(paquete.esAceptacion);
    expect(canal.esRechazo).toBe(paquete.esRechazo);
  });

  test("el chat de prueba arranca con la misma pregunta que WhatsApp", () => {
    const pasos = design.welcomeToSteps({
      welcome_message: "Hola",
      privacy_notice: "Aviso",
      privacy_policy_url: "",
      profile_questions: [],
    });
    expect(pasos.find((p) => p.type === "consent")?.content).toBe(paquete.PREGUNTA_CONSENTIMIENTO);
  });

  test("mismas decisiones en los casos límite", () => {
    for (const [m, d] of [["acepto!", "repite"], ["sí claro", "repite"], ["NO.", "rechaza"], ["ahora no", "repite"], ["Sí, acepto", "acepta"]] as const) {
      expect(design.evaluarConsentimiento(m)).toBe(d);
    }
  });
});
