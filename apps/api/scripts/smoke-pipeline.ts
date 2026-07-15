// Smoke del pipeline config-driven: misma pregunta a distintos workspaces →
// distinto comportamiento, todo leído de workspace_configs. Correr:
//   bun run scripts/smoke-pipeline.ts
import { processQuestion } from "../src/engine";
import { sql } from "../src/db";

async function ask(slug: string, question: string, lang = "es") {
  const rows = await sql<{ id: string }[]>`SELECT id FROM workspaces WHERE slug = ${slug}`;
  if (!rows[0]) return console.log(`(sin workspace ${slug})`);
  const res = await processQuestion({
    question,
    userNumber: `smoke-${slug}`,
    language: lang,
    conversationId: `smoke-${slug}-${Math.abs(hash(question))}`,
    workspaceId: rows[0].id,
  });
  console.log(`\n──────── [${slug}] "${question}"`);
  console.log(`intent=${res.intent} confidence=${res.confidence}`);
  console.log(`answer: ${res.answer.slice(0, 320)}`);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

async function main() {
  const IDENTITY_Q = "¿Qué es Equimundo y cómo puedo contactarlos?";
  await ask("demo", IDENTITY_Q); // org_identity ON → responde desde el perfil
  await ask("apapachar", IDENTITY_Q); // org_identity OFF → fallback / factual
  await ask("demo", "hola! cómo andás?"); // → SMALLTALK
  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e);
  process.exit(1);
});
