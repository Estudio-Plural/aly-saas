// Destinatarios del reporte semanal contra una base REAL: los miembros de la
// organización dueña del programa (org_members, migración 011).
//
// Se salta si no hay WA_TEST_DATABASE_URL (nunca la base compartida aly_saas).
//   WA_TEST_DATABASE_URL=postgresql://localhost:5432/aly_saas_v2 bun test operar-destinatarios

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const URL = process.env.WA_TEST_DATABASE_URL;
const d = URL && !/\/aly_saas$/.test(URL) ? describe : describe.skip;

d("reporte semanal: destinatarios por organización", () => {
  const R = `t-dest-${Date.now()}`;
  let sql: typeof import("../src/db").sql;
  let store: typeof import("../src/operar/store").sqlWeeklyStore;
  let wsA = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = URL;
    ({ sql } = await import("../src/db"));
    ({ sqlWeeklyStore: store } = await import("../src/operar/store"));
    await sql`INSERT INTO orgs (id, nombre) VALUES (${R + "-a"}, 'A'), (${R + "-b"}, 'B')`;
    await sql`INSERT INTO org_members (org_id, email, rol) VALUES
      (${R + "-a"}, 'coordina@a.test', 'admin'), (${R + "-a"}, 'equipo@a.test', 'miembro'),
      (${R + "-b"}, 'otra@b.test', 'admin')`;
    const [w] = await sql<{ id: string }[]>`
      INSERT INTO workspaces (slug, name, owner_user_id, org_id) VALUES (${R}, 'P', 'test', ${R + "-a"}) RETURNING id`;
    wsA = w!.id;
  });

  afterAll(async () => {
    await sql`DELETE FROM workspaces WHERE slug = ${R}`;
    await sql`DELETE FROM orgs WHERE id IN (${R + "-a"}, ${R + "-b"})`;
  });

  test("solo los miembros de la org del programa, sin los de otra org", async () => {
    expect(await store.destinatarios(wsA)).toEqual(["coordina@a.test", "equipo@a.test"]);
  });
});
