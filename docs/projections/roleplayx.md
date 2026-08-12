# RoleplayX Projection

`RoleplayXAdapter` (`artifacts/api-server/src/domains/projection/roleplayxAdapter.ts`)
maps the canonical Content Graph to RoleplayX-compatible Scenario JSON.
RoleplayX fields exist only in this adapter — never in the canonical schema.

Endpoint: `GET /api/v1/projections/roleplayx/:contentId`

## Mapping

| Canonical source | RoleplayX field | Rule |
| --- | --- | --- |
| `world` + `conflict` entities (name + description) | `context` | Concatenated scene-setting text |
| First `character` entity | `playerRole` | "You play as {name} ({description})" |
| `character` entities | `personas[]` | `id`, `name`, `role` (from `attributes.role`, falls back to kind), `background` (description), `traits` (string attributes) |
| `goal` entities | `objectives[]` | "{name}: {description}" |
| `outcome` entities (fallback: `conflict` entities) | `successCriteria[]` | Outcomes verbatim; if none, "Resolve {conflict} ..." |
| `event` entities + `involves` relationships of conflicts | `recommendedFlow[]` | Ordered scene beats |
| Content id / version / timestamp | `meta` | `sourceContentId`, `sourceVersion`, `projectedAt`, `adapter: "roleplayx@1"` |

## Guarantees

- Deterministic, pure transformation (except `projectedAt` timestamp).
- Read-only: projecting never mutates canonical content.
- No private DB details are exposed; only stable canonical IDs appear.
- Reverse flow is forbidden: RoleplayX-specific data is never written back
  into the canonical model.

## Known projection losses

- Relationships that are not `involves` on a conflict are not directly
  represented in the scenario (RoleplayX has no relationship concept);
  they influence only the derived text.
- Non-character entities (location, object, concept, ...) contribute only to
  `context` when they are worlds; a richer scene mapping is a Phase 2 item.
