# Bridge Story — Remix Engine Architecture

## Remix Engine

ContentX derives new canonical scenarios from existing ones. Each derivation
mode is a **remix**; all remixes share the same guarantees:

| Mode | Input | Output | Lineage `kind` |
|---|---|---|---|
| **Element Remix** (existing) | ≥2 scenarios, selected elements each | New `DramaticScenario` | `synthesis` (default / null) |
| **Bridge Remix** (this doc) | Exactly 2 scenarios with roles: source (A) + target (B), transition requirements | New `DramaticScenario` that connects A → B | `bridge` |
| **Story Chain** (future) | Ordered list of scenarios | Composition layer over existing scenarios | *extension point — see below* |

Shared guarantees:

- The output is a **normal canonical `DramaticScenario`** — independently
  reusable for further synthesis, bridging, and downstream projection
  (Movie/Novel/Roleplay/Game).
- **Server-authoritative lineage**: parent titles and the synthesizer identity
  are always rebuilt on the server; forged provenance cannot be persisted.
- Drafts are not persisted until the user explicitly saves
  (`POST /v1/scenarios`).

## Bridge Remix flow

1. **Analyze** — `POST /v1/scenarios/bridge/analyze`
   `{ sourceScenarioId, targetScenarioId }` → `BridgeAnalysis`:
   - `summary`: AI explanation of why a bridge is needed.
   - `gaps[]`: one entry per gap dimension — `timeline`, `location`,
     `characters`, `goals`, `conflict`, `relationships`, `knowledge`,
     `threads` (unresolved threads), `contradictions` — each with
     `status` (`compatible` ✓ / `transition` ⚠ / `conflict` ✕), an
     `explanation`, and an optional draft `requirement`.
   - `requirements[]`: draft transition requirements, user-adjustable.
   The route validates that both scenarios exist and differ; the LLM output is
   schema-validated (`AnalyzeBridgeResponse`) and a mismatch is a 502, never a
   silently accepted payload.

2. **Generate** — `POST /v1/scenarios/bridge`
   `{ sourceScenarioId, targetScenarioId, requirements[], instruction? }` →
   `{ scenario, lineage }`. Requirements are trimmed and bounded (≤20 items,
   ≤500 chars each). The response lineage is built entirely server-side:

   ```jsonc
   {
     "kind": "bridge",
     "parents": [
       { "scenarioId": "…A…", "title": "…", "elements": [], "role": "source" },
       { "scenarioId": "…B…", "title": "…", "elements": [], "role": "target" }
     ],
     "instruction": "…",            // trimmed, ≤500 chars
     "requirements": ["…"],
     "synthesizedBy": "openai/…"    // server model id
   }
   ```

   Candidates follow the existing candidate/reroll pattern — re-posting the
   same recipe yields another candidate for side-by-side comparison.

3. **Save** — `POST /v1/scenarios` with the bridge lineage. Save-time
   validation (`lineageService.validateLineage`) dispatches on `kind`:
   - `synthesis` (or absent): existing rules — ≥2 unique existing parents,
     each borrowing ≥1 valid element.
   - `bridge`: exactly 2 parents, exactly one `source` + one `target`,
     source ≠ target, both must exist; requirements re-validated; parent
     titles, element lists (empty for bridges), parent ordering
     (source-first), and `synthesizedBy` are **always overwritten by the
     server**. Nonexistent parents, missing/duplicate roles, and forged
     titles/synthesizer are rejected or ignored (400 / overwrite).

## Domain modules

- `artifacts/api-server/src/domains/scenario/bridge.ts` — `analyzeBridgeWithLLM`
  (gap analysis) and `bridgeWithLLM` (bridge scenario generation), plus
  deterministic `mockBridgeAnalyzer` / `mockBridgeSynthesizer` for tests,
  mirroring the element-remix `synthesizer.ts` pattern.
- `artifacts/api-server/src/domains/scenario/lineageService.ts` — kind-aware
  save-time validation shared by scenario save and content creation.
- `artifacts/api-server/src/shared/lineage.ts` — neutral `Lineage` types:
  optional `kind`, `requirements`, and per-parent `role` extend the existing
  shape backward-compatibly (old rows have no `kind` ⇒ element remix).

The existing `/v1/scenarios/synthesize` API, the Element Remix synthesizer,
and their tests are unchanged.

## Story Chain extension point (future)

Story Chain will compose N scenarios into an ordered narrative
(A → bridge → B → bridge → C …) *without* generating a new scenario per link
necessarily — it is a composition layer above remixes. The lineage `kind`
discriminator is the designed extension point: a future `chain` kind can add
its own parent-role vocabulary and validation branch in `validateLineage`
without touching `synthesis` or `bridge` behavior. No chain implementation
exists yet.
