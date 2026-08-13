# ContentX — Migration Plan (Current → Target)

Philosophy: clean architecture over backward compatibility. Early-stage project; remove/replace/split/rename freely. Modular monolith, contract-first (OpenAPI → codegen) stays.

## KEEP

- Contract-first pipeline: `lib/api-spec/openapi.yaml` → Orval → `@workspace/api-zod` + `@workspace/api-client-react` (incl. the `zod/v4` sed step).
- Canonical graph + `content_versions` immutable snapshots + embedded provenance.
- `domains/validation/validator.ts` (extend, don't replace).
- Server-authoritative lineage validation pattern (generalize into graph provenance).
- Route conventions (zod safeParse → 400; response `.parse()`; explicit errors, no silent fallbacks) and the route integration test harness.
- `domains/projection/roleplayxAdapter.ts` as the model for all projection adapters.
- Workspace UI (graph view, versions, export) — extend for new entity kinds.

## MODIFY

- `Entity` model: add kinds (person, value, trait, capability, population), `canonicalName` + `aliases`, typed attribute envelope.
- `Provenance`: add chain support (parent operations), schemaVersion, seed where applicable.
- `orchestrator`: reduce to a thin generate→validate→commit pipeline over a task-based AI layer (extract/generate/transform/plan/critic/repair).
- Dashboard: scenario flow becomes one of several entry points (population/world-first flows added later); do not gate graph creation on scenario drafts.

## MOVE / RENAME

- `DramaticScenario` types: `domains/ai/scenarioAmplifier.ts` → `domains/scenario/model.ts` (scenario domain owns its types; AI only adapts).
- `scenarioGraphBuilder.ts`: `domains/ai/` → `domains/scenario/` (it is a scenario→canonical mapping, i.e., projection-inward logic, not AI).
- `Lineage` types: out of `synthesizer.ts` into `domains/scenario/lineage.ts`; `content/model.ts` must import from a neutral shared type, not the synthesizer (breaks content→scenario→OpenAI edge).
- Direct OpenAI calls in `llmAmplifier`/`synthesizer`/`classifier` → route through a single provider adapter in `domains/ai/` (model id configured in one place).

## DEPRECATE / DELETE

- Nothing deleted wholesale; the scenario library remains as a **Task/Scenario definition** domain (projection input), explicitly not the canonical root. Remove the frontend assumption that every content graph starts from a scenario.

## CREATE (by phase)

| Phase | Deliverable | Notes |
|---|---|---|
| 0 | This audit + docs | done |
| 1 | Canonical Entity/Relationship cleanup | decouple content↔scenario types, extend kinds, provider consolidation |
| 2 | `domains/character` — Character + BehavioralProfile on top of Entity | structured attribute groups; MBTI only derived |
| 3 | `domains/population/dimensions` — Dimension registry (~50–150 core, 9 categories) | table `dimensions`, versioned |
| 4 | Population model | table `populations` (+ dimension refs, distributions JSONB, schemaVersion) |
| 5 | DependencyRule graph | table `dependency_rules`; separate from semantic relationships |
| 6 | Deterministic Sampler | seeded PRNG, strategies random/weighted/conditional/stratified, sampling audit |
| 7 | CharacterSnapshot | immutable table; used-by-simulation snapshots never change |
| 8 | Agent abstraction | agent ← snapshot; goals/policy/runtimeConfig |
| 9 | AgentState/Goal/Memory | mutable runtime tables, never write back to Character |
| 10 | Environment abstraction | initialize/observe/act/getState/reset; Text env first |
| 11 | Simulation + InteractionEvent trace | immutable trace; stateBefore/stateAfter per event |
| 12 | Evaluation abstraction | behavior/persona-fidelity/outcome/task/content; agent eval ≠ learner eval |
| 13 | Projection layer generalization | shared projection contract; roleplay refactored onto it |
| 14 | RoleplayX adapter v2 | scenario/actors/goals/constraints/environment/eval contract from canonical data |
| 15 | MatrAIx import/normalization pipeline | only after foundation works |

Proof-of-architecture demo (after ~Phase 12): "Korean Sales Managers" population → 10 sampled characters (seeded) → 2 agents in "budget negotiation" env → simulation → trace → evaluation → roleplay projection. See target-state.md.

## Database plan

New normalized tables: `dimensions`, `populations`, `dependency_rules`, `characters` (or entity-backed), `character_snapshots`, `agents`, `agent_states`, `simulations`, `interaction_events`, `evaluations`. JSONB only for extensible attributes/payloads. Introduce FKs where rows reference rows (snapshots→characters, events→simulations, …). Existing `contents`/`content_versions`/`scenarios`/`categories` remain.

## API plan

New route groups (following existing conventions, added per phase, only when the phase needs them): `/v1/characters`, `/v1/populations`, `/v1/dimensions`, `/v1/dependencies`, `/v1/sampling`, `/v1/snapshots`, `/v1/agents`, `/v1/simulations`, `/v1/evaluations`, `/v1/projections` (generalize existing).

## Test strategy

Per phase: unit tests for domain logic (deterministic sampling reproducibility; snapshot immutability; AgentState isolation from Character; dependency validation; simulation determinism with seed; trace integrity; projection independence — roleplay fields never required by canonical Character) + route integration tests in the existing harness. Type-check + full test suite green before each phase is called done.

## Risk notes

- Biggest structural risk: untangling the content↔scenario↔ai type edges (Phase 1) touches codegen types; do it first and alone.
- LLM non-determinism: reproducibility guarantees apply to sampling/simulation given a seed; LLM-backed steps record model + prompt template version in provenance instead.
- Frontend: keep the scenario flow working throughout; new domains get UI only after their APIs stabilize.
