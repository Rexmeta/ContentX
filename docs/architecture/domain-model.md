# ContentX — Domain Model (Phase 2–3: Character + Dimensions)

## Character domain (`domains/character/`)

`Character` is a first-class canonical record built on top of the Entity concept (entity kinds `person`/`character`). It is canonical data — runtime state (Agent/AgentState, Phase 7–9) never writes back to a Character.

```
Character {
  id            character_<hex>
  name          display name
  canonicalName stable identity name (nullable)
  aliases       string[]
  attributes    structured groups (below)
  derivedClassifications  e.g. { mbti: "INTJ" } — derived only
  provenance    { operation, createdAt, sourceType, populationId?, seed?, model? }
  schemaVersion "1"
}
```

### Attribute groups

Eight structured groups; six are **dimension-keyed** maps, two are free-form string lists:

| Group | Form | Example |
|---|---|---|
| identity | dimension-keyed | `{ age: 42, gender: "female" }` |
| professional | dimension-keyed | `{ occupation: "sales manager", authority_level: "high" }` |
| psychological | dimension-keyed | `{ risk_tolerance: "low", core_values: ["integrity"] }` |
| behavioral | dimension-keyed | `{ conflict_style: "collaborating" }` |
| capabilities | dimension-keyed | `{ analytical_skill: "high", languages: ["ko","en"] }` |
| preferences | dimension-keyed | `{ price_sensitivity: "medium" }` |
| goals | string[] | `["hit quarterly target"]` |
| constraints | string[] | `["cannot exceed budget"]` |

Validation (semantic, server-side, `attributeValidator.ts`):
- Every key in a dimension-keyed group must be a **registered dimension**; the registry is the vocabulary.
- Each group only accepts dimensions from mapped categories (`GROUP_CATEGORY_MAP`): identity ← demographic/social, professional ← professional/domain, psychological ← psychological, behavioral ← behavioral/social, capabilities ← capability/technology, preferences ← preference/technology.
- Values are checked against the dimension `dataType` and `allowedValues` (enum).
- Typology keys (`mbti`, `enneagram`, `disc`) are rejected in core groups — **MBTI is only allowed as a derived classification**, never the core model.

### Persona (binding decision)

Persona is **not** a separate identity model. A persona is always a *representation* of Character + behavioral profile (the psychological/behavioral groups). Projections (e.g. RoleplayX personas) render this representation; there is never a parallel persona identity system.

## Dimension registry (`domains/population/`)

Reusable, versioned attribute dimensions — the foundation for population distributions and dependency rules (Phase 4–6).

```
Dimension {
  id dimension_<hex>, name (unique snake_case), category, dataType,
  allowedValues (enum only), source ("seed"|"user"|"import:*"), version
}
```

- **Categories (9):** demographic, professional, psychological, behavioral, social, preference, capability, technology, domain.
- **Data types:** string, number, boolean, enum, array (of strings).
- **Seed set:** ~58 core dimensions registered idempotently at server start (`seedDimensions.ts`, unique on name). Extensible at runtime via `POST /v1/dimensions` (409 on duplicate names).

## API

- `GET/POST /v1/dimensions` — registry list / register (400 invalid, 409 duplicate)
- `GET/POST /v1/characters`, `GET/PATCH/DELETE /v1/characters/{id}` — CRUD with dimension-based validation (400 on unknown group/dimension, bad value, or MBTI as core attribute)

## Tables

- `dimensions` — normalized columns; `allowed_values` JSONB only.
- `characters` — normalized identity columns; `attributes`/`derived_classifications`/`provenance` JSONB (extensible payloads only).
