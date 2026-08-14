# SamplingRun (current implementation)

```
Population → SamplingRun → Characters (→ CharacterSnapshots)
```

Code: `artifacts/api-server/src/domains/population/` (`model.ts`, `service.ts`,
`sampler.ts`, `prng.ts`, `repository.ts`); DB
`lib/db/src/schema/samplingRuns.ts`. Entry point:
`POST /v1/sampling` → `populationService.samplePopulation` → pure `runSampler`.

## SamplingRun record

Persisted audit record (not transient): seed, strategy, sampleSize,
constraints, targetDistribution, requested vs achieved distributions,
characterIds, pinned versions (populationId, populationVersion, schemaVersion,
dependencyGraphVersion), createdAt. Characters and the run commit atomically in
one transaction.

Not yet recorded vs spec §3: `samplerVersion`.

## Determinism

- PRNG: Mulberry32 seeded from the run seed with stable per-sample derived
  seeds; deterministic sorting and shuffling throughout.
- Strategies: `random`, `weighted`, `conditional`, `stratified`.
- Dependency rules apply only under `conditional`/`stratified`, in stable
  topological source→target order: conditional replaces the target
  distribution, implication forces a value, exclusion removes values,
  constraint rejection-checks, correlation shifts numeric targets.
- Verified: same definition + seed → identical output; different seed →
  different output (`domains/__tests__/sampler.test.ts`).

## Versioning & history

- `dependencyGraphVersion` is a deterministic digest of sorted
  `ruleId:version` pairs (`population/versioning.ts`), recorded on the run and
  on each sampled character's provenance.
- Population updates (`PUT /v1/populations/{id}`) bump `version` and snapshot
  the new definition into `population_versions`
  (v1 is snapshotted at creation); rule updates
  (`PUT /v1/dependencies/{id}`) bump the rule version. Every rule
  create/update/delete and every sampling run upserts the full current rule
  set into `dependency_graph_versions` keyed by digest, so any pinned graph is
  restorable.
- `GET /v1/populations/{id}/definition?populationVersion&dependencyGraphVersion`
  resolves the exact historical definition + rule set behind a run's pins.
- `POST /v1/sampling` accepts optional `populationVersion` /
  `dependencyGraphVersion` pins to re-sample under a historical definition;
  same seed → identical output even after the live definition changed
  (`domains/__tests__/populationVersioning.db.test.ts`).
- Population updates that would orphan existing rules (removing a dimension a
  rule references) are rejected with 400.

## Character creation

Each sampled dimension is mapped via its registry category into the matching
Character attribute group; rows are fully validated
(`character/service.ts`) before the atomic insert with the run. Sampled
characters get provenance `sourceType: "population"` with seed, versions,
sampleIndex, and strategy.
