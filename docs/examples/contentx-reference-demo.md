# ContentX Reference Demo — Wholesale Negotiation

The canonical end-to-end example for future development. It exercises every
lifecycle stage with the real runtime against the dev database — nothing is
fabricated.

Seed it (idempotent — keyed on the fixed source URI):

```bash
pnpm --filter @workspace/api-server run demo:seed
```

Source: `artifacts/api-server/src/scripts/seedReferenceDemo.ts`.
The same chain is asserted end-to-end by the real-DB test
`artifacts/api-server/src/domains/__tests__/matraixVerticalSlice.db.test.ts`.

## 1. Input

A MatrAIx 1.0 export describing a wholesale-negotiation world:

- Source URI: `matraix://exports/reference-demo/wholesale-negotiation`
- World: *Wholesale Negotiation Market*
- One population (`pop.b2b-negotiators`, "B2B Negotiators") with six
  dimensions and six personas whose attributes are functionally consistent.

Import (`POST /v1/content/import/matraix`) validates the export, maps it to
the canonical graph, and refuses to commit if validation fails. Re-running the
import with the same source URI deduplicates (graph re-import versioning).

## 2. Population

The import→population bridge (`bridgeImportToPopulations`) turns the imported
population entity into a real Population with provenance
`{ operation: "import-bridge", importId, sourceUri, matraixId }`.

## 3. Dimensions

| Dimension | Type | Values |
|---|---|---|
| demo_age | number | — |
| demo_occupation | enum | sales_manager, purchasing_manager, shop_owner |
| demo_experience | enum | junior, mid, senior |
| demo_risk_tolerance | enum | low, medium, high |
| demo_negotiation_style | enum | collaborative, competitive, accommodating |
| demo_goal_orientation | enum | margin, volume, relationship |

## 4. Dependency model

Derived by the bridge from functional co-occurrence in the personas
(implication rules, acyclic, deterministic):

- `demo_occupation → demo_negotiation_style`
  (sales_manager → competitive, purchasing_manager → collaborative,
  shop_owner → accommodating)
- `demo_experience → demo_risk_tolerance`
  (junior → low, mid → medium, senior → high)

Each rule carries provenance back to the import.

## 5. Sampling

`POST /v1/sampling` with strategy `conditional`, `sampleSize: 10`, and fixed
seed `20260101`. The SamplingRun records seed, population version, schema
version, and dependency-graph version — the same configuration reproduces the
same characters (verified by real-DB reproducibility tests).

## 6. Characters & 7. Snapshots

Ten characters, each with provenance `{ samplingRunId, populationId }` and
attributes satisfying the dependency rules. Each character is resolved into an
immutable CharacterSnapshot carrying the full sampling lineage
(`samplingRunId`, `populationVersion`, `seed`, `sampleIndex`, `strategy`).

## 8. Agents

Two runtime agents bound to the first two snapshots:

- **Buyer** — goal: buy wholesale inventory at a fair price
- **Seller** — goal: sell wholesale inventory at a sustainable margin

## 9. Simulation & Behavior

`POST /v1/simulations`: *Wholesale Negotiation (Reference Demo)*, topic
"wholesale supply contract negotiation", roles buyer/seller, seed `20260101`,
maxTurns 24, deterministic policy. The run completes and persists a full
ordered trace (~50 interaction events: proposals, counteroffers, state
changes, outcome). Participating snapshots are marked used and become
permanently immutable.

## 10. Evaluation

`POST /v1/evaluations` over the completed simulation yields five evaluations:
behavior + persona fidelity per agent, and one outcome evaluation for the
simulation — each recording `evaluatorVersion` and `traceEventCount`.

## 11. Projection

`POST /v1/projections` with `{ target: "roleplayx", contentId, simulationId }`
returns a RoleplayX scenario (personas, traits, environment, evaluation
contract, recommended flow) computed from the same canonical world — the
canonical graph itself contains no roleplay vocabulary. `target: "novel"`
produces an LLM-drafted novel outline with `modelVersion` attribution.
Business Scenario projection is **PLANNED**. Recorded request/response
examples: `docs/examples/full-pipeline-demo.md`.

## 12. Provenance

`GET /v1/evaluations/{id}/lineage` resolves, for any of the five evaluations:

```
evaluation → simulation (seed 20260101)
           → agent → snapshot → sampling run (seed 20260101)
           → population v1 → imported content → matraix://exports/reference-demo/wholesale-negotiation
```

Every hop is a stored reference; a broken hop is an explicit 409.

## 13. Reproducibility

The demo pins: dataset source URI, population version, dependency-graph
version, sampling seed, sampler strategy, simulation seed, and evaluator
version. Re-running sampling with the same pinned configuration reproduces the
same characters; re-running the simulation with the same snapshots and seed
reproduces the same trace (deterministic policy).
