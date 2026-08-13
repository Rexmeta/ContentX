# ContentX — Target State

ContentX is an **AI-native canonical content graph and world modeling platform**: it represents people, characters, populations, worlds, relationships, events, goals, conflicts, behaviors and rules, then uses AI agents to generate, simulate, transform, evaluate and project that canonical model into multiple content/runtime formats.

Core pipeline (final structure):

```
                DATA / KNOWLEDGE
                       │
                ┌──────▼──────┐
                │ Canonical   │
                │ Content     │
                │ Graph       │
                └──────┬──────┘
                       │
             ┌─────────▼─────────┐
             │ Population Domain │
             │ Dimensions        │
             │ Distributions     │
             │ Dependencies      │
             └─────────┬─────────┘
                       │
                    Sampling
                       │
                       ▼
                   Character
                       │
                   Snapshot
                       │
                       ▼
                     Agent
                       │
                 Agent Runtime
                       │
                       ▼
                 Environment
                       │
                       ▼
                  Simulation
                       │
                       ▼
                Behavior Trace
                       │
                       ▼
                  Evaluation
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
         Roleplay              Novel
        Projection           Projection
```

Current implementation status per stage is documented in
`current-state-audit.md` and the per-domain docs (`character-snapshot.md`,
`sampling-run.md`, `agent-runtime.md`, `simulation-runtime.md`,
`evaluation.md`, `matraix-semantic-mapping.md`).

## Architectural decisions (binding)

1. ContentX is the canonical model; every runtime (RoleplayX, novel, game…) is a projection.
2. **Character > Persona.** Persona = Character + behavioral profile representation; never a parallel identity system.
3. **Population is a first-class domain** (dimensions, distributions, dependency rules, deterministic sampling).
4. **Semantic relationships ≠ statistical dependencies.** `SemanticRelationship` (worksAt, conflictsWith) and `DependencyRule` (occupation=manager → authorityLevel high 0.72) are separate models.
5. **Canonical data ≠ runtime state ≠ projection.** Character (canonical, immutable-ish) ≠ Agent (runtime actor from a CharacterSnapshot) ≠ AgentState (mutable) ≠ Scenario (projection/task).
6. **Scenario is not the canonical root.** Canonical World/Graph → Task/Scenario definition → Projection → Runtime.
7. Provenance and versioning are mandatory; simulation results reproducible from contentVersion + populationVersion + schemaVersion + dependencyVersion + snapshot + modelVersion + seed.
8. AI output never bypasses schema validation; LLMs never mutate records directly.
9. Modular monolith; typed core + JSONB for extensible attributes only. No microservices/graph DB/Kafka at this stage.

## Target domain map

```
domains/
├── graph/          Entity, SemanticRelationship, Attribute, Provenance, Version
├── character/      Character (identity/professional/psychological/behavioral/
│                   capabilities/preferences/goals/constraints), BehavioralProfile,
│                   CharacterSnapshot (immutable)
├── population/     Population, Dimension (~50–150 core, categorized), Distribution,
│                   DependencyRule, Constraint, Sampler (deterministic w/ seed)
├── agent/          Agent (from snapshot), AgentState (affective/relational/
│                   motivational/cognitive/behavioral), Goal, Policy, Memory
├── simulation/     Environment (initialize/observe/act/getState/reset),
│                   Simulation, InteractionEvent trace (immutable), Outcome
├── evaluation/     BehaviorEvaluation, PersonaFidelityEvaluation, OutcomeEvaluation,
│                   TaskEvaluation, ContentEvaluation (agent eval ≠ learner eval)
├── ai/             Provider-agnostic orchestration: extract/generate/transform/
│                   plan/critic/repair — adapters only, no domain ownership
└── projection/     Roleplay, Novel, Movie, Game adapters (read canonical, never
                    depended on by canonical)
```

## Key models (conceptual)

- **Entity**: id, kind (extended: + person, value, trait, capability, population…), canonicalName, aliases, attributes (typed core + JSONB extension), metadata, provenance, timestamps.
- **Character**: structured attribute groups on top of Entity; MBTI only as derived/imported classification, never the core model.
- **Population**: name, domain, schemaVersion, dimensions, distributions, dependencies, constraints, provenance, sampling config.
- **Dimension**: id, name, category (demographic/professional/psychological/behavioral/social/preference/capability/technology/domain), dataType, allowedValues, source, version.
- **DependencyRule**: sourceDimension, targetDimension, type (correlation/conditional/constraint/exclusion/implication), conditions, probability/distribution, strength, provenance, version.
- **Sampler**: `samplePopulation({populationId, sampleSize, constraints, targetDistribution, strategy, seed})`; strategies random/weighted/conditional/stratified; deterministic given seed; stores requested vs achieved distribution + audit.
- **CharacterSnapshot**: immutable record of exactly what an agent was instantiated from (characterId, populationId, schemaVersion, dependencyGraphVersion, seed, resolved attributes, behavioral profile, provenance).
- **Agent/AgentState**: runtime state (trust/stress/rapport/…) never written back to canonical Character.
- **Simulation + trace**: InteractionEvent {simulationId, turn, actorId, type (observation/action/utterance/decision/toolCall/stateChange/outcome…), payload, stateBefore, stateAfter}; trace is the source for evaluation/replay/analytics — conversation logs are just one manifestation.
- **Behavior**: Action/Decision/Utterance/StateChange/GoalChange/RelationshipChange — text is one manifestation, not the model.

## Final architectural test

The same canonical data must support, without duplicating the world model: (1) "create a realistic population of 1,000 Korean retail customers 30–50 with realistic correlations" → deterministic sampling → character population → snapshots; (2) "put 20 into a customer-service simulation" → agents → trace → behavior evaluation; (3) "create a roleplay training scenario from it" → roleplay projection; (4) "create a short story from the same world" → novel projection.

Proof-of-architecture demo (minimum): population "Korean Sales Managers" → sample 10 characters (dependency rules + seed) → instantiate 2 agents (Sales vs Finance manager) in a "budget negotiation" environment → run simulation → snapshots, observations, actions, state transitions, outcome, trace, evaluation → generate a Roleplay projection from the same canonical graph.
