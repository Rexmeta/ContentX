# ContentX Graph Explorer UX Redesign — Final Report

Date: 2026-08-14 · Task: Graph Explorer UX 전면 재설계 · Spec: `attached_assets/Pasted--ContentX-UX-Graph-Explorer-Redesign-Make-the-Populatio_1786681679152.txt`

## 1. Current UX problems found

Documented in full in [`current-graph-ux.md`](./current-graph-ux.md). Highlights:

- Only 2 routes existed (`/` dashboard, `/content/:id` workspace); no navigation, no breadcrumbs, no way to know where you were.
- Population, Character, Snapshot, Agent, Simulation and Evaluation were **absent from the UI entirely**, despite the API client already exposing hooks for all of them.
- The Workspace graph was a hand-rolled circular SVG where **selection filled the node solid blue**, producing an ambiguous "floating blue dot" that could mean anything.
- No legend, no zoom/fit/reset controls, no edge inspection, no empty states.
- Provenance (MatrAIx → … → Evaluation) existed in the backend but was never visualized.

## 2. Graph behavior before / after

| Aspect | Before | After |
| --- | --- | --- |
| Layout | Circle by insertion order, re-derived on data change | Deterministic pure-function layouts per perspective (`lib/graph-layout.ts`); clicking never re-lays-out or moves the camera |
| Selection | Solid blue fill on node | Blue **selection ring/halo only**; node colors reserved for type |
| States | Selected or not | Normal / hover / selected / related (connected nodes+edges highlighted) |
| Camera | None (fixed viewBox) | Explicit Zoom +/−, Fit, Center Selected, Reset controls; pan by drag |
| Edges | Undifferentiated lines | Solid = semantic, dashed = dependency, dotted = provenance; edges clickable |
| Legend | None | Per-perspective adaptive legend (node types + relationship line styles) |
| Empty states | Blank | "NO GRAPH DATA" canvas state, "SELECT AN ITEM" inspector state |

## 3. Meaning of the blue indicator

Blue now means **exactly one thing: the currently selected node**, rendered as a ring/halo around it. There are no floating blue markers. (Primary-blue is also the population node's *type* color in the legend, always labelled; selection is exclusively the ring.)

## 4. New navigation

Persistent left sidebar ("Lifecycle"): **Overview / World / Population / Characters / Agents / Simulation / Evaluation / Graph Explorer**, plus a context header with breadcrumbs on every screen (`components/layout.tsx`). Existing features were folded in, not removed: content library, scenario library and lineage moved under **World**; the workspace remains at `/content/:id`.

## 5. New graph perspectives

Graph Explorer (`/explorer`) offers **World / Population (default) / Character / Simulation / Lineage** perspectives, each with an entity picker that auto-selects a sensible default so the view is never empty when data exists:

- **World** — entities + semantic relationships of a content graph.
- **Population** — population → its declared dimensions (filtered from the global registry) → dependency rules (dashed) → sampled characters (dotted).
- **Character** — character with population origin, goals, snapshots, derived agents.
- **Simulation** — simulation → participant agents → turns/events → evaluations.
- **Lineage** — see §7.

## 6. Inspector design

Fixed right-hand panel, updated on click (never causes camera movement):

- **Node inspector** — kind label (§20 terminology), name, per-kind metadata (population: source/version/dimension/dependency/character counts; character: seed/population; etc.), internal ID, and "Open details →" deep link to the section page.
- **Edge inspector** — relationship type, source, target, and metadata (dependency rules show type, conditions, effect, version in readable form).
- **Agent & AgentState** — agent nodes carry snapshot/character provenance metadata and deep-link to `/agents/:id`, which shows goals, constraints, policy, runtime config, memory, and the five mutable AgentState categories (affective / relational / motivational / cognitive / behavioral) with values and versions. Simulation events with `stateBefore`/`stateAfter` are marked "State Change"; their inspector (and the simulation detail trace) renders a per-category before → after diff tied to the affected agent.
- Empty state: "SELECT AN ITEM — Click a node to inspect its meaning and relationships."

## 7. Lineage visualization

Vertical provenance **tree** built only from real backend provenance fields — no invented edges or nodes:

MatrAIx Source → MatrAIx Import (both rendered **only when** `population.provenance.sourceType === 'matraix'`) → Population → SamplingRun (matched via `samplingRun.characterIds`, the run's recorded output) → Character (`provenance.populationId/seed`) → CharacterSnapshot (`characterId`) → Agent (`snapshotId`) → Simulation (participant agent match) → Evaluation (`simulationId`). **All** snapshots, agents, simulations and evaluations descending from the selected character are shown as branches (stage-per-row tree layout), not a single arbitrary path. All edges dotted (provenance); stages missing in the data are omitted.

## 8. Changed frontend files

- `artifacts/contentx/src/App.tsx` — new route structure
- `artifacts/contentx/src/components/layout.tsx` — sidebar nav, breadcrumbs, context header *(new)*
- `artifacts/contentx/src/components/stable-graph.tsx` — stable SVG graph, controls, legend *(new)*
- `artifacts/contentx/src/lib/graph-layout.ts` — deterministic per-perspective layouts *(new)*
- `artifacts/contentx/src/pages/overview.tsx`, `world.tsx`, `explorer.tsx` *(new)*
- `artifacts/contentx/src/pages/populations/`, `characters/`, `agents/`, `simulations/`, `evaluations/` — list + detail screens *(new)*
- `artifacts/contentx/src/pages/workspace.tsx` — reworked to the new graph component/selection semantics

## 9. Backend contract changes

**None.** No files outside `artifacts/contentx/` and `docs/` were modified (the only other diff is the auto-generated mockup-sandbox component index). All 20 backend test files (184 tests) pass unchanged.

## 10. Screenshots / visual test evidence

Screenshots in [`docs/ux/screenshots/`](./screenshots/): `overview.jpg`, `world.jpg`, `populations.jpg`, `characters.jpg`, `simulations.jpg`, `evaluations.jpg`, `explorer-population.jpg`, `explorer-lineage.jpg`.

An automated Playwright end-to-end pass verified: nav + breadcrumbs, clickable lifecycle pipeline, population detail, explorer default perspective + legend + controls, node selection ring + inspector update with **no layout/camera movement on click**, edge inspector (HAS_DIMENSION), all perspective switches non-empty with adapted legends, lineage chain rendering, zoom/fit usable, and zero console errors. Verdict: success, no blocking bugs.

## 11. Remaining UX issues

- Character/agent auto-generated names are long and truncate awkwardly in cards and graph labels; friendly display names would help.
- The Population perspective renders all sampled characters; very large populations (hundreds+) would need clustering or pagination in the graph.
- Explorer entity pickers are plain `<select>` elements; searchable comboboxes would scale better.
- Lineage focuses on one character's chain at a time; a full-corpus lineage overview could be a future enhancement.
- Graph nodes are not keyboard-navigable (mouse-only interaction).
