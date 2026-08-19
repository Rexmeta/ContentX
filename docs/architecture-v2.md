# ContentX Architecture v2 — Output-First Creative Content Engine

> Status: architecture reframe (documentation only). This document reframes the
> existing system around the v2 product definition; it does not describe a
> rewrite. Nothing in the running system was changed for this reframe.
>
> Relationship to existing docs:
> - `docs/architecture.md` — remains accurate for the canonical-model core
>   (Canonical Content Model, Content Graph, AI boundary, RoleplayX projection).
>   v2 **extends** it with the output-first framing and the six engines.
> - `docs/architecture/current-state.md` — the 2026-08-13 audit; still the
>   ground truth for coupling hotspots referenced below.
> - `docs/architecture/target-state.md` — describes the **world/simulation**
>   pipeline (Population → Character → Agent → Simulation → Evaluation). v2 does
>   not replace it: that pipeline is the *simulation branch* of the Creative
>   engine set (it feeds Reference/Benchmark/Evaluation with behavioral
>   evidence). Its binding decisions (Character > Persona, Scenario not the
>   canonical root, modular monolith, no graph DB) are **reaffirmed** here.
> - `docs/ux/output-workflow-map.md` — already output-first; v2 adopts it as the
>   concrete workflow catalog for §F. The workflow domain
>   (`domains/workflow/`) is its encoded form.
> - `docs/product/contentx-identity.md` — "World & Content Intelligence Engine"
>   identity is **superseded in emphasis** by the output-first definition below
>   (the world/simulation capability remains, but it is one engine input, not
>   the product's front door).
> - `docs/architecture/trust-model.md` — remains the implemented trust baseline;
>   §Trust Layer below defines its future extension.

## A. Product Definition

ContentX is an **output-first AI Creative Content Engine**.

The user starts from a desired output — a story, a novel, a roleplay, a
reaction report, game content, an ad — not from a predefined Scenario object.
ContentX analyzes existing content and creative references, extracts reusable
creative patterns, benchmarks them, generates new ideas/content, remixes
existing content, reuses personas, and evaluates the generated result.

Core product loop:

```
User Intent
  → Output Definition
  → Reference / Existing Content
  → Benchmark
  → Creative Knowledge
  → Idea / Story / Persona
  → Generate / Remix / Transform
  → Evaluation
  → Final Output
```

ContentX is **NOT a Scenario Generator**. Scenario is one content/output type
inside ContentX. RoleplayX remains only one downstream projection target.

## B. Architecture v2 (logical flow)

```
User Intent
  → Output            (Output Engine: intent → output type → workflow plan)
  → Reference         (Reference Engine: existing content, imports, library)
  → Benchmark         (Benchmark Engine: group characteristics of references)
  → Creative Knowledge(Creative Engine: patterns, ideas, stories, personas)
  → Generate / Remix  (Creative + Remix Engines)
  → Content Graph     (Canonical Content Model — everything lands here)
  → Evaluation        (Evaluation Engine: creative/content quality)
  → Output Projection (Projection: RoleplayX / Novel / Business / future targets)
```

Six engines: **Output, Reference, Benchmark, Creative, Remix, Evaluation.**

Shared infrastructure (all already exist in some form): Creative Graph
(canonical graph + JSONB), Canonical Content Model, Provenance, Versioning,
Validation, Search, AI Provider abstraction, Projection.

## C. Current → Future Mapping

| Current Module | New Architectural Role | Keep / Refactor / Rename / Replace | Reason |
|---|---|---|---|
| Scenario (`domains/scenario`, `scenarios` table) | One **content/output type** produced by the Creative Engine; a library asset, never the root | **Keep** (reposition) | Fully working library with classification + lineage; only its *product position* changes — from entry point to one output type. |
| Scenario Amplifier (`ai/llmAmplifier.ts`, `ai/mockAmplifier.ts`) | Creative Engine "idea → story draft" generator | **Refactor** (move out of `ai/` eventually) | Works well; but `DramaticScenario` domain types living in `ai/` is a known coupling hotspot (current-state §3.2). AI should be adapters, not domain owners. |
| Scenario Synthesizer (`scenario/synthesizer.ts`, `scenario/bridge.ts`) | Seed of the **Remix Engine** | **Keep, then generalize** (Rename later to Remix) | Element-based recombination with server-authoritative lineage is exactly the Remix contract, currently specialized to 5 scenario elements. |
| Lineage (`scenario/lineageService.ts`, `shared/lineage.ts`, `evaluation/lineageService.ts`) | **Provenance** shared infrastructure for all remix/derive operations | **Keep, extend** | Anti-forgery, server-authoritative design is the model for all future derived objects; extend element vocabulary beyond scenarios. |
| Classification (`scenario/classifier.ts`, `classificationService.ts`, `taxonomy.ts`, `categories` table) | Foundation of the **Benchmark Engine** | **Keep, build on** | Auto-extending multi-axis taxonomy over a corpus is step 1 of Reference Dataset → Classification → Pattern Extraction → Benchmark. |
| Content Graph (`domains/content`, `contents`/`content_versions` tables) | **Canonical Content Model / Creative Graph** — the center of v2 | **Keep** | Already canonical, versioned, provenance-carrying, platform-independent. v2 adds relationship semantics (§E), not a new store. |
| AI Orchestrator (`ai/orchestrator.ts`, `ai/provider.ts`, `ai/llmClient.ts`) | **AI Provider abstraction** serving all six engines | **Keep + Refactor** | Generate → Validate → Commit boundary is right; refactor so amplifier/synthesizer/classifier stop importing the LLM client directly and go through the provider abstraction (current-state §3.3). |
| RoleplayX Adapter (`projection/roleplayxAdapter.ts` + `novelAdapter`, `businessAdapter`, `contract.ts`) | **Output Projection** layer | **Keep** | Already stateless, contract-based, provenance-chained; exactly the v2 projection layer. New targets = new adapters. |
| Workflow domain (`domains/workflow`: planner, executor, templates) | **Output Engine** (intent → output type → workflow) | **Keep** (rename conceptually) | Already implements "What do you want to create?" → planned steps bound to existing APIs. |
| Population/Character/Agent/Simulation (`domains/population`, `character`, `agent`, `simulation`) | Simulation branch: persona source + behavioral **Reference/Evaluation evidence** | **Keep** | Target-state pipeline; in v2 it supplies Personas (characters), simulated reactions (reference material), and evaluation evidence. |
| Evaluation (`domains/evaluation`) | Seed of the **Evaluation Engine** | **Keep, extend** | Currently evaluates simulation behavior/persona-fidelity/outcome; v2 adds creative-quality dimensions (§J) as new evaluation kinds. |
| MatrAIx Import (`domains/import`) | **Reference Engine** intake path | **Keep, extend** | Import + dedup + population bridge is the first concrete Reference intake; extend to more source types later. |
| Validation (`domains/validation/validator.ts`) | **Validation** shared infrastructure (structural) | **Keep** | Pure structural graph validation; explicitly separated from Evaluation (§J). |

Nothing is **Replaced**. There is no concrete architectural conflict that
requires discarding a working module.

## D. Domain Model

```
User Intent ──defines──▶ Output (desired result: type + goal + constraints)
Output ──selects──▶ Workflow (Output Engine)

Source (external origin: MatrAIx export, URL, file, library item)
  └─imported/selected as─▶ Reference (content used as creative input)
Reference ──analyzed into─▶ Pattern (reusable creative characteristic)
Pattern ──aggregated over a set─▶ Benchmark (group characteristics)

Pattern / Benchmark ──inspire──▶ Idea ──amplified into──▶ Story
Story ──contains/casts──▶ Persona (reusable character abstraction, §H)
Story ──specialized as──▶ Scenario (one output type; DramaticScenario today)

Content = the canonical node. Every durable creative object (Story, Scenario,
Persona, Remix result, imported Reference) is, or is committed to, canonical
Content (graph JSONB) — Content remains **canonical** and Scenario is **not
the root**.

Content × Content ──Remix──▶ Content (new, with Lineage)
Content ──projected──▶ Output (final deliverable via Projection)

Provenance is attached to every derived object (operation, sources, lineage,
generator identity). Evaluation attaches to generated/remixed Content and to
simulation traces; it never mutates its subject.
```

Current grounding: Content (`domains/content/model.ts`) is already canonical;
Scenario (`scenarios` table) is a library asset committed into content graphs
via `scenario/graphBuilder.ts`; Lineage/Provenance already link them.

## E. Creative Graph

No graph database. The Creative Graph **is** the existing canonical graph:
typed `Entity` + `Relationship` objects persisted in PostgreSQL JSONB
(`contents.graph`), with cross-record links expressed as provenance/lineage
references (IDs, never copies) — the same mechanism already used by
`provenance.sourceContentIds`, `provenance.lineage`, and the evaluation
lineage chain.

Required relationship semantics (as relationship `type`s inside graphs and/or
provenance references across records):

| Edge | Realization |
|---|---|
| Reference → Pattern | Pattern record carries provenance `sourceContentIds` / classification of the reference set |
| Pattern → Idea | Idea provenance references the pattern/benchmark that constrained generation |
| Idea → Story | Already exists: scenario `idea` field + `amplifiedBy` provenance |
| Story → Persona | Graph relationship (`character` entity in the story graph) + future persona reuse reference |
| Story → Scenario | Already exists: draft → saved scenario → graph commit (`compose` provenance) |
| Content → Remix | Already exists: `Lineage { parents, elements, synthesizedBy }` (synthesis + bridge) |
| Content → Output | Already exists: projection provenance chain (contentId + contentVersion → adapter) |

New edges are new relationship `type` values and new provenance fields —
schema-light, JSONB-native, consistent with the existing model.

## F. Output-First Workflow Selection

The Output Engine (today: `domains/workflow` planner + templates, encoding
`docs/ux/output-workflow-map.md`) interprets user intent into an
`OutputIntent { outputType, … }` and clones a workflow template whose steps
bind to existing APIs. Different requests select different workflows:

- **New Story**:
  `Output → Reference → Benchmark → Idea → Story → Persona → Scenario → Evaluation`
  (today: pick references from library → *(benchmark: future)* → `POST
  /v1/scenarios/draft` → edit → classify → `POST /v1/content` → validate)
- **Remix**:
  `Output → Source Selection → Element Extraction → Remix → Evaluation`
  (today: `GET /v1/scenarios` → element pick → `POST /v1/scenarios/synthesize`
  or `/bridge` → save with lineage; evaluation of remix quality: future)
- **Benchmark**:
  `Reference Set → Analysis → Benchmark → Pattern Report`
  (today: classification + `GET /v1/scenarios/:id/similar` are the analysis
  step; aggregation into a pattern report: future)
- **Persona-based**:
  `Persona → Context → Conflict → Story → Output`
  (today: characters/populations exist and can drive simulations; a
  persona-seeded story draft is future — the amplifier does not yet accept a
  persona as input)

## G. Remix Architecture

The Remix Engine is a **generalization of the current Scenario Synthesis**:

- Today: `POST /v1/scenarios/synthesize` recombines a fixed element set
  (`characters | conflict | setting | twist | structure`) from ≥2 scenarios,
  with server-authoritative `Lineage`; `POST /v1/scenarios/bridge` is a second
  remix kind (source→target transition with a validated 9-dimension analysis).
- Future: the same contract — *sources + selected elements + instruction →
  new content + lineage* — extended to remix **characters, personas,
  relationships, settings, conflicts, goals, events, twists, narrative
  structures, endings**, and other reusable creative elements, operating on
  canonical Content graphs (any entity kind), not only `DramaticScenario`
  fields.
- Migration is gradual: the element vocabulary (`shared/lineage.ts
  SCENARIO_ELEMENTS`) widens, the extractor generalizes from scenario fields to
  graph subsets, and lineage validation stays server-authoritative throughout.
  **Existing scenario synthesis is preserved** as the first, already-shipped
  Remix mode.

## H. Persona Architecture (minimal)

Persona is a **reusable canonical content object** — minimally: a stable ID,
a name, a role/behavioral summary, and provenance. A Persona can belong to a
Story, appear in a Scenario, be reused in another Story, participate in Remix,
and be extracted from existing content.

Current grounding: `character` graph entities (in story graphs), scenario
`characters[]`, and the structured Character domain (`domains/character`,
with BehavioralProfile + immutable CharacterSnapshot). Per target-state
decision #2, **Character > Persona**: Persona is a Character-backed
representation, never a parallel identity system. The minimal abstraction is a
reference (`characterId` or entity `canonicalName`) that lets the same persona
be cast across stories/scenarios/remixes with provenance.

Explicitly **not** now: the full MatrAIx persona schema (MatrAIx stays an
import source mapped through `domains/import`), and no large persona attribute
model beyond what `domains/character` already defines.

## I. Benchmark Architecture

Current Scenario Classification is the **foundation** of Benchmark:

```
Reference Dataset      (library scenarios / imported content — exists)
  → Classification     (LLM multi-axis: domain/conflictType/tone/tags — exists)
  → Pattern Extraction (recurring structures across a classified set — future)
  → Benchmark          (statistical/structural profile of the group — future)
  → Generation Constraints (benchmark profile fed into draft/remix prompts — future)
```

A Benchmark describes **characteristics of a group of contents** (e.g. "office
thrillers in this library typically have an authority conflict, a mid-act-2
twist, 4 characters") — it must never be a recipe for reproducing a single
source. Group-level aggregation (≥ N sources) is a design invariant, aligned
with the creative-independence stance in the Trust Layer.

## J. Validation vs Evaluation

- **Validation = structural correctness.** Exists:
  `domains/validation/validator.ts` (schema, id format, kinds, duplicate ids,
  reference integrity), Zod on every route, lineage invariants. Deterministic,
  blocking, binary.
- **Evaluation = creative/content quality.** Exists for simulations
  (`domains/evaluation`: behavior, personaFidelity, outcome — evidence-based,
  versioned evaluators). Future dimensions for generated/remixed content:
  - output requirement compliance
  - narrative consistency
  - persona consistency
  - structural quality
  - source similarity
  - creative independence
  - remix coherence

  These become new evaluation kinds on the existing evaluation model
  (subject + evaluator + evaluatorVersion + evidence + score/findings).

**A numerical similarity score never represents legal safety.** Source
similarity and creative independence are advisory quality/risk signals with
recorded evidence — not clearance.

## UI Direction (migration, not build)

The current Scenario Library (`world.tsx`) **remains functional**. The
migration target is a **Creative Workspace** whose primary interaction is
**"What do you want to create?"** — then:

```
Output Type → Goal → References → Workflow → Generate / Remix → Review → Export
```

Much of this already exists: `home.tsx` asks the intent question,
`home.tsx` + `workflows/detail.tsx` plan and run output-first
workflows. Required changes (identified only, not built here):

1. Make the Creative Workspace (intent → workflow) the primary navigation
   root; the Scenario Library becomes the "References/Library" surface inside
   it, not the entry point (removes current-state §3.5 "scenario is the
   de-facto entry point").
2. Add a Reference-selection step (pick existing content/scenarios as inputs)
   to workflows that lack it.
3. Add Review/Result surfaces that show evaluation results next to outputs.
4. Surface Remix as an output-neutral action on any content, not a
   scenario-library-only feature.

## Trust Layer (future definition)

Extends the implemented trust model (`docs/architecture/trust-model.md`) with:

- **Source provenance** — where every reference came from (exists for
  MatrAIx/lineage; extend to all reference intake).
- **API/provider rights metadata** — what the providing API's terms permit.
- **License / ToS metadata** — per-source license recorded on Reference
  objects.
- **Source dependency** — how strongly an output depends on each source
  (lineage elements + future similarity evidence).
- **Creative independence analysis** — evaluation-backed assessment of how far
  an output departs from its sources.
- **Human contribution** — recorded edits/decisions by the user in the chain
  (exists as content versions from workspace edits).
- **Generation history** — the full ordered chain of operations that produced
  an output (exists as provenance + lineage + versions).

**ContentX never claims definitive legal clearance.** It provides structured
risk analysis and provenance evidence that a human (or counsel) can act on.
No score, threshold, or report produced by ContentX is a legal determination.

## Architecture Constraints

Preserve: TypeScript · pnpm workspace · PostgreSQL · Drizzle · JSONB · OpenAPI
(single contract, `lib/api-spec/openapi.yaml`) · Zod · modular monolith ·
`AIProvider` abstraction · Canonical Content Model · Content Graph · RoleplayX
Projection.

Do **not** introduce: Neo4j (or any graph DB) · microservices · multi-agent
swarm · large persona schema (full MatrAIx) · marketplace · advanced media
generation.

## See also

- `docs/domain-map-v2.md` — v2 domain → existing source file map, status,
  gaps, conflicts, recommended implementation order.
