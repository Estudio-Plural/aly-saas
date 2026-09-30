// «Qué no hace» + rutas de ayuda (migración 012): lo que el engine compila al
// prompt. Sin DB ni LLM: la DB se mockea con filas fijas.

import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  NO_HELP_ROUTES_BLOCK,
  SAFETY_RULES,
  compileBoundaries,
  compileHelpRoutes,
  helpRoutesMessage,
} from "../src/config/guardrails";
import { compileIdentity } from "../src/config/identity";

let rows: Record<string, unknown>[] = [];
mock.module("../src/db", () => ({
  sql: async () => rows,
}));

const { resolveBotConfig, clearBotConfigCache } = await import("../src/config/resolve");

function expectAllSafetyRules(text: string) {
  for (const rule of SAFETY_RULES) expect(text).toContain(rule.prompt);
}

describe("compileBoundaries", () => {
  test("sin fila: solo las reglas de seguridad", () => {
    const block = compileBoundaries(null);
    expectAllSafetyRules(block);
    expect(block).not.toContain("lo definió la organización");
  });

  test("agrega las reglas propias y descarta las vacías", () => {
    const block = compileBoundaries({
      rules: [
        { id: "a", text: "No recomienda medicamentos" },
        { id: "b", text: "   " },
      ],
    });
    expectAllSafetyRules(block);
    expect(block).toContain("- No recomienda medicamentos");
    expect(block.match(/lo definió la organización/g)).toHaveLength(1);
    expect(block).not.toMatch(/-\s*\n/);
  });

  test("las reglas de seguridad cubren los seis riesgos acordados", () => {
    expect(SAFETY_RULES.map((r) => r.id)).toEqual([
      "no_invent_contacts",
      "material_fidelity",
      "no_file_names",
      "no_follow_up",
      "no_privacy_claims",
      "one_offer",
    ]);
  });
});

describe("compileHelpRoutes", () => {
  test("sin rutas: instrucción de no inventar", () => {
    expect(compileHelpRoutes(null)).toBe(NO_HELP_ROUTES_BLOCK);
    expect(compileHelpRoutes([])).toBe(NO_HELP_ROUTES_BLOCK);
    expect(NO_HELP_ROUTES_BLOCK).toContain("sin inventar números");
  });

  test("rutas incompletas (sin nombre o sin contacto) no cuentan", () => {
    expect(
      compileHelpRoutes([{ id: "x", name: "Línea", contact: " " }]),
    ).toBe(NO_HELP_ROUTES_BLOCK);
  });

  test("lista cada ruta con contacto, horario, cuándo y territorio", () => {
    const block = compileHelpRoutes([
      {
        id: "1",
        name: "Línea 106",
        contact: "106",
        hours: "24 horas",
        when: "Crisis emocional",
        territory: "Bogotá",
      },
      { id: "2", name: "Línea 155", contact: "155" },
    ]);
    expect(block).toContain("NO escribas teléfonos");
    expect(block).toContain(
      "- *Línea 106* — 106 · horario: 24 horas · cuándo usarla: Crisis emocional · territorio: Bogotá",
    );
    expect(block).toContain("- *Línea 155* — 155 · territorio: todos");
  });
});

describe("helpRoutesMessage (bloque que el código anexa)", () => {
  test("sin rutas válidas: vacío (no se anexa nada)", () => {
    expect(helpRoutesMessage(null)).toBe("");
    expect(helpRoutesMessage([{ id: "x", name: "Línea", contact: " " }])).toBe("");
  });

  test("copia nombre y contacto tal cual, con horario y territorio", () => {
    expect(
      helpRoutesMessage([
        { id: "1", name: "Línea 106", contact: "106", hours: "24 horas", territory: "Bogotá" },
        { id: "2", name: "Línea 155", contact: "155" },
      ]),
    ).toBe("*Líneas de ayuda:*\n-> *Línea 106* — 106 (24 horas · Bogotá)\n-> *Línea 155* — 155");
  });
});

describe("compileIdentity", () => {
  test("usa lo que escribió la organización y cae al ejemplo campo a campo", () => {
    const identity = compileIdentity(
      "Aly",
      "Programa Cuidar",
      { mission: "Acompañar a cuidadoras", success_criteria: "", voice_avoid: "usted" },
      { opening: "Saludo corto" },
      { rules: [{ id: "r", text: "No habla de política" }] },
    );
    expect(identity).toContain('Eres Aly, el asistente conversacional de "Programa Cuidar"');
    expect(identity).toContain("Tu misión: Acompañar a cuidadoras");
    expect(identity).toContain("Una conversación va bien cuando: La persona entendió");
    expect(identity).toContain("- Evitas: usted");
    expect(identity).toContain("1) Arranque: Saludo corto");
    expect(identity).toContain("2) Desarrollo: Contenido del programa");
    expect(identity).toContain("- No habla de política");
    expectAllSafetyRules(identity);
  });

  test("tutea: nada de voseo en el bloque compilado", () => {
    const identity = compileIdentity("Aly", "X", null, null);
    expect(identity).not.toMatch(/\b(Sos|Respondés|podés|debés|adaptalo|enviá)\b/);
  });
});

describe("resolveBotConfig (compilado desde la DB)", () => {
  beforeEach(() => clearBotConfigCache());

  test("workspace inexistente: igual lleva las reglas de seguridad y la instrucción sin rutas", async () => {
    rows = [];
    const config = await resolveBotConfig("ws-nada", "es");
    expectAllSafetyRules(config.identity);
    expect(config.helpRoutes).toBe(NO_HELP_ROUTES_BLOCK);
  });

  test("workspace sin config (columnas NULL): seguridad + defaults", async () => {
    rows = [
      {
        prompts: null,
        model_preferences: null,
        capabilities: null,
        programs: null,
        theme_categories: null,
        core_prompt: null,
        storyboard: null,
        boundaries: null,
        help_routes: null,
        assistant_name: "Aly",
        workspace_name: "Demo",
      },
    ];
    const config = await resolveBotConfig("ws-null", "es");
    expect(config.identity).toContain('Eres Aly, el asistente conversacional de "Demo"');
    expectAllSafetyRules(config.identity);
    expect(config.helpRoutes).toBe(NO_HELP_ROUTES_BLOCK);
  });

  test("reglas propias van a la identidad y rutas al bloque de SENSITIVE", async () => {
    rows = [
      {
        prompts: null,
        model_preferences: null,
        capabilities: null,
        programs: null,
        theme_categories: null,
        core_prompt: null,
        storyboard: null,
        boundaries: { rules: [{ id: "r", text: "No recomienda medicamentos" }] },
        help_routes: [{ id: "h", name: "Línea 141", contact: "141", territory: "" }],
        assistant_name: "Aly",
        workspace_name: "Demo",
      },
    ];
    const config = await resolveBotConfig("ws-full", "es");
    expect(config.identity).toContain("- No recomienda medicamentos");
    expect(config.identity).not.toContain("Línea 141");
    expect(config.helpRoutes).toContain("- *Línea 141* — 141 · territorio: todos");
  });
});
