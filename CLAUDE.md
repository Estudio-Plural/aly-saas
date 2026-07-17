# CLAUDE.md — Aly SaaS

MVP de **Plural Conversational System** (nombre de producto en la UI desde
2026-06-12; "Aly" queda como nombre interno/repo): plataforma multi-tenant de
asistentes de IA para WhatsApp (pitch a CEOs/inversores).
Repo: `Estudio-Plural/aly-saas`, branch de trabajo `main`.

**Visión de producto (definida por Daniel):** el usuario es **no-code** — entra,
crea su propio Aly y todo lo técnico es automático (metadatos de documentos,
análisis de conversaciones). Las únicas dos superficies de "diseño" que toca:
el **builder de onboarding** y **definir sus reglas de alerta** en lenguaje
natural. No agregar configuración técnica visible al usuario.

**⚠️ Reencuadre de producto (Daniel, 2026-07-15 — PENDIENTE de bajar a detalle):**
este producto es de **Estudio Plural, un estudio de ciencias del comportamiento**.
La referencia es **chatac.ai**: programas conversacionales de aprendizaje y cambio
de comportamiento por WhatsApp — NO un chatbot genérico de atención al cliente
para negocios. Daniel siente que ese encuadre no está bien entendido todavía.
Al retomar: conversarlo con él y revisar qué cambia — copy de la UI (hoy dice
"tus productos y servicios"), prompts de enrichment (hoy dicen "documento de un
negocio"), workspaces de prueba (la panadería `la-espiga` es off-brand; el ADN
real es Aly-legacy: programas sociales, facilitadores, protocolos sensibles) y
el pitch. El pipeline con triage sensible + flag rules + onboarding es justo lo
que un programa de comportamiento necesita — el encuadre debe reflejarlo.

**Desde 2026-06-11 la app es funcional en local** (antes era 100% mock).
El estado de sesión vivo está en `SESSION_RESUME.md` — leerlo al retomar.

## Stack y estructura

- Monorepo pnpm + Turborepo. Next.js 16 (App Router, Turbopack) + React 19 +
  Tailwind 4 + shadcn. TypeScript estricto.
- `apps/web/` — la app completa: UI + route handlers en
  `apps/web/app/api/workspaces/...`.
- `apps/api/` — **el engine conversacional real** (Elysia/Bun, sin langgraph ni
  openai-SDK; solo `postgres` + `elysia` + `fetch`). Reproduce la topología de
  16 nodos del Aly-legacy config-driven por workspace: prepare → normalize →
  triage → fanout(intent ∥ librarian) → route → {sensitive | identity |
  smalltalk | retrieve → factual/plan/ideate}. Config en
  `workspace_configs` (cache 5 min, fallback a `src/config/defaults.ts`).
- `packages/shared-types/` — tipos alineados al SQL (mantener sincronizados con
  `supabase/migrations/`).

## Cómo correr

```bash
# Postgres 16 local (Homebrew) debe estar corriendo
./scripts/db-setup.sh                 # crea DB aly_saas + migraciones (idempotente)
cd apps/api && bun run src/index.ts   # engine real en :8080 (pipeline multi-tenant)
cd apps/web && npx next dev           # http://localhost:3000
```

- **El chat usa el engine real** (`apps/api`, pipeline portado de Aly-legacy,
  config-driven por `workspace_configs`): la ruta de chat le pega a
  `POST /api/rag/doQuestion` vía `lib/engine.ts` (`ENGINE_URL`, default
  `http://localhost:8080`). Si el engine no responde, cae al camino legacy de
  una sola llamada (`lib/llm.ts`) — el chat nunca se queda mudo.
- El engine persiste el par user+assistant en `users_interactions` por su
  cuenta; la ruta de chat NO debe volver a guardarlos cuando responde el engine.
- **Ruteo de documentos** (port del doc-routing del librarian legacy): cada
  documento tiene `documents.routing_hint` ("cuándo consultarlo"), auto-generado
  al subir por `enrichDocument` y editable en la Base de Conocimiento. En el
  engine, `agents.routeDocuments` corre en el fanout (en paralelo con intent) y
  decide qué docs entran al contexto (`retrieveContext(wsId, docIds)`).
  Failsafes: sin hint → summary; 0-1 docs → sin LLM call; error o lista vacía
  → todos los docs. El librarian temático (`runLibrarian`) queda para Fase 2.
- **Retrieval vectorial (RAG real, desde 2026-07-17):** `retrieveContext`
  embebe la query normalizada (`engine/embeddings.ts`) y busca TOP_K=8 chunks
  por coseno en `vector_aly.aly_general_knowledge`, respetando el doc-routing.
  Failsafes en cadena: docs con texto pero sin chunks indexados entran
  completos; sin API key / OpenRouter caído / sin pgvector / error → puente de
  texto plano (Fase 0). El modelo de embeddings (`openai/text-embedding-3-large`,
  3072 dims, override `OPENROUTER_EMBEDDING_MODEL`) DEBE ser el mismo en web
  (indexado) y engine (query). Sin índice vectorial (ivfflat/hnsw no soportan
  >2000 dims): scan exacto, sobra a este volumen.
- ⚠️ Los prompts de `apps/api/src/config/defaults.ts` (fallback de workspaces
  nuevos) DEBEN incluir los placeholders `{user_input}`/`{query}`/`{context}`/
  `{history}` — `agents.ts` inserta la pregunta reemplazándolos dentro del
  template; sin ellos el modelo responde un eco de las instrucciones.

- `pnpm dev` desde el root puede fallar por build scripts bloqueados de pnpm →
  usar `npx next dev` directo en `apps/web`.
- Build: `cd apps/web && npx next build` (debe quedar verde antes de commitear).

## Base de datos

