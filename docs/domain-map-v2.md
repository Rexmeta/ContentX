# ContentX Domain Map v2 — v2 Domains → Existing Source

> Companion to `docs/architecture-v2.md`. Maps each Architecture v2 domain to
> the concrete files that implement (or seed) it today, with status, gaps,
> conflicts, and a recommended implementation order.
>
> Paths are relative to `artifacts/api-server/src/` unless noted.
> Status legend: ✅ implemented · 🟡 partial/foundation exists · ❌ missing.

## 1. Domain → source map

### Output (Output Engine) — 🟡

| Concern | Files |
|---|---|
| Intent → output type → workflow plan | `domains/workflow/model.ts` (`OutputIntent`, `WorkflowStep`), `domains/workflow/planner.ts`, `domains/workflow/templates.ts` |
| Workflow execution & persistence | `domains/workflow/executor.ts`, `repository.ts`, `validation.ts`; `routes/workflows.ts` |
| UI | `artifacts/contentx/src/pages/home.tsx` (create entry point), `workflows/detail.tsx`, `workflows/list.tsx` |
| Design source | `docs/ux/output-workflow-map.md` |

Missing: benchmark/evaluation steps in templates; some output types are
UI-listed but not executable end-to-end (movie/game/ad projections).

### Reference (Reference Engine) — 🟡

| Concern | Files |
|---|---|
| MatrAIx import intake | `domains/import/matraixModel.ts`, `matraixImporter.ts`, `matraixService.ts`, `graphDiff.ts` |
| Import → population bridge | `domains/import/populationBridge.ts` |
| Library as reference pool | `domains/scenario/repository.ts`, `domains/content/repository.ts`; `GET /v1/scenarios`, `GET /v1/content` |
| Similar-content lookup | `GET /v1/scenarios/:id/similar` (`routes/scenarios.ts`) |

Missing: a Reference concept as such (any content selected *as creative
input*, with license/source metadata); URL/text/file import; upload UI.

### Benchmark (Benchmark Engine) — 🟡 (foundation only)

| Concern | Files |
|---|---|
| Classification (foundation) | `domains/scenario/classifier.ts`, `classificationService.ts`, `taxonomy.ts`, `categoryService.ts`; `categories` table (`lib/db/src/schema/`) |
| Grouping signal | `GET /v1/scenarios/:id/similar` |

Missing: pattern extraction across a classified set; group-level benchmark
profiles; benchmark → generation constraints feed into draft/remix prompts.

### Creative (Creative Engine: idea → story → content) — ✅ (scenario-shaped)

| Concern | Files |
|---|---|
| Idea → story amplification | `domains/ai/llmAmplifier.ts`, `mockAmplifier.ts`; `POST /v1/scenarios/draft` |
| Scenario domain model | `domains/scenario/model.ts` (`DramaticScenario`) |
| Story → canonical graph | `domains/scenario/graphBuilder.ts`; `POST /v1/content` with `scenario` |
| Generate-graph pipeline | `domains/ai/orchestrator.ts` (Generate → Validate → Commit) |

Gap: generation is scenario-shaped only; no persona-seeded or
benchmark-constrained generation. Conflict: `DramaticScenario` types live in
`domains/ai/` (see §3).

### Remix (Remix Engine) — 🟡 (scenario-specialized)

| Concern | Files |
|---|---|
| Element synthesis | `domains/scenario/synthesizer.ts`; `POST /v1/scenarios/synthesize` |
| Bridge remix | `domains/scenario/bridge.ts`; `POST /v1/scenarios/bridge` |
| Server-authoritative lineage | `domains/scenario/lineageService.ts`, `shared/lineage.ts` |
| UI | `artifacts/contentx/src/pages/world.tsx`; `docs/ux/bridge-remix.md` |

Missing: remix over canonical Content graphs and the wider element vocabulary
(personas, relationships, goals, events, endings, …); remix-quality
evaluation.

### Persona — 🟡

| Concern | Files |
|---|---|
| Structured Character (backing model) | `domains/character/model.ts`, `repository.ts`, `service.ts`, `attributeValidator.ts` |
| Immutable snapshots | `domains/character/snapshotModel.ts`, `snapshotRepository.ts`, `snapshotService.ts` |
| Persona sources | `domains/population/*` (sampling), `domains/import/populationBridge.ts` (MatrAIx personas) |
| Persona in stories | `character` entities in content graphs; `characters[]` in `DramaticScenario`; RoleplayX `personas` in `domains/projection/roleplayxAdapter.ts` |

Missing: the minimal reuse abstraction — casting an existing
Character/persona into a new Story/Scenario/Remix by reference with
provenance. (Per target-state decision #2: Character > Persona; no parallel
identity system, no full MatrAIx schema.)

### Content (Canonical Content Model / Creative Graph) — ✅

| Concern | Files |
|---|---|
| Model | `domains/content/model.ts` (Entity/Relationship/Provenance/GraphPayload) |
| Persistence & versions | `domains/content/repository.ts`; `contents`, `content_versions` (`lib/db/src/schema/`) |
| Use-cases | `domains/content/service.ts`; `routes/content.ts` |
| Contract | `lib/api-spec/openapi.yaml`; `docs/schema/*.schema.json` |

### Scenario (one output type) — ✅

| Concern | Files |
|---|---|
| Model + persistence | `domains/scenario/model.ts`, `repository.ts`; `scenarios` table |
| CRUD/classify/similar | `routes/scenarios.ts` |
| Library UI | `artifacts/contentx/src/pages/world.tsx` |

