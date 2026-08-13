# Evaluation (current implementation)

```
Simulation trace → deterministic evaluators → Evaluation rows
```

Code: `artifacts/api-server/src/domains/evaluation/` (`model.ts`,
`evaluators.ts`, `service.ts`, `repository.ts`); DB
`lib/db/src/schema/evaluations.ts`.

## Model

- Kinds: `behavior`, `personaFidelity`, `outcome`; subjects: `agent`,
  `simulation`. Rows store scores, findings, and provenance.
- Provenance: simulationId, evaluator + evaluator version (`1.0.0`), trace
  event count.

## Evaluators (deterministic, trace-only)

Evaluators read the persisted InteractionEvent trace only — they never re-run
the simulation or mutate anything:

| Evaluator | Subject | Computes |
|---|---|---|
| behavior | agent | activity, cooperative move rate, state volatility (from decision/stateChange events) |
| personaFidelity | agent | observed concede/accept rate vs. snapshot `risk_tolerance` expectation |
| outcome | simulation | success, efficiency, convergence (from the recorded outcome event) |

`evaluateSimulation` emits two agent rows per participant plus one simulation
outcome row, in a single DB transaction. Determinism and trace-integrity are
covered by `domains/__tests__/simulation.test.ts`.

## Consumption

Projections load evaluations as part of the simulation source bundle; the
RoleplayX adapter maps them into its evaluation contract and the provenance
chain records `evaluationIds`.

## Gaps vs target

- MVP metric set only; rubric/metrics fields from the spec's general
  Evaluation shape (targetType/targetId/rubric/evidence) are specialized to
  the three deterministic evaluators.
- personaFidelity depends on the negotiation action vocabulary; a generic
  environment split will require environment-agnostic behavior metrics.
