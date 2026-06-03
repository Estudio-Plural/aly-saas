// Fuente única de datos mock de workspaces.
// Cuando se cablee el backend, reemplazar getWorkspaceBySlug/MOCK_WORKSPACES
// por queries reales a Supabase manteniendo la misma firma.

export type SubscriptionStatus = "trial" | "active" | "canceled";

export type WorkspaceStats = {
  documents: number;
  conversations: number;
  users: number;
};

export type MockWorkspace = {
  id: string;
  slug: string;
  name: string;
  assistant_name: string;
  subscription_status: SubscriptionStatus;
  created_at: string;
  stats: WorkspaceStats;
};

export const MOCK_WORKSPACES: MockWorkspace[] = [
  {
    id: "1",
    slug: "demo",
    name: "Demo Workspace",
    assistant_name: "Aly",
    subscription_status: "trial",
    created_at: "2026-06-01",
    stats: { documents: 24, conversations: 1200, users: 156 },
  },
  {
    id: "2",
    slug: "apapachar",
    name: "Apapáchar",
    assistant_name: "Apa",
    subscription_status: "active",
    created_at: "2026-03-15",
    stats: { documents: 18, conversations: 2800, users: 340 },
  },
];

/**
 * Devuelve el workspace que matchea el slug. Si no existe (ej. uno recién
 * creado en el dashboard que todavía no tiene backend), sintetiza uno por
 * defecto a partir del slug para que la página igual abra sin romperse.
 */
export function getWorkspaceBySlug(slug: string): MockWorkspace {
  const found = MOCK_WORKSPACES.find((w) => w.slug === slug);
  if (found) return found;

  const name = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    id: slug,
    slug,
    name: name || "Nuevo Workspace",
    assistant_name: "Aly",
    subscription_status: "trial",
    created_at: "2026-06-02",
    stats: { documents: 0, conversations: 0, users: 0 },
  };
}

/** Convierte un nombre en un slug URL-safe (sin acentos ni símbolos). */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // quita acentos
      .replace(/[^a-z0-9\s-]/g, "") // quita símbolos
      .replace(/\s+/g, "-") // espacios a guiones
      .replace(/-+/g, "-") // colapsa guiones repetidos
      .replace(/^-|-$/g, "") || // recorta guiones de los extremos
    "workspace"
  );
}
