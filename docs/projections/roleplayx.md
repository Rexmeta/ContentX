# RoleplayX Projection

`roleplayxAdapter` v2 (`artifacts/api-server/src/domains/projection/roleplayxAdapter.ts`)
implements the shared Projection contract (`docs/architecture/projection-model.md`)
and maps canonical Content Graphs and/or simulation results to
RoleplayX-compatible Scenario JSON. RoleplayX fields exist only in this
adapter — never in the canonical schema.

Endpoints:

- `POST /api/v1/projections` `{ target: "roleplayx", contentId?, simulationId? }`
  → `ProjectionResult` with provenance chain (preferred)
- `GET /api/v1/projections/roleplayx/:contentId` — legacy v1 shape (graph-only,
  flat `meta`), internally runs the v2 adapter

## Mapping (canonical graph source)

| Canonical source | RoleplayX field | Rule |
| --- | --- | --- |
| `world` + `conflict` entities (name + description) | `context` | Concatenated scene-setting text |
| First `character` entity | `playerRole` | "You play as {name} ({description})" |
| `character` entities | `personas[]` | `id`, `name`, `role` (from `attributes.role`, falls back to kind), `background` (description), `traits` (string attributes) |
| `goal` entities | `objectives[]` | "{name}: {description}" |
| `outcome` entities (fallback: `conflict` entities) | `successCriteria[]` | Outcomes verbatim; if none, "Resolve {conflict} ..." |
| `event` entities + `involves` relationships of conflicts | `recommendedFlow[]` | Ordered scene beats |
| Content id / version / timestamp | `meta` | `sourceContentId`, `sourceVersion`, `projectedAt`, `adapter: "roleplayx@1"` |

## Mapping (simulation source, v2)

| Runtime source | RoleplayX field | Rule |
| --- | --- | --- |
| Participants + snapshot behavioral profiles | `personas[]` | traits from psychological/behavioral profile values |
| Simulation config (topic, maxTurns) | `objectives[]`, `environment` | "Reach an agreement on {topic} within {maxTurns} turns" |
| Simulation outcome | `successCriteria[]` | reference-run benchmark (match/beat turns used) |
| Trace utterances + outcome event | `recommendedFlow[]` | turn-ordered scene beats |
| Evaluation kinds | `evaluationContract` | kinds + human-readable criteria |

When both sources are given, graph-derived fields lead and simulation
fields extend them (flow, environment, evaluation contract).

## Guarantees

- Deterministic, pure transformation (except `projectedAt` timestamp).
- Read-only: projecting never mutates canonical content.
- No private DB details are exposed; only stable canonical IDs appear.
- Reverse flow is forbidden: RoleplayX-specific data is never written back
  into the canonical model.

## Assessment package publishing (Task 105)

The assessment boundary is separate from the general projection adapter. It
compiles one or more saved scenario-library records into the strict
`AssessmentScenarioPackageV1` RoleplayX import contract. Runtime, evaluation,
and target metadata are explicit request configuration; missing values are
reported as diagnostics and are never inferred from canonical content.

- `POST /api/v1/assessment-packages/versions` creates an immutable compiled
  snapshot from the supplied saved `scenarioId` values, metadata, competencies,
  and per-scenario configuration.
- `POST /api/v1/assessment-packages/:packageId/versions/:version/validate`
  returns the strict local schema and semantic validation report.
- `GET /api/v1/assessment-packages/:packageId/versions/:version` returns the
  completed RoleplayX payload, including its canonical SHA-256 content hash.
- `POST /api/v1/assessment-packages/:packageId/versions/:version/publish/roleplayx`
  performs local validation, RoleplayX validate, then RoleplayX import.
- `GET /api/v1/assessment-packages/:packageId/versions/:version/publications`
  returns the auditable remote publication attempt history.

The same package/version/organization/category derives the same idempotency
key. A prior successful import is reused; otherwise only a successful remote
import moves the immutable package's lifecycle to `published`. Credentials are
read only from RoleplayX client configuration and are neither returned nor
stored with publication evidence.

## Known projection losses

- Relationships that are not `involves` on a conflict are not directly
  represented in the scenario (RoleplayX has no relationship concept);
  they influence only the derived text.
- Non-character entities (location, object, concept, ...) contribute only to
  `context` when they are worlds; a richer scene mapping is a Phase 2 item.
