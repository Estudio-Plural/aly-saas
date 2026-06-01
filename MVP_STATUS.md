# MVP Status - Aly SaaS

**Última actualización:** 2026-06-01 12:00 PM

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
  - `onboarding_flows` (React Flow graphs)
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
  - Layout con sidebar de navegación (General, Conocimiento, Onboarding, Chat)
  - Form editable: nombre workspace, slug, nombre asistente
  - Preview en tiempo real del chat con el asistente
  - Sección de suscripción (Trial/Pro)
  - Botones Guardar/Eliminar

- ✅ **UI/UX Pulida**
  - Contraste mejorado en todos los textos
  - Cards con hover states
  - Headers con breadcrumbs
  - Badges de estado (Trial/Activo)

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

## 📊 Demo Flow Actual

1. Ir a `http://localhost:3000`
2. Redirige a `/dashboard`
3. Ver 2 workspaces: Demo y Apapáchar
4. Click en cualquier card → `/demo/settings` o `/apapachar/settings`
5. Editar nombre del asistente → ver preview actualizado en tiempo real
6. Click "Guardar" → simula guardado (log en consola)

## 🚀 Próximos Pasos (Orden Sugerido)

### Para el MVP Demo a CEOs

1. **Knowledge Base UI** (1-2 horas)
   - Página `/[workspace]/knowledge`
   - Upload de documentos (.md, .txt, .pdf)
   - Tabla con docs subidos
   - Botón eliminar documento
   - Mock: mostrar lista de docs, simular upload

2. **Onboarding Builder Visual** (2-3 horas)
   - Página `/[workspace]/onboarding`
   - React Flow canvas con drag & drop
   - Node palette: Input, Conditional, Action, Complete
   - Save/Load flow (mock en localStorage)
   - **Este es el "wow factor" para el pitch**

3. **Chat Preview** (1 hora)
   - Página `/[workspace]/chat`
   - UI de chat simple con mensajes mock
   - Mostrar cómo se ve el asistente con su nombre customizado
   - Opcional: simular respuestas con delay

### Para Producción (Post-Funding)

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
