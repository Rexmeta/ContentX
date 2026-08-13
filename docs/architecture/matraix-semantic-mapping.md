# MatrAIx Semantic Mapping

Semantic (not merely field-level) mapping of MatrAIx source concepts into
ContentX domains, based on the actual importer
(`artifacts/api-server/src/domains/import/`). See
`matraix-import.md` for the endpoint contract and validation report; this
document covers what each MatrAIx concept *means* in ContentX and what is
preserved, transformed, or discarded.

MatrAIx is a **source dataset format**, never the ContentX canonical schema
(invariant 10). Everything MatrAIx-specific stays inside the import boundary.

## Mapping table

| MatrAIx | ContentX domain | Canonical type | Preserved | Transformed | Discarded | Provenance | Version |
|---|---|---|---|---|---|---|---|
| `world` | content (canonical graph) | Entity `kind:"world"` | name, description, attributes | id → `entity_mx_<slug>` (original kept as `attributes.matraixId`) | — | `operation:"import"`, `sourceType:"matraix"`, sourceUri/sourceTitle | initial content version 1, committed atomically |
| `populations[]` | content (canonical graph) | Entity `kind:"population"` | name, description, attributes | id normalized; `dimensions` kept **raw** in `attributes.dimensions` (not yet registered in the Dimension Registry) | — | same import provenance | same version snapshot |
| `personas[]` | content (canonical graph) | Entity `kind:"character"` | name, aliases, description, attributes; `traits` → `attributes.traits` | id normalized; **Character > Persona** — never a parallel identity system | — | same | same |
| `persona.goals[i]` | content (canonical graph) | Entity `kind:"goal"` + `pursues` Relationship | goal text | deterministic generated ids | — | same | same |
| `persona.populationId` | content (canonical graph) | `memberOf` Relationship | reference | resolved via MatrAIx→canonical id map; broken refs → `BROKEN_REFERENCE`, skipped | — | same | same |
| `relations[]` | content (canonical graph) | Relationship (SemanticRelationship) | type, attributes | endpoints resolved via id map | relations with unknown endpoints (reported, never silently repaired) | same | same |
| dimensions (population-level) | **population** (target) | Dimension (registry) | — | **not yet mapped** — stored raw in population entity attributes | — | — | — |
| distributions | **population** (target) | Distribution | — | **not present in the `matraix/1.x` source schema**; no importer support | n/a | — | — |
| dependencies | **population** (target) | DependencyRule | — | **not present in the `matraix/1.x` source schema**; no importer support | n/a | — | — |

Id normalization is collision-free and deterministic (lossy slugs get an
8-char hash suffix); re-mapping the same dataset yields the same canonical ids.

## Dimension Registry approach (mandatory)

MatrAIx defines ~1,290 dimensions. These are **never hard-coded** into the
ContentX schema. ContentX already has a DB-backed, runtime-extensible
Dimension Registry (`domains/population/dimensionModel.ts`,
`dimensionRepository.ts`, `dimensionService.ts`) with:

- fields: id, name, category, dataType, allowedValues, source, version
- categories: demographic, professional, psychological, behavioral, social,
  preference, capability, technology, domain
- dataTypes: string, number, boolean, enum, array (enum requires ≥2 unique
  allowedValues)
- ~50 seeded core dimensions (`seedDimensions.ts`); anything beyond is
  registered at runtime.

Target approach for MatrAIx dimensions: the importer (or a follow-up
import→population bridge) registers each MatrAIx dimension into the registry
with `source: "matraix"` and its own version, mapping MatrAIx categories to
registry categories. Population definitions then reference registered
dimension ids — the canonical schema never grows per-dimension columns.

## Current gaps vs. target semantic mapping

1. **Import stops at the canonical graph.** No path creates Population /
   Dimension / DependencyRule domain records from an imported MatrAIx dataset;
   population dimensions sit raw in entity attributes. Consequently MatrAIx
   provenance does not reach SamplingRun/Character/Snapshot (see
   `current-state-audit.md` Q8).
2. **Distributions and Dependencies are absent from `matraix/1.x`** as parsed
   today (zod schema in `domains/import/`). When the source format supplies
   them, they must map to Distribution and DependencyRule (with per-rule
   versions feeding the dependency graph digest), not to graph entities.
3. Re-import versioning/dedup is handled separately (see task on duplicate
   import prevention); the importer currently always creates a fresh content
   graph.
