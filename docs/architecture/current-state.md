# ContentX — Current State (Architecture Audit)

> **v2 reframe:** this audit's findings (esp. §3 coupling hotspots) are carried
> forward into `docs/architecture-v2.md` and `docs/domain-map-v2.md` §3.

Audited: 2026-08-13. Monorepo: pnpm workspace; API server (Express + Drizzle/Postgres), web app (React + Vite), contract-first OpenAPI → Orval codegen (`@workspace/api-zod`, `@workspace/api-client-react`).

## 1. Canonical data model

Four tables (`lib/db/src/schema/`):

| Table | Shape | Notes |
|---|---|---|
| `contents` | id, title, sourcePrompt, version (current pointer), **graph JSONB**, timestamps | The canonical content graph lives entirely in one JSONB column. No normalized entity/relationship tables, no FKs. |
| `content_versions` | id, contentId (no FK), version, parentVersion, note, author, **snapshot JSONB** | Immutable-by-convention full snapshots; unique(contentId, version). |
| `scenarios` | id, title, idea, **scenario JSONB** (DramaticScenario), classification JSONB, lineage JSONB, timestamps | First-class library asset; no relation to `contents`. |
| `categories` | id, axis (domain/conflictType/tone), name, origin (seed/auto) | Classification catalog, auto-extending. |

Graph types (`artifacts/api-server/src/domains/content/model.ts`): Entity `{id, kind, name, description?, attributes?}` with 17 kinds (character…world); Relationship `{id, source, type, target, attributes?}`; Provenance embedded in the graph JSONB (operation, source*, generatedByProvider/Model, sourceContentIds, synthesis lineage).

## 2. Domain boundaries (as implemented)

- `domains/content` — graph model, repository, service (creation, edits, validation, export, dashboard). Service directly imports the AI orchestrator.
- `domains/ai` — provider abstraction (`provider.ts`, used only for graph generation), mock provider, LLM amplifier, deterministic scenario amplifier (owns `DramaticScenario` types), scenario→graph builder, orchestrator (generate→validate→commit + completeness checks).
- `domains/scenario` — repository, LLM synthesizer (owns `Lineage` types), lineage validation, taxonomy/classifier/classification/category services.
- `domains/validation` — pure structural graph validator.
- `domains/projection` — RoleplayX adapter (canonical graph → roleplay JSON, carries sourceContentId/version).

## 3. Coupling hotspots

1. **Content model depends on scenario domain**: `content/model.ts` imports `Lineage` from `scenario/synthesizer`. Latent cycle: content → ai → content model; content model → scenario → OpenAI.
2. **AI domain owns domain concepts**: `DramaticScenario` types live in `ai/scenarioAmplifier`; `scenarioGraphBuilder` (scenario→canonical mapping) also lives in `ai/`. AI is a pipeline owner, not an adapter.
3. **Provider abstraction is incomplete**: amplifier, synthesizer, classifier each import the OpenAI client directly with a hardcoded model id; only graph generation goes through `AIProvider`.
4. **Routes cross domains**: `routes/content.ts` validates scenario lineage; `routes/scenarios.ts` coordinates AI + persistence + classification + synthesis.
5. **Scenario is the de-facto entry point**: the dashboard gates graph creation behind a scenario draft; the product flow is idea → scenario → graph, making Scenario effectively the top-level object (violates target rule §25).

## 4. Provenance & versioning

- Graph provenance is JSONB-embedded, written at creation; content updates mutate the current graph and bump the version pointer; snapshots are explicit. No audit-event table, no FK integrity.
- Scenario provenance: `idea`, `amplifiedBy`, `classification.classifiedBy`, `lineage` (server-authoritative, re-validated on save and on graph creation). Scenarios have no version history (in-place updates).
- Reproducibility: none of seed/schemaVersion/dependencyVersion exist; LLM outputs are non-deterministic and unversioned beyond model id strings.

## 5. What does not exist yet (vs. target)

No Population, Dimension, DependencyRule, Sampler, Character (as a structured first-class domain — characters are flat graph entities), CharacterSnapshot, Agent, AgentState, Goal/Constraint models, Environment, Simulation, InteractionEvent trace, or Evaluation abstraction. Projection layer exists only as the single RoleplayX adapter.

## 6. Strengths worth keeping

- Contract-first OpenAPI → codegen pipeline with Zod validation on every route (no silent fallbacks).
- Canonical graph + immutable version snapshots + provenance already embedded in the culture of the codebase.
- Server-authoritative lineage (anti-forgery) and validation layers (schema + graph consistency).
- Thin, testable domain services with injected mock AI for tests; solid route-level integration tests.
- RoleplayX correctly positioned as a downstream projection.
