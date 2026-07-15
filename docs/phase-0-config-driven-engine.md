# Fase 0 — Motor config-driven (multi-tenant real)

**Objetivo:** que `demo`, `apapachar` y `mexico` corran **idénticos** leyendo su
configuración de `workspace_configs` en DB, en vez de las clases hardcodeadas
`*AgentPrompts.ts`. Sin features nuevas. Es el desbloqueo que vuelve al motor
multi-tenant; todo lo demás (compiler, pgvector, Clerk, Stripe) va después.

**Criterio de éxito:** un set de preguntas produce el mismo output corriendo
contra el motor hardcodeado (Aly-legacy) y contra el motor config-driven leyendo
de DB. Si hay paridad para los 3 bots, Fase 0 está cerrada.

---

## Hallazgo clave (esto abarata todo)

El grafo de 16 nodos se construye **una sola vez** en el constructor
(`LangchainRAGService.ts:199` → `_buildGraph()`), **pero los prompts se resuelven
por-request dentro del nodo `prepare`** (`:350`):

```ts
builder.addNode("prepare", async (state) => {
  const agentPrompts = getAgentPrompts(state.language, state.botId); // ← per-request
  ...
});
```

Es decir: **la topología del grafo no sabe de qué bot es** — solo cambia la
*fuente* de los prompts, y esa fuente ya se consulta en cada request. Multi-tenancy
**no requiere reconstruir el grafo ni tocar la topología.** Basta con cambiar de
dónde salen los prompts (hoy `BOT_CONSTANTS` compile-time → mañana
`workspace_configs` runtime). Esto es exactamente lo que la nota "Configuración
dinámica" ya anticipaba.

---

## Los 3 seams exactos a tocar (todos en `LangchainRAGService.ts`)

| # | Qué | Dónde (Aly-legacy) | Cambio |
|---|-----|--------------------|--------|
| 1 | **Prompts + modelos** | `:350` `getAgentPrompts(language, botId)` | → `resolveBotConfig(workspaceId, language)` que lee de DB (cache + fallback a template default) |
| 2 | **Corpus / retrieval** | `:436` (`retrieveSensitive`) y `:597` (`retrieve`) `BOT_ID_PROGRAMS[botId]` | → `config.programs` (Fase 0: mantener el string `program`; Fase 2: migrar a `workspace_id`) |
| 3 | **Ramas estructurales del demo** | `botId === "demo"` en `:362`, `:395`, `:820`, `routeAfterFanOut`, gate de `collectContext` | → `config.capabilities` (flags), no un id de bot hardcodeado |

Nada más del grafo cambia. Los 16 nodos, el fan-out/fan-in, el routing, los
terminales — todo queda igual.

---

## El schema ya existe (casi entero)

`workspace_configs` (aly-saas, migración `001_initial_schema.sql:59`) ya tiene lo
que necesitamos:

```sql
CREATE TABLE workspace_configs (
  workspace_id      UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  theme_categories  JSONB NOT NULL DEFAULT '[...5 cats + sensitive...]',  -- ✅ ya está
  model_preferences JSONB NOT NULL DEFAULT '{}',   -- {plan, normalize, ...}  ✅ ya está
  prompts           JSONB NOT NULL DEFAULT '{}',   -- hoy solo {system}       ⚠️ ampliar
  flag_rules        JSONB NOT NULL DEFAULT '[]',   -- (Conversaciones)        ✅ ya está
  ...
);
```

**Único gap:** hoy `prompts` guarda `{system}` (el chat de juguete). Tiene que
guardar el bundle completo de 15 campos del `AgentPrompts` (ES+EN) + un campo
nuevo `capabilities`. No hace falta tabla nueva: es ampliar el JSONB + una
migración chica.

### El contrato de config (`BotConfig`)

`AgentPrompts` (los 15 campos de `BotConstants.ts:61`) **ya es** el schema de
prompts por tenant. Lo envolvemos:

