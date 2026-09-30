// «Diseñar» — queries de las secciones de la migración 012 y del avance del
// programa (Primeros pasos + checks del menú). Solo servidor.
// NULL en una columna = la organización todavía no revisó esa sección.
import { sql } from "@/lib/db";
import { WEB_PREVIEW_NUMBER } from "@/lib/data/chat";
import type {
  Boundaries,
  HelpRoute,
  ProgramProgress,
  Welcome,
} from "@/lib/design";
import type { CorePrompt, Storyboard } from "@/lib/workspaces";

type DesignRow = {
  core_prompt: Partial<CorePrompt> | null;
  storyboard: Partial<Storyboard> | null;
  boundaries: Boundaries | null;
  help_routes: HelpRoute[] | null;
  welcome: Welcome | null;
};

/** Valores tal como están en la DB (sin defaults), para distinguir lo escrito del ejemplo. */
export async function getDesign(workspaceId: string): Promise<DesignRow> {
  const rows = await sql<DesignRow[]>`
    SELECT core_prompt, storyboard, boundaries, help_routes, welcome
    FROM workspace_configs WHERE workspace_id = ${workspaceId}
  `;
  return (
    rows[0] ?? {
      core_prompt: null,
      storyboard: null,
      boundaries: null,
      help_routes: null,
      welcome: null,
    }
  );
}

export async function saveBoundaries(
  workspaceId: string,
  boundaries: Boundaries
): Promise<void> {
  await sql`
    INSERT INTO workspace_configs (workspace_id, boundaries)
    VALUES (${workspaceId}, ${sql.json(boundaries)})
    ON CONFLICT (workspace_id) DO UPDATE SET boundaries = EXCLUDED.boundaries
  `;
}

export async function saveHelpRoutes(
  workspaceId: string,
  routes: HelpRoute[]
): Promise<void> {
  await sql`
    INSERT INTO workspace_configs (workspace_id, help_routes)
    VALUES (${workspaceId}, ${sql.json(routes)})
    ON CONFLICT (workspace_id) DO UPDATE SET help_routes = EXCLUDED.help_routes
  `;
}

export async function saveWelcome(workspaceId: string, welcome: Welcome): Promise<void> {
  await sql`
    INSERT INTO workspace_configs (workspace_id, welcome)
    VALUES (${workspaceId}, ${sql.json(welcome)})
    ON CONFLICT (workspace_id) DO UPDATE SET welcome = EXCLUDED.welcome
  `;
}

function filled(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

/**
 * Avance real del programa. Criterios:
 * - Tu programa: misión, a quién acompaña y criterio de éxito escritos.
 * - Qué no hace: la organización guardó la sección al menos una vez.
 * - Rutas de ayuda: al menos una ruta con nombre y contacto.
 * - Material: al menos un documento.
 * - Bienvenida: mensaje de bienvenida y aviso de privacidad escritos.
 * - Probar: hay al menos un mensaje en el chat de prueba.
 * - Conectar WhatsApp: la conexión de la 013 está activa — habilitada y con un mensaje
 *   real recibido Y respondido (whatsapp_connections.last_reply_at, lo escribe el engine).
 *   Es la misma «prueba de vida» del checklist de Conectar WhatsApp.
 * - Operar: hay al menos una conversación real (no de prueba).
 */
export async function getProgramProgress(workspace: {
  id: string;
  stats: { documents: number };
}): Promise<ProgramProgress> {
  const [design, [counts]] = await Promise.all([
    getDesign(workspace.id),
    sql<{ preview: boolean; real: boolean; connected: boolean }[]>`
      SELECT
        EXISTS (SELECT 1 FROM whatsapp_connections
                WHERE workspace_id = ${workspace.id}
                  AND enabled AND last_reply_at IS NOT NULL) AS connected,
        EXISTS (SELECT 1 FROM users_interactions
                WHERE workspace_id = ${workspace.id}
                  AND client_number = ${WEB_PREVIEW_NUMBER}) AS preview,
        EXISTS (SELECT 1 FROM users_interactions
                WHERE workspace_id = ${workspace.id}
                  AND client_number <> ${WEB_PREVIEW_NUMBER}) AS real
    `,
  ]);
  const core = design.core_prompt;
  const welcome = design.welcome;
  return {
    design: {
      program:
        filled(core?.mission) && filled(core?.audience) && filled(core?.success_criteria),
      boundaries: design.boundaries !== null,
      routes: (design.help_routes ?? []).some(
        (route) => filled(route.name) && filled(route.contact)
      ),
      material: workspace.stats.documents > 0,
      welcome: filled(welcome?.welcome_message) && filled(welcome?.privacy_notice),
    },
    test: counts.preview,
    connect: counts.connected,
    operate: counts.real,
  };
}