- **Postgres local** `aly_saas` (user `daniel`, `postgresql://localhost:5432/aly_saas`).
- ⚠️ El proyecto Supabase remoto viejo (`lroiqesjdmocmawtazhd`) **ya no existe**
  — no intentar conectarse ni buscar sus credenciales.
- Migraciones en `supabase/migrations/` (compatibles con Supabase futuro):
  idempotentes; **pgvector es opcional** (sin él se omite la tabla vectorial
  `vector_aly.aly_general_knowledge` y todo cae a texto plano). En esta máquina
  pgvector 0.8 **ya está instalado** (`postgresql-17-pgvector`) y la tabla
  existe — si falta en otro entorno: instalar el paquete y re-correr
  `db-setup.sh` (la 001 la crea al re-ejecutarse).
- Onboarding se guarda en `onboarding_flows.definition` como
  `{steps: [{id, type: question|message|end, content, variable?}]}` (secuencial,
  NO nodes/edges de React Flow).
- RLS habilitado en todas las tablas (las queries locales lo bypassean por ser
  superuser; las policies usan `current_setting('app.workspace_id')`).

## Arquitectura de datos (apps/web)

- `lib/db.ts` — cliente postgres.js. **Solo importar desde código de servidor.**
- `lib/data/*.ts` — queries por entidad (workspaces, documents, onboarding,
  chat, conversations, whatsapp). Las fechas se devuelven como ISO strings.
- `lib/llm.ts` — chat vía OpenRouter; system prompt = identidad del workspace +
  override en `workspace_configs.prompts.system` + texto de documentos.
  Modelo: `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`), override por
  workspace en `workspace_configs.model_preferences.chat`. La ruta de chat
  **streamea** la respuesta (`streamChatCompletion`, SSE de OpenRouter →
  `text/plain` chunked al cliente; fallback JSON si no hay API key).
- `lib/uploads.ts` — archivos en `apps/web/.uploads/` (gitignoreado).
  `extractTextContent` es async: TXT/MD/CSV directo y **PDF vía `unpdf`**;
  ese texto entra al system prompt del chat.
- `lib/enrichment.ts` — enriquecimiento automático con LLM: `enrichDocument`
  (summary/keywords/tema al subir, columnas en `documents`) y
  `analyzeConversation` (al cerrar el chat preview: summary/keywords/flags
  contra las `workspace_configs.flag_rules` → upsert en `conversations_data`;
  la severidad sale de la regla configurada, no del LLM). Ambos fallan en
  silencio (log + null): subir/cerrar nunca debe romperse por el LLM.
- `lib/embeddings.ts` — indexado vectorial al subir: chunking (~1500 chars,
  overlap 200) + embeddings vía OpenRouter → filas en
  `vector_aly.aly_general_knowledge`; limpieza al borrar el doc. Fail-silent
  (misma filosofía que enrichment). Backfill/re-indexado:
  `cd apps/web && bun scripts/backfill-embeddings.ts`.
- Patrón de páginas: `page.tsx` = server component que hace fetch a la DB y
  redirige a `/dashboard` si el workspace no existe; la UI vive en
  `*-client.tsx` (`"use client"`). Mantener este patrón al agregar páginas.
- `next build` exige `export const dynamic = "force-dynamic"` en páginas que
  leen DB.

## Env (apps/web/.env.local — no commitear)

Requeridos en local: `DATABASE_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.
Ver `apps/web/.env.example`. La clave de OpenRouter vino de
`~/Documents/Dev/agentChatBuilder/.env`.

## Qué es real vs simulado

| Real | Simulado / pendiente |
|---|---|
| CRUD workspaces, settings (rename propaga al chat), uploads + descarga, extracción de texto de PDF/TXT/MD/CSV **+ metadatos automáticos por LLM**, onboarding persistido, chat con LLM en streaming + markdown + historial, inbox de Conversaciones (`/[workspace]/conversations`), **flagging system definido por el usuario + análisis LLM real al cerrar conversaciones del preview**, **RAG vectorial (pgvector + embeddings OpenRouter, con fallback a texto plano)** | Conexión WhatsApp/Kapso (teatro persistido en DB), auth (usuario fijo `demo_user_001` / hola@plural-estudio.co), billing, análisis de conversaciones de WhatsApp reales (solo las del preview web se analizan; las seed de 003/004 traen análisis pre-cargado) |

## Convenciones

- UI en español rioplatense (vos/tenés). Toasts con `sonner`; confirmaciones con
  `ConfirmDialog` (nunca `alert`/`confirm`).
- **Estética estilo Chatbase** (pedido de Daniel): light, neutral, primary negro
  (`--primary: #18181b` en globals.css), **sin gradientes**. Color solo con
  significado: verde/azul en badges de estado, severidades de alertas
  (rojo/ámbar), tipos de paso del onboarding (azul/verde/morado) y links.
  No mostrar el email del usuario demo en los headers.
- Commits estilo `feat:`/`fix:`/`chore:` con resumen en español.
- Docs de pitch: `PITCH_SCRIPT.md`, `DEMO_CHECKLIST.md`. `KAPSO_INTEGRATION.md`
  es pseudocódigo aspiracional (menciona Prisma que no existe) — no tomarlo
  como implementado.

## Pendientes conocidos

- Números del deck (decisión de Daniel): margen 94% → ~70-80% honesto; churn
  20%/mes inconsistente; falta CAC/LTV.
- Post-funding: Clerk, Kapso real, Stripe, migrar a Supabase (crear proyecto
  nuevo **con pgvector habilitado**; cambiar `lib/db.ts` y `lib/uploads.ts`).
- Deps instaladas sin uso: `@xyflow/react`, `next-themes`, `@clerk/nextjs`,
  `@supabase/ssr`, `zustand`.
