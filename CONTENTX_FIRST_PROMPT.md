# ContentX — Replit Agent First Prompt

You are the lead architect and senior full-stack engineer for a new product called ContentX.

Your first task is NOT to build the entire product.

First inspect the repository/environment, establish the architecture, define the canonical content model, and implement the smallest working vertical slice that proves the architecture.

## Product Definition

ContentX is a platform-independent AI Content Engine / Content Intelligence Platform.

It creates, extracts, splits, composes, merges, remixes, transforms, validates, versions, shares, exports, and serves structured content.

Target uses:
- Movie
- Novel
- Screenplay
- Advertisement
- Roleplay
- Training
- Game
- Game Quest
- Board Game
- Business Use Case
- Simulation
- Worldbuilding

RoleplayX is only one downstream consumer. Do NOT design ContentX as a RoleplayX submodule.

## Critical Architecture

Canonical Content Model
→ Content Graph
→ Content Engine
→ Projection
→ External Platform

The current RoleplayX Scenario JSON is NOT the canonical schema.

Its useful concepts, such as:
- context
- objectives
- successCriteria
- personas
- recommendedFlow

must be mapped into a RoleplayX Projection.

## Phase 1 — Inspect Before Coding

1. Inspect the complete repository.
2. Identify framework, package manager, database, ORM, frontend, backend, deployment configuration, and existing modules.
3. Determine whether it is empty, a starter, or an existing application.
4. Do not overwrite existing code without understanding it.
5. Create `docs/architecture-assessment.md` with:
   - current stack
   - current structure
   - reusable components
   - risks
   - proposed ContentX architecture
   - files that should remain untouched
   - files that may need replacement

If the repository is empty, state that and proceed with a clean modular architecture.

## Phase 2 — Architecture

Create/update `docs/architecture.md`.

Use a modular monolith for MVP.

Domains:
- content
- entity
- relationship
- event
- narrative
- asset
- provenance
- versioning
- ai
- projection
- search
- integration

Avoid premature microservices.

## Phase 3 — Canonical Content Model

Before complex UI or AI, define schemas in `docs/schema/`:

- content.schema.json
- entity.schema.json
- relationship.schema.json
- event.schema.json
- narrative.schema.json
- asset.schema.json
- provenance.schema.json
- projection.schema.json

Core primitives:
Character, Organization, Location, Object, Event, Concept, Theme, Goal, Conflict, Relationship, Emotion, Action, Dialogue, Narrative, Rule, Constraint, Outcome, World.

Every object needs a stable ID. Never use array indexes as identity.

## Phase 4 — Database

Prefer PostgreSQL + JSONB, with pgvector when semantic search is needed.

Do not add Neo4j or another graph DB unless a demonstrated query requirement justifies it.

Keep persistence behind repository/service interfaces.

## Phase 5 — Minimal Vertical Slice

Implement only this first:

### A. Create Content
Input example:
"신제품 출시를 앞둔 회사에서 품질팀과 마케팅팀이 충돌한다."

Create a minimal Content Graph containing:
- Characters
- Organization
- Goals
- Conflict
- Event
- Relationships

### B. Display
Show entities and relationships in a simple graph/workspace UI. A sophisticated graph editor is not required yet.

### C. Edit
Allow editing:
- entity name
- description
- attributes
- relationship type
- relationship target

### D. Validate
Validate:
- schema
- broken references
- duplicate IDs
- required fields

### E. Version
Save a new version for meaningful changes.

### F. Export
Export canonical Content Graph JSON.

## Phase 6 — RoleplayX Projection

Implement `RoleplayXAdapter`.

Input:
Canonical Content Graph

Output:
RoleplayX-compatible Scenario JSON.

Create `docs/projections/roleplayx.md`.

Document exactly how canonical objects map to:
- context
- playerRole
- objectives
- successCriteria
- personas
- recommendedFlow
- assets

Do not put RoleplayX-specific fields into the canonical schema.

## Phase 7 — AI Layer

Do not start with one giant prompt.

Create an explicit `ContentOrchestrator` boundary with conceptual modules:
- Planner
- Generator
- Extractor
- Composer
- Transformer
- Critic
- Validator
- Repairer

For MVP implement:
Generate → Validate → Commit

Use structured JSON output whenever possible.

Keep model/provider configuration behind an interface.

## Phase 8 — Remix

After generation/editing work:

Content A + Content B + user constraints
→ Remix
→ New Content Graph

Original content must remain unchanged.

Preserve provenance:
- source content IDs
- transformation type
- timestamp
- AI/model information when available

## Phase 9 — Testing

Add tests for:
- schema validation
- entity creation
- relationship integrity
- versioning
- provenance
- JSON export
- RoleplayX projection
- AI structured-output parsing if connected

Create fixtures for:
- character
- organization
- location
- event
- conflict
- roleplay scenario

## UX Direction

Do NOT build a ChatGPT clone.

The long-term UI is a Content Workspace:
- Content Library
- Graph Canvas
- Object Inspector
- AI Command Bar
- Version History
- Validation Panel
- Provenance Panel
- Projection/Export Panel

For the first slice, keep the UI simple.

## Engineering Rules

Read and follow `CONTENTX_RULES.md`.

Most important:
1. Canonical Content is platform independent.
2. RoleplayX is an adapter/projection.
3. Content Graph is first-class.
4. Versioning and provenance are first-class.
5. Schema before complex UI.
6. API/service boundaries before UI/database coupling.
7. Validate AI output before persistence.
8. Modular monolith for MVP.
9. No premature graph DB.
10. Never rewrite existing code blindly.

## Development Procedure

Execute in this exact order:

1. Inspect repository.
2. Report findings.
3. Create/update architecture documentation.
4. Define schemas.
5. Define database model.
6. Implement minimal content CRUD.
7. Implement graph representation.
8. Implement validation.
9. Implement versioning.
10. Implement JSON export.
11. Implement RoleplayX adapter.
12. Add tests.
13. Run typecheck.
14. Run tests.
15. Run production build.
16. Fix all errors.
17. Summarize implementation.

Do not jump into marketplace or advanced media generation.

## Acceptance Criteria

At the end of this first task I must be able to:

1. Start the app in Replit.
2. Create a Content Graph from a short prompt or fixture.
3. See entities and relationships.
4. Edit at least one entity and relationship.
5. Validate the graph.
6. Save a new version.
7. Export canonical JSON.
8. Convert the content to RoleplayX Scenario JSON through an explicit adapter.
9. Run automated tests.
10. Read clear architecture documentation.

If an external API key is required, do not invent one. Use environment variables / Replit Secrets and provide a mock/local fallback.

At the end, report:
- what you inspected
- what you changed
- current architecture
- current schema
- how to run it
- tests/build status
- remaining work
- next recommended task

Do not automatically continue into a large second phase.
