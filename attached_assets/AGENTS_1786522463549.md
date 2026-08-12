# ContentX Development Rules

## 0. Project Identity
ContentX is a platform-independent AI Content Engine / Content Intelligence Platform.

It is NOT a RoleplayX scenario generator. Its purpose is to create, extract, split, compose, merge, remix, transform, validate, version, share, export, and serve structured content.

Target uses:
- Movie
- Novel
- Screenplay
- Advertisement
- Roleplay
- Training
- Game
- Board Game
- Business Use Case
- Simulation
- Worldbuilding

RoleplayX is one downstream consumer, not the parent product.

## 1. Fundamental Architecture

### 1.1 Canonical Content First
Never make RoleplayX JSON the canonical model.

Use:
Canonical Content Model → Content Graph → Content Engine → Projection → External Platform

### 1.2 Platform Independence
Do not put RoleplayX-specific runtime fields, storage paths, assets, authentication, evaluation, or assumptions into the canonical model.

### 1.3 Content Graph Is First-Class
Core concepts include:
- Entity
- Relationship
- Event
- Concept
- Goal
- Conflict
- Action
- Emotion
- Narrative
- Rule
- Constraint
- Outcome
- Asset

Important relationships must be explicit data, not hidden only inside prose.

### 1.4 Content and Projection Are Separate
Canonical content describes WHAT the content is.
Projection describes HOW it is represented for a target medium/platform.

Examples:
- Roleplay Projection
- Screenplay Projection
- Novel Projection
- Game Quest Projection
- Advertisement Projection
- Use Case Projection
- Board Game Projection

## 2. Canonical Content Rules

### 2.1 Stable Identity
Every core object needs a stable ID. Never use array position as identity.

Suggested prefixes:
content_, entity_, relationship_, event_, narrative_, asset_, projection_

### 2.2 Versioning
Support:
- version
- createdAt
- updatedAt
- author
- parentVersion where applicable
- branch/fork metadata where applicable

Avoid destructive updates when history matters.

### 2.3 Provenance
Imported, extracted, remixed, transformed, or AI-generated content must preserve provenance.

Track when available:
- source
- source type
- source URI
- source title
- license
- transformation type
- generatedBy
- model/provider
- timestamp

Never imply externally sourced material is original.

### 2.4 Assets
Canonical content references assets by stable asset IDs. Do not hard-code application-specific storage paths.

## 3. AI Engine

Keep AI modular:
- Orchestrator
- Planner
- Extractor
- Generator
- Composer
- Transformer
- Critic
- Validator
- Repairer

Do not implement all intelligence as one giant prompt.

AI output should be structured JSON/schema-constrained whenever possible.

Preferred pipeline:
Generate → Parse → Schema Validate → Semantic Validate → Consistency Check → Repair → Commit

Never blindly persist raw LLM output as trusted canonical data.

## 4. Content Operations

Explicitly support:
- Generate
- Extract
- Split
- Compose
- Merge
- Remix
- Transform
- Validate

These should exist as domain services/use-cases, not be scattered through UI code.

## 5. Schema/API

Schema first:
- content
- entity
- relationship
- event
- narrative
- asset
- provenance
- projection

API should be the boundary for important functionality:
UI → API/service → domain logic → persistence

Use /api/v1/... for public APIs.

Canonical JSON export must not expose private database implementation details.

## 6. RoleplayX Integration

RoleplayX is an adapter target.

Create an explicit RoleplayXAdapter that maps Canonical Content to RoleplayX Scenario JSON.

Useful existing RoleplayX fields include:
- context
- objectives
- successCriteria
- personas
- recommendedFlow

Treat these as projection data, not the universal ContentX schema.

## 7. Database

For MVP prefer:
PostgreSQL + JSONB + pgvector when semantic search is needed.

Do not introduce a dedicated graph database unless a concrete requirement justifies it.

Use a modular monolith first. Avoid premature microservices.

## 8. Domain Boundaries

Recommended domains:
- Content
- Entity
- Relationship
- Event
- Narrative
- Asset
- Provenance
- Versioning
- AI
- Projection
- Search
- Publication
- Integration

Keep domain logic out of React components.

## 9. Frontend

Primary workspace should become a Content/Graph Workspace:
- Content Library
- Graph Canvas
- Object Inspector
- AI Command Bar
- Version History
- Provenance Panel
- Projection/Export Panel
- Validation Panel

Do not build a generic chat-first application.

## 10. Search

Plan for:
1. keyword search
2. semantic/vector search
3. graph-aware search

MVP can start with keyword + semantic.

## 11. Security

Never expose API keys, database credentials, or private source credentials.

Use environment variables / Replit Secrets.

Never store secrets in Git.

## 12. Code Quality

Prefer:
- TypeScript
- strict typing
- schema validation
- small domain services
- explicit interfaces
- pure/testable transformations
- deterministic transformations where possible

Avoid:
- any-heavy TypeScript
- giant files
- giant controllers
- direct DB calls from React
- duplicated schemas
- magic strings
- premature abstraction

## 13. Testing

Test at minimum:
- schema validation
- entity creation
- relationship integrity
- graph references
- versioning
- provenance
- import/export
- projection
- RoleplayX adapter
- structured AI output parsing
- validation/repair

## 14. Vibe Coding Workflow

Always:
1. Inspect the repository.
2. Identify architecture.
3. Document architecture.
4. Define schema.
5. Define domain boundaries.
6. Implement a minimal vertical slice.
7. Test it.
8. Run typecheck/build/tests.
9. Review dependencies.
10. Expand only after the slice is stable.

Before modifying an existing module, identify callers, consumers, data dependencies, API dependencies, tests, and migration impact.

## 15. MVP

The MVP must prove:

Prompt
→ Generate Content Graph
→ Inspect Graph
→ Edit Entity/Relationship
→ Version
→ Validate
→ Export Canonical JSON
→ Transform to Roleplay
→ Export Roleplay JSON

A second proof:
Content A + Content B + constraints
→ Remix
→ New Content Graph
→ Provenance preserved

## 16. Non-Goals for MVP

Do not initially build:
- marketplace payments
- social network
- full Unity plugin
- full Unreal plugin
- dedicated graph DB
- autonomous multi-agent swarm
- full screenplay editor
- full novel editor
- advanced video generation
- enterprise SSO
- multi-region infrastructure

## 17. Definition of Done

A feature is complete only when:
- schema is defined
- domain logic is isolated
- API/service exists where appropriate
- UI works
- validation exists
- tests exist
- existing functionality is not broken
- typecheck passes
- build passes
- documentation is updated

## 18. Critical Rule

When speed conflicts with interoperability: choose interoperability.

When RoleplayX convenience conflicts with Canonical Content integrity: choose Canonical Content integrity.

When AI prose conflicts with structured data: choose structured data.

When feature expansion conflicts with schema stability: stabilize the schema first.
