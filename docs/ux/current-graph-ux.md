# Current Graph UX Audit — ContentX Frontend (pre-redesign)

Date: 2026-08-14 · Scope: `artifacts/contentx` frontend as it exists before the
Graph Explorer UX redesign (task: Graph Explorer UX 전면 재설계). Backend is out
of scope and unchanged.

## 1. Main navigation

There is effectively **no navigation system**:

- `App.tsx` registers exactly two routes:
  - `/` → `Dashboard` (pages/dashboard.tsx)
  - `/content/:id` → `Workspace` (pages/workspace.tsx)
- The header is a static `CONTENTX` wordmark — not a link, no menu, no
  breadcrumbs anywhere.
- The Dashboard is a single page with an internal two-step wizard
  (`IDEA` → `SCENARIO`) plus a right-hand library with three tabs:
  **CONTENT / SCENARIOS / LINEAGE** (local `activeTab` state, not routed —
  refresh loses the tab).
- The lifecycle domains that the backend fully implements — **Population,
  Dimension, DependencyRule, SamplingRun, Character, CharacterSnapshot, Agent,
  AgentState, Simulation, Evaluation — have no screens at all.** The generated
  API client already exposes hooks for every one of them
  (`useListPopulations`, `useListCharacters`, `useListAgents`,
  `useListSimulations`, `useListEvaluations`, …) but nothing imports them.

## 2. Graph component (Workspace)

- `GraphView` inside `pages/workspace.tsx` is a hand-rolled SVG renderer.
- **Data source:** `GET /api/v1/content/:id` (`useGetContent`) — a single
  canonical `ContentGraph` (entities + relationships). Only content-graph
  entities are shown; populations/characters/agents/simulations never appear.
- **Layout:** all entities placed on one fixed circle, sorted by `kind`.
  Position is a pure function of `(index, container size)`.
  - Consequence 1: adding/removing an entity or **resizing the window
    re-positions every node** — layout is not stable.
  - Consequence 2: no grouping, no hierarchy — a `goal` and a `character`
    get identical visual weight, violating any visual hierarchy.
- **Edges:** every relationship is a quadratic bezier bending through the
  canvas center, all in the same style. Relationship *type* is not encoded
  at all (no solid/dashed/dotted distinction, no labels on the canvas).

## 3. Click / hover / selection behavior

- Clicking a node sets `selection` and repaints:
  - selected node fill becomes **solid blue** (`--primary`) and the circle
    scales ×1.25 — this is the "moving blue circular spot" users report:
    as you click around, a filled blue dot appears to jump from place to
    place on the ring. It has no ring/halo, so it reads as "a blue marker
    moved" rather than "this node is selected".
  - edges incident to the selection recolor blue; a selected edge recolors
    **orange** (`--secondary`) — a second unexplained accent color.
- Hover: circle scales ×1.10 and stroke becomes blue — hover and selection
  are thus both "blue-ish", not clearly distinguishable.
- There are **no camera/zoom/pan controls at all** (no zoom, no fit, no
  center). The only implicit relayout trigger is window resize.
- Edge click opens the relationship editor in the right panel; nothing on
  the canvas explains what an edge means.

## 4. Detail panel (Workspace right sidebar)

- Fixed 400 px panel with four modes: Inspector / Validation / Versions /
  Export.
- Inspector empty state: "Select an entity or relationship from the graph or
  sidebar to inspect." (reasonable, kept in spirit by the redesign).
- Entity inspector = editable name/description + read-only JSON dump of
  `attributes`. Relationship inspector = source/target names + type editor.
  No provenance, no version context, no rule explanation for dependency-like
  relations.

## 5. Legends

- **None.** No node-type legend, no relationship legend, nowhere in the app.
  Node kind is only visible in the left entity list grouping and in the
  inspector header after clicking.

## 6. Lineage

- `components/lineage-tree.tsx` renders only **scenario synthesis lineage**
  (which scenario was synthesized from which) as an indented card forest in
  the Dashboard's LINEAGE tab.
- The real provenance chain the backend maintains —
  MatrAIx → Import → Population → SamplingRun → Character →
  CharacterSnapshot → Agent → Simulation → Evaluation — is **not visualized
  anywhere**, even though every record carries a `provenance` object
  (`CharacterProvenance.populationId/seed/…`, `SnapshotProvenance`,
  `AgentProvenance.snapshotId/characterId`,
  `SimulationProvenance.snapshotIds`, `EvaluationProvenance.simulationId`).

## 7. Empty states

- Content tab: "No Graphs Found"; Scenarios tab: "No Matching Scenarios";
  Lineage tab: "No Lineage Yet" — all decent.
- The Workspace graph canvas itself has **no empty/no-data state**; a graph
  with zero entities renders a blank canvas.

## 8. Terminology

- UI labels only speak of "Entities", "Relationships", "Scenarios",
  "Content". The §20 distinctions (Population / Character /
  CharacterSnapshot / Agent / AgentState / Simulation / Evaluation) never
  appear as UI concepts.

## 9. Summary of core problems

| # | Problem |
|---|---------|
| 1 | No navigation reflecting the ContentX lifecycle; 6 of 8 backend domains invisible |
| 2 | Blue filled dot = selection reads as a floating/moving marker; hover vs selection ambiguous; orange edge selection unexplained |
| 3 | Circular layout re-positions on resize/data change; no explicit zoom/fit/center controls |
| 4 | No legend for node types or edge meanings; relationship types not visually encoded |
| 5 | No perspectives — one graph mixes all entity kinds with equal weight |
| 6 | Real provenance chain (MatrAIx → … → Evaluation) not visualized despite backend support |
| 7 | No context headers or breadcrumbs; "where am I" unanswerable |
| 8 | Graph canvas has no empty state |
