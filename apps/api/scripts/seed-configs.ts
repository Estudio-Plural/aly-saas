// Seed: inserta los prompts REALES de los bots (exportados del Aly-legacy con
// scripts/export-bot-configs.ts) en workspace_configs. Crea el workspace si no
// existe. Idempotente. Correr con:  bun run scripts/seed-configs.ts
import { sql } from "../src/db";

const IN =
  "/private/tmp/claude-501/-Users-daniel-Documents-Dev/7f944256-aea4-41fd-a384-6d141a710c0d/scratchpad/bot-configs.json";

const OWNER = "demo_user_001";
const NAMES: Record<string, string> = {
  demo: "Demo",
  apapachar: "Apapáchar",
  mexico: "México",
};

interface BotCfg {
  prompts: Record<string, string>;
  model_preferences: Record<string, string>;
  capabilities: {
    sensitive_safety: boolean;
    context_gathering: { on: boolean; slots: string[] };
    org_identity: boolean;
  };
  programs: string[];
  theme_categories: string[];
}

async function main() {
  const data = (await Bun.file(IN).json()) as Record<string, BotCfg>;

  for (const [slug, cfg] of Object.entries(data)) {
    // 1. workspace (crear si falta)
    let rows = await sql<{ id: string }[]>`SELECT id FROM workspaces WHERE slug = ${slug}`;
    let id = rows[0]?.id;
    if (!id) {
      const ins = await sql<{ id: string }[]>`
        INSERT INTO workspaces (slug, name, assistant_name, owner_user_id)
        VALUES (${slug}, ${NAMES[slug] ?? slug}, 'Aly', ${OWNER})
        RETURNING id
      `;
      id = ins[0].id;
      console.log(`+ workspace "${slug}" creado (${id})`);
    }

    // 2. fila de config (crear si falta)
    await sql`
      INSERT INTO workspace_configs (workspace_id) VALUES (${id})
      ON CONFLICT (workspace_id) DO NOTHING
    `;

    // 3. escribir la config real
    await sql`
      UPDATE workspace_configs SET
        prompts = ${sql.json(cfg.prompts)},
        model_preferences = ${sql.json(cfg.model_preferences)},
        capabilities = ${sql.json(cfg.capabilities)},
        programs = ${sql.json(cfg.programs)},
        theme_categories = ${sql.json(cfg.theme_categories)},
        updated_at = NOW()
      WHERE workspace_id = ${id}
    `;

    console.log(
      `✅ ${slug} seeded — ${Object.keys(cfg.prompts).length} prompts, programs=${JSON.stringify(cfg.programs)}`,
    );
  }

  await sql.end();
  console.log("🌱 seed completo");
}

main().catch((e) => {
  console.error("SEED FAIL:", e);
  process.exit(1);
});
