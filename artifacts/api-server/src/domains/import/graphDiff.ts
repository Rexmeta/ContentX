import type { Entity, GraphPayload, Relationship } from "../content/model";

/**
 * Structural diff between two graph payloads, keyed by canonical object id.
 *
 * The MatrAIx mapper allocates deterministic ids from source ids, so the same
 * source object maps to the same canonical id across imports — id-based
 * matching therefore identifies "the same" entity/relationship reliably.
 * Provenance is deliberately excluded (its createdAt changes every import).
 */
export interface GraphDiff {
  addedEntities: number;
  changedEntities: number;
  removedEntities: number;
  unchangedEntities: number;
  addedRelationships: number;
  changedRelationships: number;
  removedRelationships: number;
}

/** Key-order-insensitive canonical serialization for change detection. */
function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function diffById<T extends { id: string }>(
  previous: T[],
  next: T[],
): { added: number; changed: number; removed: number; unchanged: number } {
  const prevById = new Map(previous.map((item) => [item.id, item]));
  let added = 0;
  let changed = 0;
  let unchanged = 0;
  for (const item of next) {
    const prev = prevById.get(item.id);
    if (!prev) {
      added += 1;
    } else if (canonicalize(prev) === canonicalize(item)) {
      unchanged += 1;
    } else {
      changed += 1;
    }
    prevById.delete(item.id);
  }
  return { added, changed, unchanged, removed: prevById.size };
}

export function diffGraphPayloads(
  previous: Pick<GraphPayload, "entities" | "relationships">,
  next: Pick<GraphPayload, "entities" | "relationships">,
): GraphDiff {
  const entities = diffById<Entity>(
    previous.entities ?? [],
    next.entities ?? [],
  );
  const relationships = diffById<Relationship>(
    previous.relationships ?? [],
    next.relationships ?? [],
  );
  return {
    addedEntities: entities.added,
    changedEntities: entities.changed,
    removedEntities: entities.removed,
    unchangedEntities: entities.unchanged,
    addedRelationships: relationships.added,
    changedRelationships: relationships.changed,
    removedRelationships: relationships.removed,
  };
}
