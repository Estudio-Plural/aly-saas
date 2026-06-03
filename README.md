# Aly SaaS

SaaS multi-tenant platform for customizable AI assistants with RAG capabilities.

## Overview

This monorepo contains:

- **`apps/web`** — Next.js admin dashboard (workspace management, document upload, onboarding builder, analytics)
- **`apps/api`** — Bun + Elysia backend (LangGraph orchestration, RAG, multi-tenant isolation)
- **`packages/shared-types`** — Shared TypeScript types between frontend and backend

## Stack

- **Frontend:** Next.js 16 (App Router), shadcn/ui, Tailwind CSS, @dnd-kit
- **Backend:** Bun, Elysia, LangGraph, Supabase (PostgreSQL + pgvector)
- **Auth:** Clerk
- **Billing:** Stripe
- **Observability:** LangSmith

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Bun 1.1+
- Supabase account

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# Run development servers
pnpm dev
```

This will start:
- Next.js dev server: http://localhost:3000
- Backend API: http://localhost:8080

## Monorepo Structure

```
aly-saas/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Bun backend
├── packages/
│   └── shared-types/ # Shared types
├── supabase/         # Database migrations
└── turbo.json        # Turborepo config
```

## Development

### Running Specific Apps

```bash
# Frontend only
pnpm --filter web dev

# Backend only
pnpm --filter api dev
```

### Building for Production

```bash
pnpm build
```

## Architecture

### Multi-Tenancy

Every workspace is isolated via `workspace_id` column + Row-Level Security (RLS) in Supabase. The backend middleware extracts `workspace_id` from the `X-Workspace-ID` header and enforces isolation at the database level.

### RAG Pipeline

The RAG pipeline uses LangGraph with 12 nodes:
1. **prepare** — Fetch conversation history
2. **triage** — Sensitive content filter
3. **classifyIntent** — FACTUAL/PLAN/IDEATE/SENSITIVE
4. **librarian** — Theme filters
5. **retrieve** — Vector search with keyword pre-filter
6. **factual/plan/ideate/sensitive** — Terminal agents

### Onboarding Builder

Sequential step editor (Question / Message / End) with drag-to-reorder via @dnd-kit and a live chat preview. Steps are serialized to JSON. A visual node-based flow builder with conditional branching is on the Pro roadmap.

## Deployment

- **Frontend:** Vercel
- **Backend:** Docker + VPS (or Railway/Fly.io)
- **Database:** Supabase (managed PostgreSQL)

## Related Repositories

This is a standalone SaaS platform. Legacy clients (Apapáchar, Mexico) continue using:
- [Aly](https://github.com/Estudio-Plural/Aly) — Legacy backend
- [Aly_dashboard](https://github.com/Estudio-Plural/Aly_dashboard) — Legacy Streamlit dashboard
- [aly-evals](https://github.com/Estudio-Plural/aly-evals) — Benchmarking suite
- [aly-weekly-report](https://github.com/Estudio-Plural/aly-weekly-report) — Report orchestrator

## License

Proprietary — Estudio Plural