```ts
interface BotConfig {
  prompts: AgentPrompts;          // 15 campos ya resueltos ES/EN
  models: { plan: string; normalize: string; /* overrides */ };
  programs: string[];             // corpus (Fase 0: ["apapachar","equimundo"], etc.)
  capabilities: {
    sensitive_safety: boolean;                       // triage sensibles (default true)
    context_gathering: { on: boolean; slots: string[] };  // ex slot-filling del demo
    org_identity: boolean;                           // ex nodo identity del demo
  };
}

// Reemplaza a getAgentPrompts + BOT_ID_PROGRAMS + los checks botId==="demo".
async function resolveBotConfig(workspaceId: string, language: string): Promise<BotConfig>
```

- **Cache** in-memory, TTL 5 min (evita un hit a DB por request).
- **Fallback:** si un campo no tiene override en el workspace, usar el template
  default. Los prompts actuales de `apapachar` son el default base razonable.
- **Reframe estructural:** los dos nodos "especiales" del demo dejan de ser
  `botId === "demo"` y pasan a ser capacidades genéricas de cualquier tenant:
  `context_gathering` (juntar slots antes de responder — el tenant define cuáles)
  y `org_identity` (perfil de la organización — todo tenant tiene el suyo).

---

## Dónde corre el motor

Decisión ya tomada: **motor real dentro del SaaS**. Concretamente:

- Revivir `apps/api` (Bun/Elysia, hoy scaffold vacío) como **servicio del engine**,
  reusando el código de Aly-legacy casi verbatim (mismo runtime, port directo).
- El engine lee `workspace_configs` del **mismo Postgres `aly_saas`**.
- La ruta de chat de Next (`apps/web/app/api/workspaces/[slug]/chat/route.ts`)
  deja de usar `lib/llm.ts` (1 sola llamada LLM) y le pega al engine por HTTP.

Alternativa considerada y descartada para el pipeline pesado (~10 llamadas LLM,
2-4s): route handler Node de Next con `maxDuration` alto. Queda como plan B si
no queremos dos procesos en local.

---

## Pasos (orden de ejecución)

1. **Migración DB** (`006_*`): ampliar `workspace_configs.prompts` al bundle
   completo + columna/campo `capabilities` JSONB + `programs` JSONB.
2. **`resolveBotConfig(workspaceId, language)`** en el engine: query + cache TTL
   5min + fallback a template default.
3. **Reemplazar los 3 seams** en el grafo (prompts, programs, capabilities).
   El nodo `prepare` pasa a poner `config` en el state; downstream consume igual.
4. **Seed script:** convertir `DEMO_CONSTANTS` / `APAPACHAR_CONSTANTS` /
   `MEXICO_CONSTANTS` en filas de `workspace_configs` (los 15 prompts ES+EN +
   capabilities: demo → `{context_gathering.on:true, org_identity:true}`;
   apapachar/mexico → ambos false).
5. **Parity test:** correr un banco de preguntas contra hardcoded vs
   config-driven para los 3 bots; comparar salidas. Este es el gate de la fase.
6. **Cablear el engine:** revivir `apps/api`, apuntar el chat de Next al engine
   por HTTP, retirar `lib/llm.ts` del camino.

---

## Decisiones abiertas (menores — no bloquean el arranque)

- **Cliente DB del engine:** `postgres.js` (unificar con aly-saas) vs `supabase-js`
  (igual que legacy). Recomiendo `postgres.js` para tener un solo cliente.
- **Particionado del corpus:** Fase 0 mantiene la columna `program`; Fase 2 migra
  a `workspace_id` (junto con pgvector real).
- **Modelos por agente:** viven en `model_preferences`; para Fase 0 alcanza con
  portar los overrides que hoy tienen demo (`PLAN_MODEL_DEMO`, `NORMALIZE_MODEL_DEMO`).

## Fuera de scope de Fase 0

- Prompt compiler (Fase 1 — el diferencial).
- pgvector real per-workspace (Fase 2).
- Clerk / Stripe / Kapso real (Fase 3).
