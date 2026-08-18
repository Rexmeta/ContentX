# Projection Model (Phase 13–14)

The projection layer turns canonical data and runtime results into
runtime-specific JSON without ever letting runtime concepts leak back into
the canonical model.

## Contract

`artifacts/api-server/src/domains/projection/contract.ts`

```
ProjectionSource  = { graph: ContentGraph | null,
                      simulation: { simulation, trace, snapshots, evaluations } | null }
ProjectionAdapter = { target, version, project(source) → ProjectionResult }
ProjectionResult  = { target, payload (adapter-owned JSON), provenance: ProvenanceLink[] }
```

Provenance chains are ordered `canonical → simulation → projection`:

- `canonical` — contentId + contentVersion
- `simulation` — simulationId + seed + snapshotIds + evaluationIds
- `projection` — adapter, adapterVersion, modelVersion (null for
  deterministic adapters), projectedAt

## Invariants

1. **Read-only.** Adapters never mutate canonical or runtime data
   (covered by tests).
2. **One-way dependency.** `domains/projection/*` imports canonical/runtime
   domains; nothing outside `projection/` imports an adapter type.
3. **No silent AI fallback.** LLM-backed adapters strictly schema-validate
   provider output (`z.strictObject`); invalid output is a 502, never a
   repaired guess.
4. **Provenance is mandatory.** Every result carries the full chain, so any
   projection can be traced to contentVersion + seed + snapshots.

## Adapters

| Target | Version | Sources | Model |
| --- | --- | --- | --- |
| `roleplayx` | 2.0.0 | graph and/or simulation | none (deterministic) |
| `novel` | 1.0.0 | graph and/or simulation | LLM, strict-validated |
| `business` | 1.0.0 | graph and/or simulation | none (deterministic) |

RoleplayX v2 maps simulation bundles to scenario concepts: participants +
snapshot behavioral profiles → `personas` (traits), trace utterances/outcome
→ `recommendedFlow`, simulation config → `environment`, evaluation kinds →
`evaluationContract`. Field mapping: `docs/projections/roleplayx.md`.

The Business adapter produces a negotiation case study / training scenario:
graph worlds/conflicts and simulation config → `background`, participants +
snapshot behavioral profiles → `stakeholders` (interests, profile), trace
utterances/decisions → `decisionPoints`, simulation outcome + evaluations →
`outcomeAnalysis`, plus derived `learningObjectives` and
`discussionQuestions`. Deterministic — no LLM, `modelVersion` is null.

The Novel adapter proves multi-projection: it consumes the same canonical
graph using only canonical vocabulary (entities, relationships,
descriptions) — the projection-independence test asserts the canonical
payload contains no roleplay-specific fields and that both adapters project
the identical, unmutated graph. Movie/Game targets need only a new adapter
implementing the same contract.

## API

- `POST /v1/projections` `{ target: roleplayx|novel|business, contentId?, simulationId? }`
  → `ProjectionResult` (computed on demand, not persisted).
  Errors: 400 (no source / bad input), 404 (unknown content or simulation),
  502 (LLM failure or invalid output).
- `GET /v1/projections/roleplayx/{contentId}` — legacy v1 shape, kept for
  compatibility; internally runs the v2 adapter.

## Full-pipeline demo

See `docs/examples/full-pipeline-demo.md` — population → sample → snapshot →
agents → simulation → trace → evaluation → roleplay & novel projections from
the same canonical data.
