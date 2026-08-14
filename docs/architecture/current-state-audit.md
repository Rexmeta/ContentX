# Current State Audit

Audit of the implemented architecture against the next-phase spec (section 0),
answered with concrete code evidence. Paths are relative to
`artifacts/api-server/src` unless noted; `lib/db` refers to the shared DB package.

Pipeline implemented today:

```
MatrAIx → Import → Canonical Graph
Population (+ Dimension Registry + DependencyRule) → Sampling(Run) → Character
Character → CharacterSnapshot → Agent (+AgentState) → Simulation (trace) → Evaluation
Canonical Graph / Simulation bundle → Roleplay / Novel Projection
```

## The 10 audit questions

### 1. Does CharacterSnapshot exist as an independent domain/model/service? — **Yes**

- Model: `domains/character/snapshotModel.ts` — id, characterId, populationId,
  schemaVersion, dependencyGraphVersion, seed, resolvedAttributes,
  behavioralProfile, provenance, usedBySimulation, createdAt.
- Service/repository: `domains/character/snapshotService.ts`,
  `snapshotRepository.ts`; DB table `lib/db/src/schema/characterSnapshots.ts`.

### 2. Is Agent fully separated from Character? — **Yes**

- `domains/agent/model.ts` — Agent has `snapshotId` and no Character field;
  `characterId` appears only inside provenance.
- DB FKs: Agent → CharacterSnapshot only (`lib/db/src/schema/agents.ts`);
  CharacterSnapshot → Character is a separate restricted FK.
- `lib/db/src/schema/characters.ts` explicitly excludes runtime state from the
  canonical Character table.

### 3. Does Agent reference an immutable CharacterSnapshot? — **Yes (operationally immutable)**

- `agent/service.ts` resolves and validates the snapshot at instantiation and
  stores `snapshotId`.
- Snapshot has **no update API** and no `updatedAt`
  (`snapshotModel.ts` header comment, `snapshotRepository.ts`). The only writes
  are monotonic `usedBySimulation false→true` and deletion while unused.
- Gap: rows are not JS-`Object.freeze`d in memory; immutability is enforced by
  the repository surface (no update path) rather than by the type system. The
  simulation engine `structuredClone`s state before mutating, so snapshots are
  never touched at runtime.

### 4. Can AgentState mutation affect Character? — **No**

- AgentState lives in a separate `agent_states` table (five categories:
  affective/relational/motivational/cognitive/behavioral), FK to agents only.
- The single mutation path (`agent/service.ts updateAgentState` →
  `mergeStateValues`) does an atomic JSONB merge + version increment and never
  calls character/snapshot repositories.
- Simulation persists final runtime values back **only** to `agent_states`
  (`simulation/service.ts`, `simulation/repository.ts`).
- Test evidence: `domains/__tests__/agent.test.ts` asserts character/snapshot
  writes are never invoked during state mutation.

### 5. Can the Population version be reproduced? — **Yes**

- Population (`domains/population/model.ts`) carries `schemaVersion` and a
  numeric `version`; SamplingRun and Character provenance pin
  populationId/populationVersion/schemaVersion.
- `updatePopulation` (PUT) bumps `version` under a row lock and snapshots
  every definition (including v1 at creation) into `population_versions`;
  `getPopulationDefinitionAt` resolves any pinned version, and sampling
  accepts version pins to reproduce past runs
  (`domains/__tests__/populationVersioning.db.test.ts`).
- Remaining caveat: dimension *registry* definitions themselves are not
  version-snapshotted (registered dimensions are append-only in practice).

### 6. Can the dependency graph version be reproduced? — **Yes (digest-based)**

- Each DependencyRule carries a numeric `version`;
  `population/service.ts` computes a deterministic digest over sorted
  `ruleId:version` pairs as `dependencyGraphVersion`, which is recorded on
  SamplingRun, Character provenance, and CharacterSnapshot.
- Rule creation is serialized under a population row lock with cycle checking;
  rule updates bump the rule version under the same lock.
- Every rule create/update/delete and every sampling run snapshots the full
  rule set into `dependency_graph_versions` keyed by the digest, so any
  pinned graph digest is restorable (digest alone is not invertible).

### 7. Is sampling reproducible with the same seed? — **Yes**

- Deterministic Mulberry32 PRNG with stable per-sample derived seeds
  (`population/prng.ts`, `population/sampler.ts`), deterministic sorting and
  shuffle; strategies: random, weighted, conditional, stratified.
- Test evidence: `domains/__tests__/sampler.test.ts` — same definition + seed
  → identical results; different seed → different results.

### 8. Does MatrAIx provenance reach Sampling/Character? — **No (chain breaks at the canonical graph)**

- Importer records `sourceType: "matraix"` + sourceUri/matraixId on canonical
  entities/relationships (`domains/import/matraixImporter.ts`).
- But no path creates Populations or Characters **from** imported MatrAIx
  content; sampled characters get `sourceType: "population"` and manual ones
  `"manual"`. MatrAIx lineage therefore stops at the canonical graph and does
  not propagate into SamplingRun/Character/Snapshot/Agent/Simulation.
- This is the main gap for the MatrAIx→Evaluation vertical slice (spec §4, §9).

### 9. Is the simulation Environment over-coupled to negotiation? — **Yes, at the implementation level**

- The contract is generic in shape:
  `Environment.initialize/observe/act/getState/isDone/outcome/reset`
  (`domains/simulation/environment.ts`).
- But the only implementation is the negotiation `TextEnvironment` (positions,
  concessions, agreement threshold), Outcome is negotiation-shaped
  (`agreementReached`, `finalGap`, `finalPositions`), and policy actions are
  propose/hold/concede/accept/reject. There is no
  `NegotiationEnvironment` vs generic split yet (spec §7 is future work,
  tracked separately).

### 10. Does an Evaluation domain exist? — **Yes**

- `domains/evaluation/{model,evaluators,service,repository}.ts`, persisted in
  `evaluations` table. Kinds: behavior, personaFidelity, outcome; subjects:
  agent, simulation.
- Deterministic and trace-only (never re-runs or mutates); evaluator version
  `1.0.0`; provenance records simulationId + trace event count.
- Test evidence: `domains/__tests__/simulation.test.ts` covers determinism,
  trace integrity, and all three evaluators.

## Summary of remaining gaps

| # | Gap | Spec ref |
|---|---|---|
| 1 | ~~No population version-bump/history~~ — resolved: versioned updates + `population_versions` history | §2, §5 |
| 2 | ~~Old dependency graphs not restorable~~ — resolved: `dependency_graph_versions` snapshots per digest | §2 |
| 3 | MatrAIx provenance does not flow past the canonical graph (no import→population path) | §4, §9 |
| 4 | Only negotiation Environment/Policy implementations; no generic/specific split | §7 |
| 5 | Simulation provenance omits samplingRunId and population versions (reachable only via participant snapshots) | §4 |
| 6 | `Agent.memory` exists but is never read/written by the runtime loop | §8 |
| 7 | Snapshot immutability is repository-enforced, not type/freeze-enforced; no dedicated snapshot immutability tests | §1, §2 |
| 8 | Re-import creates a new content graph each time instead of appending versions (dedup in progress separately) | §4 |
