# CLAUDE.md — Aly SaaS

MVP de Aly: plataforma multi-tenant de asistentes de IA para WhatsApp (pitch a
CEOs/inversores). Repo: `Estudio-Plural/aly-saas`, branch de trabajo `main`.

**Visión de producto (definida por Daniel):** el usuario es **no-code** — entra,
crea su propio Aly y todo lo técnico es automático (metadatos de documentos,
análisis de conversaciones). Las únicas dos superficies de "diseño" que toca:
el **builder de onboarding** y **definir sus reglas de alerta** en lenguaje
natural. No agregar configuración técnica visible al usuario.

**Desde 2026-06-11 la app es funcional en local** (antes era 100% mock).
El estado de sesión vivo está en `SESSION_RESUME.md` — leerlo al retomar.

## Stack y estructura

- Monorepo pnpm + Turborepo. Next.js 16 (App Router, Turbopack) + React 19 +
  Tailwind 4 + shadcn. TypeScript estricto.
- `apps/web/` — la app completa. **El backend son route handlers** en
  `apps/web/app/api/workspaces/...` (no hay servidor aparte).
- `apps/api/` — scaffold Elysia/Bun **vacío a propósito** (decisión post-funding:
  construirlo o consolidar en Next).
- `packages/shared-types/` — tipos alineados al SQL (mantener sincronizados con
  `supabase/migrations/`).

## Cómo correr

```bash
# Postgres 16 local (Homebrew) debe estar corriendo
./scripts/db-setup.sh          # crea DB aly_saas + migraciones (idempotente)
cd apps/web && npx next dev    # http://localhost:3000
```

- `pnpm dev` desde el root puede fallar por build scripts bloqueados de pnpm →
  usar `npx next dev` directo en `apps/web`.
- Build: `cd apps/web && npx next build` (debe quedar verde antes de commitear).

## Base de datos

- **Postgres local** `aly_saas` (user `daniel`, `postgresql://localhost:5432/aly_saas`).
- ⚠️ El proyecto Supabase remoto viejo (`lroiqesjdmocmawtazhd`) **ya no existe**
  — no intentar conectarse ni buscar sus credenciales.
- Migraciones en `supabase/migrations/` (compatibles con Supabase futuro):
  idempotentes; **pgvector es opcional** (el Postgres local no lo tiene; sin él
  se omite la tabla vectorial `vector_aly.aly_general_knowledge`).
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
| CRUD workspaces, settings (rename propaga al chat), uploads + descarga, extracción de texto de PDF/TXT/MD/CSV **+ metadatos automáticos por LLM**, onboarding persistido, chat con LLM en streaming + markdown + historial, inbox de Conversaciones (`/[workspace]/conversations`), **flagging system definido por el usuario + análisis LLM real al cerrar conversaciones del preview** | Conexión WhatsApp/Kapso (teatro persistido en DB), auth (usuario fijo `demo_user_001` / hola@plural-estudio.co), billing, RAG con embeddings (el conocimiento se inyecta como texto plano al prompt), análisis de conversaciones de WhatsApp reales (solo las del preview web se analizan; las seed de 003/004 traen análisis pre-cargado) |

## Convenciones

- UI en español rioplatense (vos/tenés). Toasts con `sonner`; confirmaciones con
  `ConfirmDialog` (nunca `alert`/`confirm`).
- Commits estilo `feat:`/`fix:`/`chore:` con resumen en español.
- Docs de pitch: `PITCH_SCRIPT.md`, `DEMO_CHECKLIST.md`. `KAPSO_INTEGRATION.md`
  es pseudocódigo aspiracional (menciona Prisma que no existe) — no tomarlo
  como implementado.

## Pendientes conocidos

- Números del deck (decisión de Daniel): margen 94% → ~70-80% honesto; churn
  20%/mes inconsistente; falta CAC/LTV.
- Post-funding: pgvector/RAG, Clerk, Kapso real, Stripe, migrar a Supabase
  (crear proyecto nuevo; cambiar `lib/db.ts` y `lib/uploads.ts`).
- Deps instaladas sin uso: `@xyflow/react`, `next-themes`, `@clerk/nextjs`,
  `@supabase/ssr`, `zustand`.
