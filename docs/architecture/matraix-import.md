# MatrAIx → Canonical Graph Import (Phase 15)

MatrAIx datasets are imported into the ContentX canonical graph so the same
pipeline (validation, versioning, simulation, projection) applies to imported
content. MatrAIx is a **source format only** — nothing MatrAIx-specific lives
in the canonical model; the boundary lives in
`artifacts/api-server/src/domains/import/`.

## Endpoint

`POST /api/v1/content/import/matraix`

```json
{
  "dataset": { "schemaVersion": "matraix/1.0", "personas": [ ... ] },
  "title": "optional title",
  "dryRun": false
}
```

Returns `201` with `{ content: ContentGraph, report: MatraixImportReport }`.
`dryRun: true` maps + validates without committing. Invalid datasets are a
`400` (strict schema — unknown keys rejected in the domain layer).

## Source format (`matraix/1.x`)

| Field | Required | Notes |
|---|---|---|
| `schemaVersion` | ✔ | must start with `matraix/` |
| `source` | | `{ uri?, title? }` — recorded in provenance |
| `world` | | `{ id, name, description?, attributes? }` |
| `populations[]` | | `{ id, name, description?, dimensions?, attributes? }` |
| `personas[]` | ✔ (≥1) | `{ id, name, populationId?, aliases?, description?, attributes?, traits?, goals? }` |
| `relations[]` | | `{ id?, from, type, to, attributes? }` — endpoints are MatrAIx ids |

## Mapping

| MatrAIx | Canonical |
|---|---|
| `world` | Entity `kind: "world"` |
| `population` | Entity `kind: "population"` (dimensions kept in `attributes.dimensions`) |
| `persona` | Entity `kind: "character"` — **Character > Persona**, never a parallel identity system; `traits` land in `attributes.traits` |
| `persona.goals[i]` | Entity `kind: "goal"` + `pursues` relationship |
| `persona.populationId` | `memberOf` relationship |
| `relations[]` | Relationship (endpoints resolved via the MatrAIx→canonical id map) |

- Ids are normalized to the prefixed stable-id convention:
  `entity_mx_<id>` / `relationship_mx_<id>`; the original id is preserved in
  `attributes.matraixId`.
- Normalization is collision-free: slugging is lossy (`a.b` and `a-b` both
  slug to `a-b`), so when a normalized id is already taken, a deterministic
  8-char hash of the raw source id is appended. Distinct source ids always
  map to distinct canonical ids, and re-mapping the same dataset yields the
  same ids. This also covers generated goal/`memberOf`/`pursues` ids.
- Provenance on the imported graph: `operation: "import"`,
  `sourceType: "matraix"`, plus `sourceUri`/`sourceTitle` from `source`.
- An initial version snapshot is committed atomically
  (note `MatrAIx import (<schemaVersion>)`, author `matraix-importer`).

## Validation report

The import never repairs silently:

- **Duplicate MatrAIx ids** → `DUPLICATE_SOURCE_ID` issue; later entry skipped.
- **Broken references** (unknown `from`/`to`/`populationId`) →
  `BROKEN_REFERENCE` issue; the relation is skipped.
- The mapped graph is re-validated with the shared canonical validator
  (`report.validation`) and is only committed when it passes.
- `report.stats` counts imported worlds/populations/personas/goals/relations
  and everything skipped.

## Projections

Because the result is a plain canonical graph, both projection adapters work
unchanged on imported content (`POST /v1/projections` with
`target: "roleplayx" | "novel"` and the imported `contentId`), including the
canonical provenance link (`contentId` + `contentVersion`) in the chain.

Example dataset: `docs/examples/matraix-import-sample.json`.
