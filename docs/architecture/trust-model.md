# ContentX Trust Model

ContentX must never behave like `prompt → LLM → magic result`. Every stage of

```
SOURCE → STRUCTURED DATA → VALIDATION → TRANSFORMATION → SIMULATION → EVALUATION
```

is explicit, persisted, and inspectable. This document defines each trust
property and how it is represented **in the current system**. Capabilities not
yet implemented are marked **PLANNED**.

## 1. Provenance

Every derived object stores references (never copies) to what produced it:

| Object | Provenance fields (implemented) |
|---|---|
| Imported content graph | source URI, MatrAIx ids, import validation report (returned, not persisted) |
| Population (bridged) | `operation: "import-bridge"`, `sourceType`, `importId`, `contentVersion`, `sourceUri`, `matraixId` |
| Dependency rule | `importId`, `matraixId`, rule `version` |
| SamplingRun | `populationId`, `seed`, `populationVersion`, `schemaVersion`, `dependencyGraphVersion`, `characterIds` |
| Character | `samplingRunId`, `populationId` |
| CharacterSnapshot | `characterId`, `populationId`, `samplingRunId`, `populationVersion`, `seed`, `dependencyGraphVersion`, `sampleIndex`, `strategy` |
| Agent | `snapshotId` |
| Simulation | participants (`agentId`, `snapshotId`, `characterId`), `seed`, snapshot ids |
| Evaluation | `simulationId`, `evaluator`, `evaluatorVersion`, `traceEventCount` |
| Projection (stateless) | full provenance chain: canonical link (contentId, contentVersion) → simulation link (simulationId, seed, snapshotIds, evaluationIds) → projection link (adapter, adapterVersion, modelVersion, projectedAt) |

## 2. Versioning

- Content graphs have integer `version` with immutable version records and
  `parentVersion` chains (`/v1/content/{id}/versions`).
- Populations have integer `version`; definition edits snapshot the previous
  version so historical sampling remains reconstructable
  (`/v1/populations/{id}/definition?populationVersion=…`).
- Dependency rules carry integer `version`; sampling records the
  `dependencyGraphVersion` it ran against.
- Evaluators record `evaluatorVersion`; LLM projections record `modelVersion`.
- **PLANNED**: sampler code version recorded on sampling runs; dimension
  definition version protection.

## 3. Validation

- Canonical graph validation (`POST /v1/content/{id}/validate`) runs real
  checks (required fields, id format, entity kinds, aliases, duplicate ids,
  relationship endpoints, self-references) and returns
  `{ valid, checkedAt, checks, issues }`.
- MatrAIx import refuses to commit an invalid graph; the import response
  carries the validation report and import issues.
- The UI shows validation results only from an actual run — never a static
  checkmark.
- **PLANNED**: persisted validation reports (currently computed on demand).

## 4. Reproducibility

- Sampling is deterministic given (population version, dependency graph
  version, strategy, seed). Verified by real-DB tests.
- Simulations with the deterministic policy are reproducible given (snapshot
  ids, seed, config). Verified by trace-comparison tests.
- A result is displayed as **Reproducible ✓** only when the required metadata
  (version + seed) is actually present.
- LLM-backed stages (novel projection, LLM policy) are attributed with
  `modelVersion` but are not bit-reproducible; they are marked as
  AI-generated transformations, not as reproducible computations.

## 5. Lineage

- `GET /v1/evaluations/{id}/lineage` resolves the full chain from any
  evaluation back to its origin:
  `evaluation → simulation → agent(s) → snapshot → sampling run → population → imported content (MatrAIx)`.
- Every hop is resolved from stored references. A missing hop is an explicit
  `409` lineage-broken error — never a silently shortened chain.
- Deletion guards keep lineage resolvable: populations with sampling runs,
  contents referenced by population provenance, and snapshots used by
  simulations cannot be deleted.
- **PLANNED**: lineage endpoints rooted at other objects (character,
  simulation) and provenance backfill for legacy characters.

## 6. Auditability

- Simulations persist a complete ordered trace (`sequence`, `turn`, action
  payloads, `stateBefore`/`stateAfter`) — behavior is replayable evidence,
  not a summary.
- Evaluations are computed from the persisted trace and record
  `traceEventCount`, so an evaluation can be checked against exactly the
  evidence it saw.
- Immutable snapshots and content versions preserve the inputs of past runs.

## 7. AI attribution

Origins are distinguished explicitly, never collapsed into "AI generated":

- **Imported** — brought in from a source (e.g. MatrAIx) with source URI.
- **Derived** — computed deterministically from imported data (e.g. bridged
  distributions, dependency rules).
- **Sampled** — produced by a seeded sampling run.
- **Simulated** — produced by the simulation runtime (policy identified).
- **Evaluated** — produced by a versioned evaluator over a trace.
- **Generated (AI-assisted)** — produced by an LLM; `modelVersion` recorded.
- **Human edited** — canonical graph edits via the workspace editor create a
  new content version.
