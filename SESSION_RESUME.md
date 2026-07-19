# 🔄 Resumen de Sesión - Aly SaaS

**Fecha:** 2026-07-19
**Status:** ✅ PRs #1 (identidad + storyboard) y #2 (landing pública) revisadas,
corregidas y mergeadas a main. La VPS quedó como entorno deployado formal:
servicios systemd + túnel funcionando con el código nuevo.

---

## ✨ Lo que cambió el 2026-07-19 (merge de PRs + VPS como deploy formal)

- **PR #1 mergeada (squash)** — identidad/prompt núcleo + storyboard. Antes del
  merge se corrigieron dos fallas silenciosas: `saveCorePrompt`/`saveStoryboard`
  pasaron de `UPDATE` a `INSERT ... ON CONFLICT (workspace_id) DO UPDATE`
  (un workspace sin fila de config "guardaba" 0 filas y la UI decía éxito), y
  `resolveBotConfig` pasó a `workspaces LEFT JOIN workspace_configs` (antes un
  workspace sin config perdía la identidad entera en vez de caer a defaults).
- **PR #2 mergeada (squash)** — landing pública en `/` (route group
  `(landing)`, copy en `lib/landing-copy.ts`). Fixes de copy pre-merge:
  "RAG con citas / no alucina" → "RAG real" honesto; pasos y plan Prueba en
  lenguaje identidad+storyboard (coherente con la #1); headline del hero en
  partes `before/highlight/after` (se fue el replace/split frágil); `socialProof`
  sin uso eliminado. El `.gradient-text` del hero quedó como excepción aceptada
  a "sin gradientes" (marketing).
- **VPS = entorno deployado formal.** Se descubrió que las units systemd
  `aly-web`/`aly-engine` ya existían (creadas 2026-07-15) pero estaban paradas
  desde el 17 y todo corría como procesos sueltos. Se mataron los procesos
  manuales y se re-arrancaron los servicios (enabled, sobreviven reboots).
  Regla operativa: tras mergear cambios del engine → `systemctl restart
  aly-engine` (bun no recarga; además resetea el cache de config de 5 min).
  La web es `next dev` con hot reload del working tree → los merges a main se
  ven solos.
- **Cadena pública verificada:** Quick Tunnel de Cloudflare → caddy `:8093`
  (basic auth `equipo`) → `:3000`. URL actual en
  `journalctl -u cloudflared-aly-saas` (cambia si el servicio se reinicia —
  a futuro conviene túnel con nombre/dominio fijo si el link circula).
- **Verificado:** builds verdes en ambas ramas antes de cada merge; migración
  009 ya aplicada en la VPS; smoke test E2E del engine reiniciado (respondió
  con la identidad comportamental nueva; filas de prueba borradas de
  `users_interactions`); landing y dashboard 200 detrás del túnel (401 sin
  credenciales = basic auth OK).
- **Pendientes que dejó la revisión (menores, no bloquean):** el prompt factual
  default del engine sigue diciendo "Sos el asistente del negocio" y ahora
  convive con el bloque de identidad comportamental que se le antepone — se
  limpia cuando se baje el reencuadre de Daniel; en Programa, si colapsás el
  modo avanzado con pasos sin guardar, el botón/aviso de guardar quedan ocultos.

---

## ✨ Lo que cambió el 2026-07-17 (embeddings / RAG real)

- **pgvector instalado y activo** en esta máquina (Debian, Postgres 17,
  paquete `postgresql-17-pgvector`, extensión 0.8.0 creada en `aly_saas`).
  Re-corrida la migración 001 (idempotente) → ahora existe
  `vector_aly.aly_general_knowledge`.
- **Embeddings vía OpenRouter** (confirmado que su endpoint `/embeddings`
  funciona con la key existente): `openai/text-embedding-3-large` (3072 dims,
  pedido de Daniel: "vamos con lo mejor"; columna `vector(3072)` vía migración
  008, sin índice vectorial — ivfflat/hnsw no soportan >2000 dims, scan exacto).
  Override opcional `OPENROUTER_EMBEDDING_MODEL` — misma variable en web y
  engine, DEBEN coincidir.
- **Indexado al subir** (`apps/web/lib/embeddings.ts`): chunking por párrafos
  (~1500 chars, overlap 200 para párrafos largos tipo PDF) + insert de chunks
  con embedding. Fail-silent total (como enrichment). Cableado en el POST de
  documents; el DELETE limpia los chunks. Backfill idempotente:
  `cd apps/web && bun scripts/backfill-embeddings.ts` (corrido: 3 docs → 18
  chunks; el PDF de 20k chars quedó en 16).
- **Retrieval vectorial en el engine** (`apps/api/src/engine/retrieval.ts` +
  `embeddings.ts` nuevo): embebe la query normalizada y trae TOP_K=8 chunks
  por coseno, respetando el doc-routing (`retrieveContext(wsId, docIds, query)`
  — el pipeline ahora pasa `standalone`). Failsafes en cadena: docs con texto
  sin indexar entran completos; sin key / OpenRouter caído / sin pgvector /
  error → puente de texto plano (Fase 0 intacto como `retrieveFullText`).
- **E2E verificado:** pregunta al PDF (testeo) → 8 chunks por vector, respuesta
  anclada; "¿puedo cancelar una torta?" (la-espiga) → doc-router elige
  `pedidos-espiga.txt` y el vector trae su chunk (sim 0.52); upload nuevo por
  la web indexa solo (catering test: routed + respondido con sim 0.69) y su
  DELETE limpió los chunks. `next build` verde, tsc de ambas apps limpio.
- **Ojo entorno:** en esta máquina el engine corre en **:8081**
  (`API_PORT=8081` en apps/api/.env; el :8080 lo ocupa un uvicorn ajeno) y
  `ENGINE_URL=http://localhost:8081` en apps/web/.env.local.
- **Pendiente inmediato:** commitear TODO (engine Fase 0 + extracción + ruteo
  + embeddings siguen uncommitted).

---

## ✨ Lo que cambió el 2026-07-15 (tarde — testeo de Daniel: extracción + ruteo de docs)

- **Extracción de variables en onboarding** (reporte de Daniel: "Me llamo Daniel"
  quedaba entero como `{nombre}`): nuevo `POST /api/workspaces/[slug]/extract`
  (LLM extrae el valor limpio, failsafe total a la respuesta cruda) +
  `lib/extract-variable.ts`, cableado en los dos runners de flujo
  (`chat-client.tsx` y el preview del builder en `onboarding-client.tsx`).
  El mensaje persistido sigue siendo el crudo; la variable interpolada queda limpia.
- **Ruteo de documentos** (pedido de Daniel, port del doc-routing del librarian
  legacy): migración `007` agrega `documents.routing_hint` ("cuándo consultarlo",
  en lenguaje natural). Se auto-genera al subir (`enrichDocument`) y es editable
  en la Base de Conocimiento (editor inline + `PATCH /documents/[id]`).
  En el engine, `agents.routeDocuments` (doc-router) corre en el fanout en
  paralelo con intent —reemplaza al librarian temático descartado de Fase 0—
  y elige qué docs entran al contexto vía `retrieveContext(wsId, docIds)`.
  Fallbacks: sin hint → usa summary; 0-1 docs → sin LLM call; router falla o
  devuelve [] → todos los docs (comportamiento anterior).
- **E2E verificado** (la-espiga con 2 docs): "puedo cancelar una torta" → solo
  `pedidos-espiga.txt`; "a qué hora abren los domingos" → solo `kb-espiga.txt`
  (ruteó por summary, sin hint). `next build` verde, tsc del engine limpio.
- **Pendiente inmediato:** commitear (extracción + ruteo). Backlog igual que abajo.

---

## ✨ Lo que cambió el 2026-07-15 (chat → engine real, E2E verde)

- **Cableado chat → engine:** `apps/web/lib/engine.ts` (cliente HTTP, `ENGINE_URL`,
  timeout 60s) + la ruta de chat intenta el engine primero y cae a `lib/llm.ts`
  solo si no responde. El engine persiste el par user+assistant por su cuenta
  (la ruta no duplica).
- **Fix crítico en `apps/api/src/config/defaults.ts`:** los prompts default (los
  que usa cualquier workspace nuevo, sin seed) NO tenían los placeholders
  `{user_input}`/`{query}`/`{context}`/`{history}` que `agents.ts` reemplaza —
  el modelo recibía instrucciones sin pregunta y respondía eco. Agregados en
  los 10 prompts (normalize/triage/intent/librarian/factual/plan/ideate/
  sensitive/smalltalk ES+EN).
- **Orden determinista de mensajes:** el engine inserta el par en un solo INSERT
  (mismo `created_at`, `timestamp` +1ms en la fila IA) → `getConversationMessages`
  y el inbox ordenan ahora por `timestamp` con `created_at` de tiebreak.
- **Deps:** `pnpm install` en el root (el clon no tenía node_modules) y
  `bun add @sinclair/typebox` en apps/api (peer de Elysia que faltaba).
- **E2E verificado** (workspace nuevo `la-espiga`, sin seed — puro default):
  upload .txt con enriquecimiento LLM → FACTUAL responde precios/horarios del
  doc → follow-up ("y hasta qué hora ese día?") resuelto por historial →
  IDEATE con ideas ancladas al doc → SMALLTALK → SENSITIVE (triage) con
  respuesta empática → cierre analiza la conversación → fallback con engine
  caído responde igual. `next build` verde.
- **Pendiente inmediato:** commitear todo esto (el engine de Fase 0 del
  2026-07-01 sigue uncommitted + lo de hoy). Luego: parity test formal,
  slot-filling (`collectContext`), streaming token a token desde el engine,
  pgvector (Fase 2).

---

## ✨ Lo que cambió el 2026-06-16 (pulido pre-pitch)

Sesión de consistencia visual y limpieza para el pitch. Sin cambios de
funcionalidad; `next build` verde.

- **WhatsApp restyle:** era la única pantalla en paleta `gray-*` → migrada a
  `neutral-*` para que matchee con el resto; título `text-2xl` → `text-3xl`.
- **Títulos unificados:** las 6 pantallas del workspace usan el mismo
  `text-3xl font-bold tracking-tight` (antes Onboarding/WhatsApp/Settings
  estaban desalineadas). El Dashboard queda en `4xl` a propósito (es el home).
- **Contraste (regla de Daniel: nunca neutral-500 ni muted):** todos los
  `text-neutral-500` → `600` en las 8 pantallas; token `--muted-foreground`
  oscurecido `#71717a` → `#52525b` (afecta CardDescription/DialogDescription/
  placeholders de shadcn).
- **Settings reestructurada:** se quitó el layout anidado (tenía su propio
  `min-h-screen`/`max-w-5xl` dentro del `max-w-4xl` del layout). El botón
  Guardar pasó al header (como Onboarding) y se eliminó la barra fija inferior
  que se montaba sobre el sidebar. Se ocultó el `Workspace ID` crudo (UUID =
  ruido técnico, va contra la visión no-code).
- **Voseo:** Knowledge "Sube documentos" → "Subí".
- **CSS muerto:** eliminadas las utilidades de gradiente/`glass` no usadas
  (CLAUDE: "sin gradientes").
- **DB limpia:** borrado el workspace de prueba `aly-apapachat` (no era seed).
  El dashboard queda con **Demo** + **Apapáchar**.
- **DEMO_CHECKLIST.md actualizado:** describía el mock viejo (botón "Simular
  Conversación" inexistente, "localStorage", "docs mock"). Corregido a chat LLM
  real + onboarding en DB + metadatos por IA; se agregó la sección de
  **Conversaciones + alertas** (faltaba) y nota del puerto variable.

> Nota operativa: el dev de aly-saas suele caer al `3000`, pero si están
> corriendo archetypeSuite/plural-monitor, Next elige `3001`/`3002` — mirar la
> URL que imprime la terminal.

---

## ✨ Lo que cambió el 2026-06-12

- **Chat en streaming:** la respuesta del LLM aparece token a token (SSE de
  OpenRouter → stream `text/plain` al cliente). Si falla antes del primer
  token, error JSON limpio como antes.
- **Markdown en el chat:** los mensajes del asistente renderizan negritas,
  listas y links (`react-markdown` + `remark-gfm`).
- **PDFs ahora se leen:** `extractTextContent` extrae el texto con `unpdf` al
  subir; entra al contexto del chat igual que TXT/MD/CSV (verificado e2e:
  el bot respondió con datos de un PDF subido).
- **Página nueva: Conversaciones** (`/[workspace]/conversations`) — inbox con
  lista de conversaciones (WhatsApp seed + vista previa web), transcript,
  resumen, keywords y flags por severidad. Datos de `users_interactions` +
  `conversations_data` + `users_data`.
- **Migración 004:** seed de conversaciones para el inbox (demo: reclamo con
  flag HIGH; apapachar: 2 usuarios, una conversación abierta y una cerrada
  con análisis).
- **Enriquecimiento automático de documentos:** al subir, un LLM genera
  summary + keywords + tema (columnas nuevas en `documents`, migración 005);
  se ven en la tabla de Conocimiento. El usuario no-code no completa nada.
- **Flagging system definido por el usuario:** card "Sistema de alertas" en
  Conversaciones — reglas en lenguaje natural + severidad (Alta/Media/Baja),
  guardadas en `workspace_configs.flag_rules`. Workspaces nuevos arrancan con
  3 reglas default.
- **Análisis real de conversaciones:** al cerrar el chat preview ("Reiniciar
  Conversación"), el LLM analiza el transcript contra las reglas y escribe
  summary/keywords/flags en `conversations_data` → el inbox ya no depende
  del seed para las conversaciones del preview. Verificado e2e: un reclamo
  de cobro doble generó `HIGH-...` + `MEDIUM-...` correctos.
- **Rebrand + restyle:** el producto ahora se llama **Plural Conversational
  System** (header nuevo con logo "P", se quitó el email demo). UI estilo
  Chatbase: primary negro, sin gradientes, bordes y fondos neutros; el color
  queda solo donde significa algo (estados, severidades, tipos de paso, links).
- **Builder de onboarding renovado (no-code):** edición directa sin modo
  "Editar" (el texto siempre es un textarea), **preview interactiva** que corre
  el flujo de verdad (typing, respuestas de prueba, variables interpoladas,
  aviso si el flujo cambió a mitad de prueba), variables sin jerga ("Guardar
  la respuesta como..." + chips para insertar `{var}` + warning si una
  variable no viene de ninguna pregunta anterior), y guardrails: el paso Fin
  es fijo al final (ni se borra ni se arrastra), pasos nuevos arrancan vacíos
  y no se puede guardar con pasos incompletos (botón con estado dirty).

---

## 🎉 Lo que cambió el 2026-06-11

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
| Knowledge | Upload real (drag&drop y picker), descarga, borrado. PDF/TXT/MD/CSV se inyectan al contexto del chat (PDF vía `unpdf`) |
| Onboarding | El flujo se guarda en `onboarding_flows` (ya no localStorage) |
| Chat | Conversación nueva → corre el flujo de onboarding → después LLM real **en streaming** con markdown. Historial persistido en `users_interactions` |
| Conversaciones | Inbox real sobre `users_interactions`/`conversations_data`: transcript, resumen, keywords, flags (los análisis vienen del seed hasta tener el ConversationCloser) |
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
  hoy el texto (PDF/TXT/MD/CSV) se inyecta directo al prompt, sin embeddings
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
