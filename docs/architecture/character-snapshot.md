# CharacterSnapshot (current implementation)

The immutable layer between canonical Character and runtime Agent:

```
Character → CharacterSnapshot → Agent → AgentState
```

Code: `artifacts/api-server/src/domains/character/snapshotModel.ts`,
`snapshotService.ts`, `snapshotRepository.ts`;
DB `lib/db/src/schema/characterSnapshots.ts`.

## Model

| Field | Notes |
|---|---|
| id | `snapshot_*` |
| characterId | restricted FK → characters |
| populationId, schemaVersion, dependencyGraphVersion, seed | lineage pins copied from Character provenance |
| resolvedAttributes | deep clone of the character's attribute groups at snapshot time |
| behavioralProfile | derived from psychological/behavioral/goals/constraints |
| provenance | operation, sourceType, populationId, seed, versions, sampleIndex, strategy |
| usedBySimulation | monotonic false→true |
| createdAt | no `updatedAt` — by design |

## Immutability guarantees

- The repository exposes **no update method**; the only writes are
  `markSnapshotUsed` (false→true only) and deletion, which is rejected once the
  snapshot is used or referenced by an agent.
- The simulation engine `structuredClone`s all state before mutation, so
  snapshots are never touched at runtime.
- Gap: immutability is enforced at the repository/service surface, not via
  `Object.freeze`/readonly types, and there are no dedicated
  snapshot-immutability tests yet (spec §2 Test D).

## Creation & lineage

`snapshotService.createSnapshot(characterId)` deep-clones the character and
copies its sampling provenance (populationId, populationVersion, schemaVersion,
dependencyGraphVersion, seed, sampleIndex, strategy) into the snapshot, so a
snapshot is self-describing about how its character was produced.

Not yet present (spec §1 target fields): `populationVersion` and
`samplingRunId` as top-level snapshot columns (populationVersion lives in
provenance; samplingRunId is only on the SamplingRun→characterIds side).
