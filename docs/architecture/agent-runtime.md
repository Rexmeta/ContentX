# Agent Runtime (current implementation)

```
CharacterSnapshot → Agent → AgentState (mutable, isolated)
Environment → Observation → Policy.decide → Action → StateTransition → Trace
```

Code: `artifacts/api-server/src/domains/agent/` (`model.ts`, `service.ts`,
`repository.ts`), policies in `domains/simulation/policy.ts`, loop in
`domains/simulation/engine.ts`; DB `lib/db/src/schema/agents.ts`,
`agentStates.ts`.

## Agent

- Fields: id, `snapshotId`, name, typed goals (objective/priority/urgency/
  successCriteria), constraints, policy, runtimeConfig, `memory: unknown[]`,
  provenance, timestamps.
- No Character reference except `provenance.characterId`; the DB FK is
  Agent → CharacterSnapshot only (restricted delete). Instantiation resolves
  and validates the snapshot (`agent/service.ts`).

## AgentState

- Separate `agent_states` table: one row per agent per category —
  affective, relational, motivational, cognitive, behavioral — numeric JSON
  values + optimistic version; unique index + category CHECK; FK to agents
  only (cascade).
- All five rows are initialized in one transaction at instantiation.
- Sole mutation path: `updateAgentState` → `mergeStateValues` — atomic JSONB
  merge + version increment. No character/snapshot repository calls exist on
  this path; tests assert they are never invoked
  (`domains/__tests__/agent.test.ts`).

## Runtime loop

- Explicit observe→decide→act loop in `simulation/engine.ts`: per turn, each
  agent receives an observation, its policy decides, the action is applied to
  the environment, and validated/clamped state deltas mutate a
  `structuredClone`d in-memory copy. Final values persist back **only** to
  `agent_states`, transactionally with the trace.
- Policy abstraction: `AgentPolicy.decide(observation, context, rng)`;
  `PolicyContext` carries snapshot, goals, and current state. Implementations:
  deterministic seeded `heuristicPolicy` and schema-validated LLM policy
  (invalid LLM output raises `PolicyExecutionError` — no silent fallback).

## Gaps

- `memory` is initialized empty and never read/written by the loop or
  policies.
- Constraints are modeled/validated but not consumed by current policies.
- Policy actions (propose/hold/concede/accept/reject) are negotiation-specific
  (see `simulation-runtime.md`).
