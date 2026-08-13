# Simulation Runtime (current implementation)

```
Agents (snapshots + state) → Environment → turn loop → InteractionEvent trace → Outcome
```

Code: `artifacts/api-server/src/domains/simulation/` (`model.ts`, `service.ts`,
`engine.ts`, `environment.ts`, `policy.ts`, `repository.ts`); DB
`lib/db/src/schema/interactionEvents.ts`.

## Environment contract

Generic in shape — `initialize / observe / act / getState / isDone / outcome /
reset` (`environment.ts`) — but the **only implementation is the negotiation
`TextEnvironment`** (positions, concessions, agreement threshold; closes only
when all participants accept within threshold). Outcome is
negotiation-shaped: `agreementReached`, `finalGap`, `finalPositions`,
`turnsUsed`, `summary`. The generic/negotiation split (spec §7:
`NegotiationEnvironment`/`NegotiationPolicy` as one implementation among many)
is not done yet and is tracked as separate work.

## Execution

- Config: topic, maxTurns (1..50, default 10), policy (`heuristic` | `llm`).
- Engine runs in memory over `structuredClone`d state; on completion the
  simulation, the complete trace, agent-state merges, and snapshot
  `usedBySimulation` marks commit atomically in one transaction.
- Simulation never touches Character or CharacterSnapshot content
  (invariants 5–6).

## Trace

- Persisted `InteractionEvent` rows: gapless sequence, turn, actorId, payload,
  optional stateBefore/stateAfter. Event types: observation, action,
  utterance, decision, toolCall (reserved, not yet emitted), stateChange,
  outcome (DB CHECK-enforced).
- Per turn per agent the engine emits observation, decision, action,
  utterance, optional stateChange; one final environment outcome event.
- The trace repository path is append-only/read-only; the trace — not the
  conversation log — is the source of truth for evaluation and replay
  (Behavior ≠ Utterance).

## Provenance

Simulation provenance carries operation, createdAt, seed, environmentType,
policy, modelVersion (null for heuristic), snapshotIds; participants carry
agentId/snapshotId/characterId/name/role. Gap: samplingRunId and
population/schema/dependency versions are not copied onto the simulation —
they are reachable only via the participant snapshots.
