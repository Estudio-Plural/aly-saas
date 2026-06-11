// Cliente Postgres (local). Solo importar desde código de servidor
// (route handlers / server components) — nunca desde componentes "use client".
import postgres from "postgres";

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL ?? "postgresql://localhost:5432/aly_saas", {
    onnotice: () => {},
    max: 10,
  });

// Reusar la conexión entre hot-reloads de Next en desarrollo
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
