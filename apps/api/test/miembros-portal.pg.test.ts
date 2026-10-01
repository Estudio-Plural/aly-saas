// El espejo del portal contra una base REAL: altas, bajas, nombres y roles conservados.
// Se salta si no hay WA_TEST_DATABASE_URL (nunca la base compartida aly_saas).
//   WA_TEST_DATABASE_URL=postgresql://localhost:5432/aly_saas_v2 bun test miembros-portal

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { aplicarPortal } from "@aly-saas/miembros";

const URL = process.env.WA_TEST_DATABASE_URL;
const d = URL && !/\/aly_saas$/.test(URL) ? describe : describe.skip;

d("miembros: espejo del portal en org_members", () => {
  const R = `t-portal-${Date.now()}`;
  const A = `${R}-a`;
  const B = `${R}-b`;
  let sql: typeof import("../src/db").sql;
  const deR = async () =>
    sql<{ org_id: string; email: string; rol: string }[]>`
      SELECT org_id, email, rol FROM org_members WHERE org_id LIKE ${R + "%"} ORDER BY org_id, email`;
  // El espejo es de TODA la tabla: se prueba con lo que ya hay en la base más lo de esta prueba.
  const portalCon = async (extra: { id: string; nombre: string; miembros: string[] }[]) => {
    const resto = await sql<{ org_id: string; nombre: string; email: string }[]>`
      SELECT m.org_id, o.nombre, m.email FROM org_members m JOIN orgs o ON o.id = m.org_id
      WHERE m.org_id NOT LIKE ${R + "%"}`;
    const otras = [...new Set(resto.map((m) => m.org_id))].map((id) => ({
      id,
      nombre: resto.find((m) => m.org_id === id)!.nombre,
      miembros: resto.filter((m) => m.org_id === id).map((m) => m.email),
    }));
    return [...otras, ...extra];
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = URL;
    ({ sql } = await import("../src/db"));
    await sql`INSERT INTO orgs (id, nombre) VALUES (${A}, 'A vieja')`;
    await sql`INSERT INTO org_members (org_id, email, rol) VALUES (${A}, 'coordina@a.test', 'admin'), (${A}, 'se-va@a.test', 'miembro')`;
  });

  afterAll(async () => {
    await sql`DELETE FROM orgs WHERE id LIKE ${R + "%"}`;
  });

  test("agrega, quita, crea la org nueva, renombra y conserva el rol", async () => {
    const plan = await aplicarPortal(
      sql,
      await portalCon([
        { id: A, nombre: "A", miembros: ["coordina@a.test", "nueva@a.test"] },
        { id: B, nombre: "B", miembros: ["b@b.test"] },
      ]),
    );
    expect(plan.bajas).toEqual([{ org_id: A, email: "se-va@a.test" }]);
    expect(await deR()).toEqual([
      { org_id: A, email: "coordina@a.test", rol: "admin" },
      { org_id: A, email: "nueva@a.test", rol: "miembro" },
      { org_id: B, email: "b@b.test", rol: "miembro" },
    ]);
    const [a] = await sql<{ nombre: string }[]>`SELECT nombre FROM orgs WHERE id = ${A}`;
    expect(a!.nombre).toBe("A");
  });

  test("sin Aly contratado (fuera de la lista): sus miembros salen, la org queda para sus programas", async () => {
    await aplicarPortal(sql, await portalCon([{ id: A, nombre: "A", miembros: ["coordina@a.test", "nueva@a.test"] }]));
    expect((await deR()).filter((m) => m.org_id === B)).toEqual([]);
    expect(await sql`SELECT 1 FROM orgs WHERE id = ${B}`).toHaveLength(1);
  });
});
