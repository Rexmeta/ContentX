# ContentX — Architecture Assessment

Date: 2026-08-12

## 1. Current project structure (as inspected before building)

The repository is a pnpm monorepo starter (not empty, not an existing app):

```text
artifacts/
  api-server/        Express 5 API server (shared backend, /api prefix)
  mockup-sandbox/    Design/canvas sandbox (not part of ContentX runtime)
  contentx/          React + Vite frontend (created for ContentX)
lib/
  api-spec/          OpenAPI 3.1 spec (single source of truth) + Orval codegen
  api-client-react/  Generated React Query hooks
  api-zod/           Generated Zod validation schemas
  db/                Drizzle ORM client + schema
scripts/             Utility scripts
docs/                Architecture + schema documentation (this work)
```

## 2. Current tech stack

- TypeScript 5.9 (strict), Node.js 24, pnpm workspaces
- Backend: Express 5, pino logging, esbuild bundle
- DB: PostgreSQL (pre-provisioned) + Drizzle ORM, JSONB available
- Contract: OpenAPI 3.1 → Orval codegen → React Query hooks + Zod schemas
- Frontend: React 18 + Vite + Tailwind + shadcn/ui, wouter routing

## 3. Reusable components

- The contract-first OpenAPI → codegen pipeline (kept, used as the API boundary)
- The shared Express API server and its logging/middleware setup (kept)
- The Drizzle + PostgreSQL layer (kept; JSONB used for the Content Graph)
- The scaffolded React app shell (kept; UI built on it)

## 4. Problems / risks

- The starter had no domain code — everything ContentX-specific was net-new.
- Generated Zod output required a `zod/v4` import fix (patched into the codegen script).
- JSONB graph storage means graph-wide queries (e.g. "all conflicts across contents")
  scan JSON; acceptable for MVP, revisit with indexes or extracted tables if needed.

## 5. Structure needed for ContentX (implemented)

Modular monolith inside the existing API server:

```text
artifacts/api-server/src/
  domains/
    content/      model.ts (canonical types), repository.ts, service.ts
    validation/   validator.ts (schema / references / duplicates checks)
    ai/           provider.ts (AIProvider interface), mockProvider.ts, orchestrator.ts
    projection/   roleplayxAdapter.ts
  routes/         content.ts, projections.ts (thin handlers, /api/v1/...)
  shared/         id.ts (stable prefixed IDs)
```

Flow: UI → API (/api/v1) → domain service → repository → PostgreSQL.

## 6. Code kept untouched

- `artifacts/mockup-sandbox/` (design sandbox, unrelated)
- `artifacts/api-server/src/app.ts`, `lib/logger.ts`, health route
- `lib/api-client-react/src/custom-fetch.ts`, Orval config (except codegen script fix)
- Root TypeScript/workspace configuration

## 7. Code modified

- `lib/api-spec/openapi.yaml` — ContentX API contract added
- `lib/api-spec/package.json` — codegen script patched for zod/v4 import
- `lib/db/src/schema/` — `contents`, `content_versions` tables added
- `artifacts/api-server/src/routes/index.ts` — new routers mounted
- `artifacts/contentx/` — frontend implementation

## 8. Migration risks (future)

- **Graph scale**: very large graphs in one JSONB blob will need pagination or
  per-entity rows; the repository layer isolates that change.
- **Semantic search**: pgvector must be enabled when semantic search lands;
  plan an `embeddings` table keyed by stable entity IDs.
- **Branch/fork versioning**: current linear `parentVersion` chain extends to a
  DAG without schema breakage (columns already exist).
- **Real AI providers**: swap `MockProvider` behind `AIProvider`; the
  Generate → Validate → Commit pipeline already guards bad structured output.

## Open Decisions

- Attribute schema per entity kind is intentionally free-form (`attributes` object)
  for MVP; a typed per-kind attribute registry is a candidate for Phase 2.
- Version snapshots capture the pre-existing state at snapshot time; automatic
  snapshot-on-every-edit was deferred to keep history meaningful.
