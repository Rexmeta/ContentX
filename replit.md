# ContentX

Platform-independent AI Content Engine: users describe a premise in natural language and ContentX generates a structured, editable, versioned Content Graph (characters, organizations, goals, conflicts, events, relationships) that can be exported as canonical JSON or projected to external platforms (RoleplayX today).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/contentx run dev` — run the web frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run test` — run vitest domain tests
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (JSONB for graph payloads)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite + Tailwind + shadcn/ui, wouter, TanStack Query
- Build: esbuild (CJS bundle)

## Where things live

- Rules files: `CONTENTX_FIRST_PROMPT.md`, `AGENTS.md`, `CONTENTX_RULES.md` (repo root) — project constraints; canonical model must stay platform-independent
- API contract: `lib/api-spec/openapi.yaml` (single source of truth)
- DB schema: `lib/db/src/schema/` (`contents`, `content_versions`)
- Domain logic: `artifacts/api-server/src/domains/` (content, validation, ai, projection)
- Routes: `artifacts/api-server/src/routes/content.ts`, `projections.ts`
- Frontend: `artifacts/contentx/src/pages/` (dashboard `/`, workspace `/content/:id`)
- Docs: `docs/architecture.md`, `docs/architecture-assessment.md`, `docs/schema/*.schema.json`, `docs/projections/roleplayx.md`
- Tests: `artifacts/api-server/src/domains/__tests__/`

## Architecture decisions

- Canonical Content Model → Content Graph → Engine → Projection; RoleplayX fields exist ONLY in `roleplayxAdapter.ts`, never in the canonical model.
- Stable prefixed IDs (`content_`, `entity_`, `relationship_`, `version_`) via `shared/id.ts`; array indexes are never identity.
- AI behind `AIProvider` interface; MVP ships a deterministic `MockProvider` (no API key). Pipeline: Generate → Validate → Commit in `orchestrator.ts` — invalid AI output is never persisted.
- Graph stored as one JSONB column per content; versions are immutable JSONB snapshots with a linear `parentVersion` chain (extensible to a DAG).
- Modular monolith inside the shared API server; no graph DB.

## Product

- Dashboard: telemetry, content library, and a two-step creation workflow — idea → AI-amplified dramatic scenario draft (logline, synopsis, theme/stakes/twist, 3 acts, characters; user-editable) → explicit user confirm → Content Graph commit (`POST /v1/scenarios/draft` drafts without persisting; `POST /v1/content` with `scenario` commits; provenance operation `compose`)
- Workspace: entity list by kind, SVG radial graph view, object inspector (edit entities/relationships), validation panel, version snapshots, canonical JSON export, RoleplayX scenario projection

## User preferences

- Communicate with the user in Korean.

## Gotchas

- After editing `openapi.yaml`, always run codegen; the codegen script rewrites the generated Zod file's import to `zod/v4` (orval emits zod-v4 syntax like `zod.int()`), do not remove that sed step.
- Relationship PATCH validates that new source/target entity IDs exist (400 otherwise).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