Conflict: product flow still treats Scenario as the entry point (see §3).

### Evaluation (Evaluation Engine) — 🟡

| Concern | Files |
|---|---|
| Model + kinds (behavior/personaFidelity/outcome) | `domains/evaluation/model.ts`, `evaluators.ts`, `service.ts`, `repository.ts` |
| Evidence lineage | `domains/evaluation/lineageService.ts`; `GET /v1/evaluations/:id/lineage` |
| Structural validation (separate!) | `domains/validation/validator.ts`; `POST /v1/content/:id/validate` |

Missing: creative-quality kinds (requirement compliance, narrative/persona
consistency, structural quality, source similarity, creative independence,
remix coherence) applied to generated/remixed content.

### Provenance — ✅ (extend)

| Concern | Files |
|---|---|
| Graph provenance | `domains/content/model.ts` (`Provenance`), embedded JSONB |
| Remix lineage | `shared/lineage.ts`, `domains/scenario/lineageService.ts` |
| Simulation-chain provenance | population/sampling/snapshot/agent/simulation/evaluation models; `docs/architecture/trust-model.md` |
| IDs | `shared/id.ts` |

Missing: rights/license metadata on sources; provenance backfill for legacy
characters (task exists); persisted projection records.

### Projection — ✅

| Concern | Files |
|---|---|
| Contract + dispatch | `domains/projection/contract.ts`, `service.ts` |
| Adapters | `roleplayxAdapter.ts`, `novelAdapter.ts`, `businessAdapter.ts` |
| Routes | `routes/projections.ts` (`POST /v1/projections`, `GET /v1/projections/roleplayx/:id`) |

Missing: movie/game/ad adapters (identified in `docs/ux/output-workflow-map.md`).

### Supporting (not a v2 engine, feeds them)

Population/sampling: `domains/population/*` · Agents/simulation:
`domains/agent/*`, `domains/simulation/*`; `routes/populations.ts`,
`characters.ts`, `agents.ts`, `simulations.ts`. Role in v2: persona supply +
behavioral reference/evaluation evidence (product-reaction outputs).

## 2. Current implementation status (summary)

| v2 domain | Status |
|---|---|
| Content / Creative Graph | ✅ canonical, versioned, provenance-carrying |
| Projection | ✅ 3 adapters, stateless, provenance chain |
| Scenario | ✅ full library (draft/classify/synthesize/bridge/lineage) |
| Provenance | ✅ core; extend with rights metadata |
| Creative (generate) | ✅ but scenario-shaped only |
| Output (workflows) | 🟡 planner/executor/templates exist; several output types not end-to-end |
| Remix | 🟡 scenario-element remix only |
| Evaluation | 🟡 simulation-side only; no creative-quality kinds |
| Persona | 🟡 Character domain exists; no reuse/casting abstraction |
| Reference | 🟡 MatrAIx import + library; no Reference concept or general intake |
| Benchmark | 🟡 classification foundation only; no pattern extraction/benchmark profiles |
| Search | ❌ beyond list/similar; no semantic search (pgvector planned) |
| Trust Layer (v2 additions) | ❌ rights/license metadata, creative-independence analysis |

## 3. Architecture conflicts (known, unresolved)

From `docs/architecture/current-state.md` §3 — all still relevant to v2:

1. `content/model.ts` imports `Lineage` from the scenario domain (via
   `shared/lineage.ts` today; the element vocabulary is still
   scenario-specific) — Remix generalization must lift elements to
   content-level concepts.
2. `DramaticScenario` and `graphBuilder` concerns live under `domains/ai/` /
   scenario ownership blur — AI should be adapters (target-state decision),
   Creative Engine should own story types.
3. Amplifier/synthesizer/classifier call `ai/llmClient.ts` directly with a
   fixed model id instead of going through `AIProvider` — provider abstraction
   incomplete.
4. Routes coordinate across domains (`routes/scenarios.ts` mixes AI +
   persistence + classification + synthesis).
5. **Scenario is the de-facto UI entry point** (dashboard flow: idea →
   scenario → graph) — the central v2 product conflict; resolved by making the
   Creative Workspace/workflow flow primary (documented in
   `docs/architecture-v2.md` §UI).

## 4. Recommended next implementation order

1. **Output Engine as the front door** — make the workflow/intent flow the
   primary UX; Scenario Library becomes a reference/library surface. (Resolves
   conflict #5; mostly UI/navigation, no schema change.)
2. **Reference selection step** — let workflows take existing
   content/scenarios as explicit references with provenance (small, unblocks
   Benchmark and better Remix).
3. **Remix generalization, phase 1** — widen the element vocabulary and let
   synthesis read from canonical Content (not just `DramaticScenario`),
   keeping server-authoritative lineage.
4. **Benchmark phase 1** — aggregate classifications of a selected reference
   set into a group profile ("pattern report") and feed it into draft prompts
   as generation constraints.
5. **Creative-quality Evaluation kinds** — requirement compliance + narrative
   consistency on generated/remixed content, reusing the evaluation model.
6. **Persona reuse abstraction** — cast an existing Character into a new
   story/remix by reference.
7. **Trust Layer metadata** — license/rights fields on references; creative
   independence as an evaluation kind (advisory only, never legal clearance).

Deliberately **not yet**: full MatrAIx persona schema, graph DB, microservices,
multi-agent swarm, marketplace, media generation, complete legal engine, new
Creative Workspace UI build (identified only).
