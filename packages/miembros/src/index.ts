// Quién entra a cada organización de Aly: lo decide el portal de Plural IA.
//
// Antes había dos listas (`miembros` en el portal, `org_members` acá) y nada las unía: un
// cliente dado de alta en el portal con `aly` contratado pasaba la puerta y no veía ningún
// programa; uno dado de baja seguía recibiendo el reporte semanal. Ahora el portal es la
// única lista y org_members es su espejo: organizaciones con `aly` y sus miembros.
// Aly solo agrega lo que el portal no tiene: el rol (admin|miembro), que se conserva.
//
// Sin GATE_SECRET (desarrollo local) la sincronización está apagada y /admin edita a mano.

export type OrgPortal = { id: string; nombre: string; miembros: string[] };
export type ConfigPortal = { url: string; secreto: string };
export type Membresia = { org_id: string; email: string };
export type PlanSincronizacion = {
  orgs: { id: string; nombre: string }[];
  altas: Membresia[];
  bajas: Membresia[];
};

export const PORTAL_MIEMBROS_URL = "http://127.0.0.1:3200/app/api/interno/aly";

/** La configuración, o null si la sincronización está apagada (sin GATE_SECRET o URL «off»). */
export function configPortal(env: Record<string, string | undefined> = process.env): ConfigPortal | null {
  const secreto = env.GATE_SECRET?.trim() ?? "";
  const url = env.PORTAL_MIEMBROS_URL?.trim() || PORTAL_MIEMBROS_URL;
  return secreto && url !== "off" ? { url, secreto } : null;
}

const normalizar = (email: string) => email.trim().toLowerCase();

/** Lee la lista del portal. Lanza si no responde o si la respuesta no tiene la forma esperada. */
export async function leerPortal(cfg: ConfigPortal, fetchImpl: typeof fetch = fetch): Promise<OrgPortal[]> {
  const res = await fetchImpl(cfg.url, {
    headers: { "x-gate-secret": cfg.secreto },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`El portal respondió ${res.status}`);
  const data = (await res.json()) as { orgs?: unknown };
  if (!Array.isArray(data.orgs)) throw new Error("El portal respondió sin lista de organizaciones");
  return data.orgs.map((o) => {
    const org = o as Partial<OrgPortal>;
    if (typeof org.id !== "string" || !org.id || typeof org.nombre !== "string" || !Array.isArray(org.miembros)) {
      throw new Error("El portal respondió una organización incompleta");
    }
    return {
      id: org.id,
      nombre: org.nombre,
      miembros: org.miembros.filter((e): e is string => typeof e === "string" && e.includes("@")).map(normalizar),
    };
  });
}

/** Qué cambiar en org_members para que quede igual al portal. Puro. */
export function planSincronizacion(portal: OrgPortal[], actuales: Membresia[]): PlanSincronizacion {
  const clave = (m: Membresia) => `${m.org_id}\n${normalizar(m.email)}`;
  const deseadas = new Map<string, Membresia>();
  for (const o of portal) for (const email of o.miembros) {
    const m = { org_id: o.id, email: normalizar(email) };
    deseadas.set(clave(m), m);
  }
  const hay = new Set(actuales.map(clave));
  return {
    orgs: portal.map(({ id, nombre }) => ({ id, nombre })),
    altas: [...deseadas.entries()].filter(([k]) => !hay.has(k)).map(([, m]) => m),
    bajas: actuales.filter((m) => !deseadas.has(clave(m))),
  };
}

// El cliente `postgres` de cada app. Tipado laxo: el paquete no depende de `postgres`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = { begin: (fn: (tx: any) => Promise<unknown>) => Promise<unknown> };

/** Deja org_members (y los nombres de orgs) igual al portal, en una transacción. */
export async function aplicarPortal(sql: Sql, portal: OrgPortal[]): Promise<PlanSincronizacion> {
  let plan: PlanSincronizacion = { orgs: [], altas: [], bajas: [] };
  await sql.begin(async (tx) => {
    // Un solo sincronizador a la vez (web y engine pueden coincidir).
    await tx`SELECT pg_advisory_xact_lock(hashtext('aly-sincronizar-miembros'))`;
    const actuales = (await tx`SELECT org_id, email FROM org_members`) as Membresia[];
    plan = planSincronizacion(portal, actuales);
    for (const o of plan.orgs) {
      await tx`INSERT INTO orgs (id, nombre) VALUES (${o.id}, ${o.nombre})
               ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre`;
    }
    for (const m of plan.altas) {
      await tx`INSERT INTO org_members (org_id, email) VALUES (${m.org_id}, ${m.email}) ON CONFLICT DO NOTHING`;
    }
    for (const m of plan.bajas) {
      await tx`DELETE FROM org_members WHERE org_id = ${m.org_id} AND email = ${m.email}`;
    }
  });
  return plan;
}

/**
 * Sincronizador con freno: a lo sumo una lectura del portal por `cadaMs` (la puerta también
 * guarda su respuesta 1 min), y una sola en curso a la vez. `forzar` se salta el freno.
 */
export function crearSincronizador(
  sql: Sql,
  cfg: ConfigPortal | null,
  opts: { cadaMs?: number; fetchImpl?: typeof fetch } = {},
) {
  const cadaMs = opts.cadaMs ?? 60_000;
  let ultima = 0;
  let enCurso: Promise<PlanSincronizacion | null> | null = null;
  return {
    activo: cfg !== null,
    async sincronizar({ forzar = false } = {}): Promise<PlanSincronizacion | null> {
      if (!cfg) return null;
      if (enCurso) return enCurso;
      if (!forzar && Date.now() - ultima < cadaMs) return null;
      // El freno corre también si falla: con el portal caído no se espera 5 s en cada request.
      ultima = Date.now();
      enCurso = (async () => {
        try {
          return await aplicarPortal(sql, await leerPortal(cfg, opts.fetchImpl));
        } finally {
          enCurso = null;
        }
      })();
      return enCurso;
    },
  };
}
