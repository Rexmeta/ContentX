# ContentX Architecture

> **v2 reframe:** the product is now framed as an output-first AI Creative
> Content Engine — see `docs/architecture-v2.md` (framing, six engines) and
> `docs/domain-map-v2.md` (domain → source map). This document remains
> accurate for the canonical-model core described below.

ContentX is a platform-independent AI Content Engine. Canonical structured
content is created, edited, validated, versioned, exported, and projected to
external platforms. RoleplayX is one downstream projection target, never the
canonical model.

## Core principle

```text
Canonical Content Model
        ↓
Content Graph
        ↓
Content Engine (services)
        ↓
Projection / Adapter
        ↓
External Platform (RoleplayX, Movie, Novel, Game, ...)
```

## Modular monolith layout

```text
artifacts/api-server/src/
  domains/
    content/
      model.ts        Canonical Content Model types (platform independent)
      repository.ts   Persistence boundary (Drizzle → PostgreSQL JSONB)
      service.ts      Use-cases: create, edit, validate, version, export
    validation/
      validator.ts    Pure graph validation (schema, refs, duplicates)
    ai/
      provider.ts     AIProvider interface (provider-agnostic)
      mockProvider.ts Deterministic mock provider (no API key required)
      orchestrator.ts ContentOrchestrator — Generate → Validate → Commit
    projection/
      roleplayxAdapter.ts  Canonical → RoleplayX Scenario JSON
  routes/             Thin Express handlers implementing /api/v1/...
  shared/id.ts        Stable prefixed IDs (entity_, relationship_, ...)
```

Domain boundaries reserved for later phases: asset, search, publication,
integration, event/narrative as dedicated modules (today events and
narratives are entity kinds inside the graph).

## Data flow

```text
UI (React) → API /api/v1 → domain service → repository → PostgreSQL
```

- React components never touch the DB; they call generated React Query hooks.
- All request/response payloads are validated with generated Zod schemas.
- The OpenAPI spec (`lib/api-spec/openapi.yaml`) is the single contract.

## Canonical Content Model

- `Entity { id, kind, name, description?, attributes{} }` — kinds cover the
  primitives: character, organization, location, object, event, concept,
  theme, goal, conflict, emotion, action, dialogue, narrative, rule,
  constraint, outcome, world.
- `Relationship { id, source, type, target, attributes{} }` — first-class
  objects, never strings buried in prose.
- `Provenance { operation, createdAt, source*, generatedBy* }` — preserved on
  generation and future remix/transform operations.
- Every object has a stable prefixed ID; array indexes are never identity.

JSON Schemas: `docs/schema/*.schema.json`.

## Persistence

PostgreSQL, two tables:

- `contents` — current graph per content (`graph` JSONB), `version` counter.
- `content_versions` — immutable snapshots (`snapshot` JSONB) with
  `parentVersion` chain (extensible to branch/fork DAG).

No graph database; the repository layer isolates storage so a graph
projection can be added later if a demonstrated query requirement appears.
pgvector will be enabled when semantic search lands.

## AI layer

`ContentOrchestrator` is the explicit AI boundary. MVP implements
Generate → Validate → Commit; Planner/Extractor/Composer/Transformer/
Critic/Repairer are future modules behind the same boundary. Providers are
abstracted behind `AIProvider`; the MVP ships a deterministic `MockProvider`
so no API key is required. Raw provider output is never persisted without
schema and reference validation.

## Projection

`projectToRoleplayX` (see `docs/projections/roleplayx.md`) maps canonical
objects to RoleplayX `context / playerRole / objectives / successCriteria /
personas / recommendedFlow`. Projection code depends on the canonical model;
nothing in the canonical model depends on RoleplayX.

## API

```text
GET    /api/v1/content
POST   /api/v1/content                      (prompt → generated graph)
GET    /api/v1/content/:id
DELETE /api/v1/content/:id
PATCH  /api/v1/content/:id/entities/:entityId
PATCH  /api/v1/content/:id/relationships/:relationshipId
POST   /api/v1/content/:id/validate
GET    /api/v1/content/:id/versions
POST   /api/v1/content/:id/versions
GET    /api/v1/content/:id/export           (canonical JSON)
GET    /api/v1/projections/roleplayx/:id    (RoleplayX Scenario JSON)
GET    /api/v1/dashboard/summary
```

## Testing

Vitest suites in `artifacts/api-server/src/domains/__tests__/` cover schema
validation, reference integrity, duplicate IDs, the mock generation pipeline,
provenance preservation, canonical export shape, and the RoleplayX adapter.
Fixtures live alongside the tests.

## Open Decisions

- Per-kind typed attribute schemas (Phase 2).
- Remix operation (Content A + B + constraints → new graph with provenance)
  is designed for (provenance.sourceContentIds) but not yet exposed as an API.
- Branch/fork/merge versioning beyond the linear parentVersion chain.
