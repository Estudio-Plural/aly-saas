# 🔄 Resumen de Sesión - Aly SaaS

**Fecha:** 2026-06-11
**Status:** ✅ La app es FUNCIONAL en local — persistencia real + chat con LLM

---

## 🎉 Lo que cambió hoy (2026-06-11)

El MVP dejó de ser 100% mock: **todas las páginas leen y escriben en una base
Postgres local**, el chat responde con un **LLM real** (OpenRouter) usando la
knowledge base, y el flujo de onboarding guardado **corre de verdad** en el chat.

> Contexto: el proyecto Supabase remoto (`lroiqesjdmocmawtazhd`) ya no existe
> (NXDOMAIN — borrado/pausado). Se reemplazó por Postgres 16 local de Homebrew.

### Arquitectura local

```
apps/web (Next.js 16)
├── app/api/workspaces/...        ← route handlers = backend (apps/api sigue vacío)
├── lib/db.ts                     ← cliente postgres.js → postgresql://localhost:5432/aly_saas
├── lib/data/*.ts                 ← queries server-only (workspaces, documents, onboarding, chat, whatsapp)
├── lib/llm.ts                    ← OpenRouter (system prompt + knowledge + config por workspace)
├── lib/uploads.ts                ← archivos en apps/web/.uploads/ (gitignoreado)
└── páginas = server component (fetch DB) + *-client.tsx (UI)
```

### Qué funciona de verdad

| Página | Estado |
|---|---|
| Dashboard | Lista/crea workspaces en DB, stats reales (docs/usuarios/chats) |
| Settings | Guarda/borra en DB. **El rename del asistente SÍ se propaga al chat** (era el caveat P1) |
| Knowledge | Upload real (drag&drop y picker), descarga, borrado. TXT/MD/CSV se inyectan al contexto del chat |
| Onboarding | El flujo se guarda en `onboarding_flows` (ya no localStorage) |
| Chat | Conversación nueva → corre el flujo de onboarding → después LLM real con la knowledge base. Historial persistido en `users_interactions` |
| WhatsApp | Conexión simulada pero **persistida** en DB (sobrevive reloads). Stats honestas (0 hasta integrar Kapso) |

### Base de datos

- **DB local:** `aly_saas` (Postgres 16 Homebrew, user `daniel`)
- **Setup/re-setup:** `./scripts/db-setup.sh` (idempotente)
- Migraciones arregladas: idempotentes, pgvector ahora **opcional** (sin pgvector
  se omite la tabla vectorial; RAG queda para producción)
- **Migración 003 nueva:** tabla `documents`, RLS en TODAS las tablas (era el P2
  de seguridad), `graph_definition` → `definition` con `{steps: [...]}`
  (resuelto el mismatch nodes/edges vs UI secuencial), seed demo + apapachar
- `packages/shared-types` actualizado para coincidir con el SQL real

### Env (apps/web/.env.local)

- `DATABASE_URL=postgresql://localhost:5432/aly_saas`
- `OPENROUTER_API_KEY` (copiada de agentChatBuilder/.env)
- `OPENROUTER_MODEL=openai/gpt-4o-mini` (override por workspace:
  `workspace_configs.model_preferences.chat`)

---

## 🚀 Cómo correr

```bash
# 1. Postgres debe estar corriendo (brew services start postgresql@16)
# 2. Si la DB no existe o hay migraciones nuevas:
./scripts/db-setup.sh

# 3. Dev server
cd apps/web && npx next dev
# → http://localhost:3000
```

**Flujo para probar que todo es real:**
1. `/dashboard` → crear un workspace nuevo
2. `/<slug>/knowledge` → subir un .txt con info del negocio
3. `/<slug>/onboarding` → editar el flujo y guardar
4. `/<slug>/chat` → la conversación corre el onboarding y después el LLM
   responde usando el .txt subido
5. Recargar cualquier página: todo persiste

---

## ✅ Verificado end-to-end (2026-06-11)

- `next build` verde
- Smoke test por API: crear workspace → subir doc → chat con LLM (respondió
  usando el contenido del doc) → historial persistido → rename propagado al
  chat → WhatsApp persistido → descarga de doc → onboarding PUT → delete
  workspace (limpia uploads)

---

## ⏳ Pendientes

### Decisión de Daniel (pre-pitch)
- 🟡 Números del deck: margen 94% → honesto ~70-80%; churn 20%/mes incompatible
  con 5 altas/mes para 100 clientes; falta CAC, LTV/CAC, desglose de los $200k

### Post-funding (el plan no cambió)
- 🔵 RAG real con pgvector (en local: `brew install pgvector` o Supabase) —
  hoy los TXT/MD se inyectan directo al prompt, PDFs solo se almacenan
- 🔵 Clerk auth (hoy: usuario demo fijo `demo_user_001` / hola@plural-estudio.co)
- 🔵 Kapso webhook real (la conexión WhatsApp es teatro persistido)
- 🔵 Stripe billing
- 🔵 Decidir si `apps/api` (Elysia/Bun) se construye o se consolida todo en
  Next route handlers (hoy los route handlers alcanzan)
- 🔵 Volver a Supabase: crear proyecto nuevo, correr las mismas migraciones
  (ya son compatibles), cambiar `lib/db.ts`/uploads a Supabase client+Storage

### Menor
- ⚪ Deps fantasma: `@xyflow/react`, `next-themes`, `@clerk/nextjs`,
  `@supabase/ssr`, `zustand` instalados sin uso
- ⚪ `KAPSO_INTEGRATION.md` sigue siendo pseudocódigo con Prisma inexistente

---

## 🔧 Comandos útiles

```bash
# DB
psql -d aly_saas                      # consola
./scripts/db-setup.sh                 # crear/migrar (idempotente)
psql -d aly_saas -c "SELECT slug, assistant_name FROM workspaces;"

# Server
cd apps/web && npx next dev           # dev
lsof -ti:3000 | xargs kill -9         # matar puerto

# Build
cd apps/web && npx next build
```
