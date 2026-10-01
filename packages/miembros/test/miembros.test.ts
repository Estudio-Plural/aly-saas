// El espejo del portal: qué se agrega, qué se quita y qué respuestas se rechazan.
import { describe, expect, test } from "bun:test";
import { configPortal, crearSincronizador, leerPortal, planSincronizacion } from "../src";

const cfg = { url: "http://portal.test/aly", secreto: "s" };
const responder = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("planSincronizacion", () => {
  test("agrega lo nuevo, quita lo que el portal ya no tiene y deja lo igual", () => {
    const plan = planSincronizacion(
      [
        { id: "a", nombre: "A", miembros: ["Ana@A.org", "beto@a.org"] },
        { id: "b", nombre: "B", miembros: [] },
      ],
      [
        { org_id: "a", email: "ana@a.org" },
        { org_id: "a", email: "vieja@a.org" },
        { org_id: "b", email: "sigue@b.org" },
        { org_id: "solo-aly", email: "x@x.org" },
      ],
    );
    expect(plan.orgs).toEqual([{ id: "a", nombre: "A" }, { id: "b", nombre: "B" }]);
    expect(plan.altas).toEqual([{ org_id: "a", email: "beto@a.org" }]);
    expect(plan.bajas).toEqual([
      { org_id: "a", email: "vieja@a.org" },
      { org_id: "b", email: "sigue@b.org" },
      { org_id: "solo-aly", email: "x@x.org" },
    ]);
  });

  test("el mismo correo en dos organizaciones son dos membresías", () => {
    const plan = planSincronizacion(
      [
        { id: "a", nombre: "A", miembros: ["ana@x.org"] },
        { id: "b", nombre: "B", miembros: ["ana@x.org"] },
      ],
      [{ org_id: "a", email: "ana@x.org" }],
    );
    expect(plan.altas).toEqual([{ org_id: "b", email: "ana@x.org" }]);
    expect(plan.bajas).toEqual([]);
  });
});

describe("leerPortal", () => {
  test("normaliza correos y descarta lo que no es correo", async () => {
    const orgs = await leerPortal(cfg, responder({ orgs: [{ id: "a", nombre: "A", miembros: [" Ana@A.org ", 3, "nada"] }] }));
    expect(orgs).toEqual([{ id: "a", nombre: "A", miembros: ["ana@a.org"] }]);
  });

  test("rechaza un error del portal o una respuesta sin forma (no vacía la tabla)", async () => {
    await expect(leerPortal(cfg, responder({ error: "no" }, 403))).rejects.toThrow("403");
    await expect(leerPortal(cfg, responder({}))).rejects.toThrow();
    await expect(leerPortal(cfg, responder({ orgs: [{ id: "a" }] }))).rejects.toThrow();
  });
});

describe("configPortal", () => {
  test("apagada sin secreto o con URL off", () => {
    expect(configPortal({})).toBeNull();
    expect(configPortal({ GATE_SECRET: "s", PORTAL_MIEMBROS_URL: "off" })).toBeNull();
    expect(configPortal({ GATE_SECRET: "s" })?.url).toContain("127.0.0.1:3200");
  });
});

describe("crearSincronizador", () => {
  test("frena las lecturas seguidas salvo que se fuerce", async () => {
    let lecturas = 0;
    const fetchImpl = (async () => {
      lecturas++;
      return new Response(JSON.stringify({ orgs: [] }));
    }) as unknown as typeof fetch;
    const sql = { begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(async () => []) };
    const s = crearSincronizador(sql, cfg, { fetchImpl });
    await s.sincronizar();
    await s.sincronizar();
    expect(lecturas).toBe(1);
    await s.sincronizar({ forzar: true });
    expect(lecturas).toBe(2);
  });

  test("apagado no hace nada", async () => {
    const s = crearSincronizador({ begin: async () => null }, null);
    expect(s.activo).toBe(false);
    expect(await s.sincronizar({ forzar: true })).toBeNull();
  });
});
