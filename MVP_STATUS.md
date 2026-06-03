# MVP Status - Aly SaaS

**Última actualización:** 2026-06-01 14:30 PM

## ✅ Completado Hoy

### 1. Infraestructura Base
- ✅ Repo creado en `Estudio-Plural/aly-saas`
- ✅ Monorepo con pnpm workspaces + Turborepo
- ✅ Estructura: `apps/web/` (Next.js), `apps/api/` (Bun - scaffold), `packages/shared-types/`
- ✅ shadcn/ui configurado con preset Nova (10 componentes base)

### 2. Base de Datos
- ✅ Migración ejecutada en Supabase de agentChatBuilder
- ✅ 9 tablas creadas con multi-tenancy:
  - `workspaces` (core)
  - `workspace_users` (equipos)
  - `workspace_configs` (prompts/categories/models customizables)
  - `onboarding_flows` (flujos de onboarding, JSONB)
  - `onboarding_sessions` (runtime state)
  - `users_data` (usuarios finales WhatsApp)
  - `users_interactions` (historial conversaciones)
  - `conversations_data` (análisis + flags)
  - `vector_aly.aly_general_knowledge` (RAG embeddings)
- ✅ RLS (Row-Level Security) habilitado para aislamiento por workspace
- ✅ Workspace demo creado automáticamente

### 3. Frontend Funcional
- ✅ **Dashboard** (`/dashboard`)
  - Grid de workspaces con stats (docs, users, chats)
  - Dialog "Crear Asistente" con form
  - Mock data de 2 workspaces: Demo y Apapáchar
  
- ✅ **Settings Page** (`/[workspace]/settings`)
  - Layout con sidebar de navegación (5 secciones)
  - Form editable: nombre workspace, slug, nombre asistente
  - Preview en tiempo real del chat con el asistente
  - Sección de suscripción (Trial/Pro)
  - Botones Guardar/Eliminar

- ✅ **Knowledge Base** (`/[workspace]/knowledge`)
  - Área drag & drop para upload de documentos
  - Tabla con docs mock (PDF, TXT, MD)
  - Botones descargar/eliminar por documento
  - Info card explicando RAG

- ✅ **Onboarding Builder** (`/[workspace]/onboarding`) ⭐
  - Editor secuencial de pasos (2 columnas: editor + preview en vivo)
  - 3 tipos de paso: Pregunta (azul), Mensaje (verde), Fin (morado)
  - Drag & drop para reordenar pasos (@dnd-kit)
  - Edición inline + variables ({name}, {email})
  - Guardar a localStorage
  - Flujo inicial pre-cargado (3 pasos)

- ✅ **Chat Preview** (`/[workspace]/chat`)
  - UI estilo chat (azul + blanco)
  - Input funcional + respuestas mock
  - Botón "Simular Conversación" automático
  - Typing indicator animado
  - Auto-scroll

- ✅ **WhatsApp Connection** (`/[workspace]/whatsapp`)
  - 4 estados: disconnected, connecting, connected, error
  - Mock QR code scan flow
  - Display de número conectado
  - Stats de mensajes (cuando conectado)
  - Info de Kapso integration

- ✅ **UI/UX Pulida**
  - Contraste mejorado en todos los textos
  - Cards con hover states
  - Headers con breadcrumbs
  - Badges de estado (Trial/Activo)
  - Sidebar con active state highlighting

### 4. Configuración
- ✅ Supabase credentials en `.env.local`
- ✅ TypeScript types compartidos en `packages/shared-types`
- ✅ Aliases configurados (`@/components`, `@/lib`)

## 🔧 Cómo Correr Localmente

```bash
# Terminal 1 - Frontend
cd /Users/daniel/Documents/Dev/aly-saas/apps/web
npx next dev
# → http://localhost:3000

# Terminal 2 - Backend (cuando esté listo)
cd /Users/daniel/Documents/Dev/aly-saas/apps/api
bun run dev
# → http://localhost:8080
```

## 📊 Demo Flow Completo

1. **Dashboard** (`http://localhost:3000/dashboard`)
   - Ver 2 workspaces: Demo y Apapáchar
   - Click en "Demo" para entrar

2. **Settings** (`/demo/settings`)
   - Editar nombre del asistente → preview actualiza en vivo
   - Mostrar sección de billing (Trial activo)

3. **Knowledge Base** (`/demo/knowledge`)
   - Ver tabla con 4 docs mock
   - Drag & drop area para upload
   - Explicar RAG con info card

4. **Onboarding Builder** (`/demo/onboarding`) ⭐ WOW FACTOR
   - Mostrar flujo inicial (3 pasos) + preview en vivo
   - Click en "Editar" para cambiar texto/variable
   - Agregar paso (Pregunta/Mensaje/Fin)
   - Arrastrar ⋮⋮ para reordenar
   - Guardar

