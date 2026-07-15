// Cliente Postgres del engine (postgres.js). Apunta a la misma DB local
// aly_saas que usa apps/web. Reutiliza la conexión entre hot-reloads.
import postgres from "postgres";

const globalForDb = globalThis as unknown as {
  __alyEngineSql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.__alyEngineSql ??
  postgres(process.env.DATABASE_URL ?? "postgresql://localhost:5432/aly_saas", {
    onnotice: () => {},
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__alyEngineSql = sql;

export type Sql = typeof sql;
