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

## Versioning

- `dependencyGraphVersion` is a deterministic digest of sorted
  `ruleId:version` pairs, recorded on the run and on each sampled character's
  provenance.
- Caveat: populations and rules have no version-bump/history mechanism yet, so
  reproducibility holds only while definitions are unchanged (see
  `current-state-audit.md` Q5/Q6).

## Character creation

Each sampled dimension is mapped via its registry category into the matching
Character attribute group; rows are fully validated
(`character/service.ts`) before the atomic insert with the run. Sampled
characters get provenance `sourceType: "population"` with seed, versions,
sampleIndex, and strategy.
