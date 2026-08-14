# ContentX Product Identity

## 1. What is ContentX?

ContentX is an AI-native **World & Content Intelligence Engine** that
represents people and worlds as structured data, simulates behavior,
evaluates outcomes, and transforms the result into multiple forms of content.

Core product promise:

```
WORLD → PEOPLE → BEHAVIOR → SIMULATION → CONTENT
```

It lets AI systems:

1. represent worlds and entities (canonical graph)
2. model populations of people (generative/statistical definitions)
3. generate/sample realistic characters (deterministic, seeded)
4. resolve characters into runtime agents
5. simulate behavior (seeded, traced runtime)
6. evaluate behavior and outcomes
7. project the resulting structured world/behavior into multiple content
   representations

## 2. What ContentX is NOT

- Not a roleplay bot. RoleplayX is one downstream **consumer** of projections.
- Not a prompt-to-magic-result wrapper. Every artifact carries provenance,
  versions, and validation; nothing is fabricated between stages.
- Not MatrAIx. MatrAIx is one **source** format; the canonical graph is the
  domain model.
- Not a single-output pipeline. The same canonical world can become roleplay,
  novels, business scenarios, games, screenplays, or training content.

## 3. Core lifecycle

```
WORLD (canonical graph)
  ↓
POPULATION            a generative/statistical definition of a group
  ↓
CHARACTER             a persistent identity (sampled, seeded)
  ↓
SNAPSHOT              an immutable resolved character state
  ↓
AGENT                 a runtime actor (with mutable AgentState)
  ↓
SIMULATION            runtime execution (seeded, deterministic policy or LLM)
  ↓
BEHAVIOR              structured actions/decisions/state changes (trace)
  ↓
EVALUATION            assessment of behavior / persona fidelity / outcome
  ↓
CONTENT               projections (RoleplayX, Novel, … )
```

Every arrow above is a **persisted reference**, never a copy. See
[trust-model.md](../architecture/trust-model.md).

## 4. Canonical architecture

Three strictly separated layers (see `docs/architecture/target-state.md`):

- **Canonical layer** — the content graph (entities, relationships,
  populations, dimensions, dependency rules). Single source of truth,
  versioned immutably.
- **Runtime layer** — snapshots, agents, agent states, simulations, traces,
  evaluations. Consumes canonical data by reference; never mutates it.
- **Projection layer** — stateless adapters that transform canonical and/or
  simulation data into external content representations. Projections carry a
  full provenance chain and never become a second source of truth.

## 5. Trust model

`SOURCE → STRUCTURED DATA → VALIDATION → TRANSFORMATION → SIMULATION → EVALUATION`

- Mandatory provenance on every derived object.
- Deterministic, seeded sampling and simulation for reproducibility.
- Explicit errors (400/404/409/502) — no silent fallbacks, no silently
  shortened lineage.
- Validation is computed, never asserted: the UI shows validation results only
  after an actual run.

Details: [trust-model.md](../architecture/trust-model.md).

## 6. Projection architecture

Projections are stateless, computed on demand through a shared contract
(`ProjectionAdapter`): input is canonical graph and/or a simulation bundle;
output is a target-specific payload plus a provenance chain
(canonical → simulation → projection). Adding a new target (game, screenplay,
advertising, business simulation) means adding an adapter — the canonical core
is never modified. See `docs/architecture/projection-model.md`.

## 7. MatrAIx's role

MatrAIx is an **import source**. The importer validates and maps MatrAIx
exports into the canonical graph; the population bridge derives dimensions,
distributions, and dependency rules from imported personas. Re-imports
deduplicate by source URI and version the graph. MatrAIx never defines the
domain model.

## 8. RoleplayX's role

RoleplayX is a **projection target** (consumer):

```
ContentX → Projection/Adapter → RoleplayX
```

never the reverse.

## 9. Future extensibility

The projection contract already supports adding targets without core changes.
Planned (not yet implemented): Business Scenario, Game, Screenplay, Training,
Advertising projections; persisted projection records with provenance-chain
enforcement at the storage boundary.

## 10. Reference demo

The canonical end-to-end example is the wholesale-negotiation reference demo:
[contentx-reference-demo.md](../examples/contentx-reference-demo.md).