5. **Chat Preview** (`/demo/chat`)
   - Escribir mensaje manual
   - Click "Simular Conversación"
   - Ver typing indicators + respuestas

6. **WhatsApp** (`/demo/whatsapp`)
   - Click "Conectar WhatsApp Business"
   - Ver QR mock + instrucciones
   - Estado cambia a "Conectado" después de 5s
   - Ver stats de mensajes

## 🎯 MVP Demo — COMPLETADO ✅

Todas las páginas necesarias para el pitch a CEOs están listas:
- ✅ Dashboard con selector de workspaces
- ✅ Settings con preview en tiempo real
- ✅ Knowledge Base con upload UI
- ✅ Onboarding Builder (wow factor) ⭐
- ✅ Chat Preview estilo WhatsApp
- ✅ WhatsApp Connection con Kapso flow

**Demo flow completo:** Dashboard → Settings → Knowledge → Onboarding → Chat → WhatsApp

## 📄 Documentación de Pitch

- ✅ **PITCH_SCRIPT.md** — Guión completo 15-20 min con:
  - Opening hook + problema/solución
  - Walkthrough de las 5 páginas
  - Pricing & business model (94% margen)
  - Manejo de 6 objeciones comunes
  - Tips de presentación

- ✅ **KAPSO_INTEGRATION.md** — Arquitectura técnica:
  - Cómo integrar Kapso (Platform API)
  - Código de webhooks + chat service
  - Schema de Supabase (migración 002)
  - Modelo de negocio ($0.047 margen/mensaje)

## 🚀 Próximos Pasos (Post-Funding)

4. **Backend Multi-Tenant Real**
   - Adaptar `Aly/` existente o construir `apps/api/`
   - Middleware de workspace isolation
   - WorkspaceConfigService (prompts dinámicos)
   - Endpoints: GET/PUT workspace, POST documents, POST onboarding

5. **Clerk Auth**
   - Login/Signup real
   - Workspace ownership
   - Invitar usuarios a workspaces

6. **Stripe Billing**
   - Checkout flow
   - Webhook handlers
   - Rate limiting por plan

7. **Conectar Frontend → Backend Real**
   - Reemplazar todos los `// TODO: Implementar con Supabase`
   - Queries reales con `@supabase/ssr`
   - Optimistic updates

## 📁 Estructura de Archivos Clave

```
aly-saas/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── dashboard/page.tsx           # ✅ Selector de workspaces
│   │   │   ├── [workspace]/
│   │   │   │   ├── layout.tsx               # ✅ Sidebar navigation
│   │   │   │   ├── settings/page.tsx        # ✅ Settings form
│   │   │   │   ├── knowledge/               # 🔲 TODO
│   │   │   │   ├── onboarding/              # 🔲 TODO
│   │   │   │   └── chat/                    # 🔲 TODO
│   │   ├── components/ui/                   # ✅ shadcn components
│   │   └── lib/utils.ts                     # ✅ cn() helper
│   │
│   └── api/                                  # 🔲 Scaffold (no implementado)
│       ├── src/
│       ├── package.json
│       └── .env.example
│
├── packages/
│   └── shared-types/src/index.ts            # ✅ TypeScript types
│
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql           # ✅ Ejecutada en TablePlus
```

## 🗄️ Supabase

**Proyecto:** agentChatBuilder  
**URL:** https://lroiqesjdmocmawtazhd.supabase.co  
**Credenciales:** En `/Users/daniel/Documents/Dev/agentChatBuilder/.env`

### Verificar Tablas

```sql
-- En TablePlus
SELECT * FROM workspaces WHERE slug = 'demo';
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

## 🎯 Pitch a CEOs

### Lo que tenés para mostrar:

1. **Dashboard visual** → múltiples asistentes en un solo lugar
2. **Customización fácil** → cambiar nombre en 3 clicks
3. **Preview en tiempo real** → ven cómo se ve antes de publicar

### Lo que falta implementar (mencionar como roadmap):

4. **Upload de docs** → "Acá subís PDFs y el bot aprende de tu conocimiento"
5. **Builder de onboarding** → "Con drag & drop podés crear flujos conversacionales sin código"
6. **Analytics** → "Dashboard con métricas de uso"

### Pitch Line:

> "Convertí tu conocimiento en un asistente de IA personalizado en minutos. Sin código, sin setup técnico, multi-tenant desde día 1."

## 🐛 Issues Conocidos

- ⚠️ `pnpm dev` falla por build scripts bloqueados → usar `npx next dev` directo
- ⚠️ Hay 2 `pnpm-workspace.yaml` (uno en root, uno en apps/web) → borrar el de apps/web
- ⚠️ Mock data hardcoded → no conecta a Supabase todavía

## 📞 Contacto

- Repo: https://github.com/Estudio-Plural/aly-saas
- Owner: Daniel (Rodato)
- Basado en: Aly (legacy) + agentChatBuilder patterns
