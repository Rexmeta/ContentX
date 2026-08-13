import { createHash } from "node:crypto";
import type { Entity, GraphPayload, Relationship } from "../content/model";
import type { ValidationIssue } from "../validation/validator";
import type {
  MatraixDataset,
  MatraixPersona,
  MatraixRelation,
} from "./matraixModel";

/**
 * MatrAIx → canonical graph mapper (pure, deterministic).
 *
 * Mapping (documented in docs/architecture/matraix-import.md):
 * - world       → entity kind "world"
 * - population  → entity kind "population" (dimensions kept in attributes)
 * - persona     → entity kind "character" (Character > Persona; traits become
 *                 attributes, never a parallel identity system)
 * - persona.goals       → entity kind "goal" + "pursues" relationships
 * - persona.populationId→ "memberOf" relationship
 * - relations   → canonical relationships (endpoints resolved via source ids)
 *
 * Source ids are normalized to the prefixed stable-id convention
 * (`entity_mx_*` / `relationship_mx_*`); the original MatrAIx id is preserved
 * in `attributes.matraixId` so round-trips stay auditable.
 *
 * Problems never fail silently: every duplicate/broken reference is recorded
 * in the import report; offending relations are skipped so the committed
 * graph is referentially sound.
 */

export interface MatraixImportStats {
  worlds: number;
  populations: number;
  personas: number;
  goals: number;
  relations: number;
  skippedRelations: number;
  skippedDuplicates: number;
}

export interface MatraixImportMapping {
  payload: GraphPayload;
  issues: ValidationIssue[];
  stats: MatraixImportStats;
}

function slug(sourceId: string): string {
  return sourceId.replace(/[^A-Za-z0-9_-]+/g, "-");
}

function hash8(raw: string): string {
  return createHash("sha1").update(raw).digest("hex").slice(0, 8);
}

/**
 * Deterministic, collision-free canonical id allocation. Slugging is lossy
 * ("a.b" and "a-b" both slug to "a-b"), so when a slugged id is already
 * taken the raw source key's hash is appended — distinct source ids always
 * yield distinct canonical ids, and the same input always yields the same
 * output. One namespace is shared by entities and relationships because the
 * canonical validator enforces uniqueness across both.
 */
class IdAllocator {
  private readonly used = new Set<string>();

  allocate(base: string, rawKey: string): string {
    let id = base;
    if (this.used.has(id)) id = `${base}-${hash8(rawKey)}`;
    let n = 2;
    while (this.used.has(id)) id = `${base}-${hash8(rawKey)}-${n++}`;
    this.used.add(id);
    return id;
  }
}

export function mapMatraixToCanonical(
  dataset: MatraixDataset,
  now: () => string = () => new Date().toISOString(),
): MatraixImportMapping {
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];
  const issues: ValidationIssue[] = [];
  const stats: MatraixImportStats = {
    worlds: 0,
    populations: 0,
    personas: 0,
    goals: 0,
    relations: 0,
    skippedRelations: 0,
    skippedDuplicates: 0,
  };

  // MatrAIx source id → canonical entity id (only non-duplicate entries).
  const idMap = new Map<string, string>();
  const ids = new IdAllocator();

  function registerEntity(
    sourceId: string,
    build: (id: string) => Entity,
    what: string,
  ): boolean {
    if (idMap.has(sourceId)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_SOURCE_ID",
        message: `Duplicate MatrAIx id "${sourceId}" (${what}); later entry skipped.`,
        objectId: sourceId,
      });
      stats.skippedDuplicates += 1;
      return false;
    }
    const id = ids.allocate(`entity_mx_${slug(sourceId)}`, sourceId);
    idMap.set(sourceId, id);
    entities.push(build(id));
    return true;
  }

  if (dataset.world) {
    const w = dataset.world;
    registerEntity(
      w.id,
      (id) => ({
        id,
        kind: "world",
        name: w.name,
        description: w.description ?? null,
        attributes: { ...(w.attributes ?? {}), matraixId: w.id },
      }),
      "world",
    ) && (stats.worlds += 1);
  }

  for (const p of dataset.populations ?? []) {
    registerEntity(
      p.id,
      (id) => ({
        id,
        kind: "population",
        name: p.name,
        description: p.description ?? null,
        attributes: {
          ...(p.attributes ?? {}),
          matraixId: p.id,
          ...(p.dimensions ? { dimensions: p.dimensions } : {}),
        },
      }),
      "population",
    ) && (stats.populations += 1);
  }

  for (const persona of dataset.personas) {
    const added = registerEntity(
      persona.id,
      (id) => personaToCharacter(persona, id),
      "persona",
    );
    if (!added) continue;
    stats.personas += 1;
    const characterId = idMap.get(persona.id)!;

    if (persona.populationId) {
      const populationId = idMap.get(persona.populationId);
      if (!populationId) {
        issues.push({
          severity: "error",
          code: "BROKEN_REFERENCE",
          message: `Persona "${persona.id}" references unknown population "${persona.populationId}"; membership skipped.`,
          objectId: persona.id,
        });
        stats.skippedRelations += 1;
      } else {
        relationships.push({
          id: ids.allocate(
            `relationship_mx_${slug(persona.id)}_memberOf_${slug(persona.populationId)}`,
            `${persona.id}\u0000memberOf\u0000${persona.populationId}`,
          ),
          source: characterId,
          type: "memberOf",
          target: populationId,
        });
        stats.relations += 1;
      }
    }

    (persona.goals ?? []).forEach((goal, index) => {
      const goalId = ids.allocate(
        `entity_mx_${slug(persona.id)}_goal_${index + 1}`,
        `${persona.id}\u0000goal\u0000${index + 1}`,
      );
      entities.push({
        id: goalId,
        kind: "goal",
        name: goal,
        description: null,
        attributes: { matraixPersonaId: persona.id },
      });
      relationships.push({
        id: ids.allocate(
          `relationship_mx_${slug(persona.id)}_pursues_${index + 1}`,
          `${persona.id}\u0000pursues\u0000${index + 1}`,
        ),
        source: characterId,
        type: "pursues",
        target: goalId,
      });
      stats.goals += 1;
      stats.relations += 1;
    });
  }

  const seenRawRelationIds = new Set<string>();
  (dataset.relations ?? []).forEach((relation, index) => {
    const mapped = mapRelation(
      relation,
      index,
      idMap,
      ids,
      seenRawRelationIds,
      issues,
    );
    if (mapped) {
      relationships.push(mapped);
      stats.relations += 1;
    } else {
      stats.skippedRelations += 1;
    }
  });

  const payload: GraphPayload = {
    entities,
    relationships,
    provenance: {
      operation: "import",
      createdAt: now(),
      sourceType: "matraix",
      sourceUri: dataset.source?.uri ?? null,
      sourceTitle: dataset.source?.title ?? null,
      generatedByProvider: null,
      generatedByModel: null,
    },
  };

  return { payload, issues, stats };
}

function personaToCharacter(persona: MatraixPersona, id: string): Entity {
  const attributes: Record<string, unknown> = {
    ...(persona.attributes ?? {}),
    matraixId: persona.id,
  };
  if (persona.traits && persona.traits.length > 0) {
    attributes["traits"] = persona.traits;
  }
  return {
    id,
    kind: "character",
    name: persona.name,
    canonicalName: persona.name,
    ...(persona.aliases && persona.aliases.length > 0
      ? { aliases: persona.aliases }
      : {}),
    description: persona.description ?? null,
    attributes,
  };
}

function mapRelation(
  relation: MatraixRelation,
  index: number,
  idMap: Map<string, string>,
  ids: IdAllocator,
  seenRawRelationIds: Set<string>,
  issues: ValidationIssue[],
): Relationship | null {
  const label = relation.id ?? `#${index + 1}`;
  if (relation.id) {
    if (seenRawRelationIds.has(relation.id)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_SOURCE_ID",
        message: `Duplicate MatrAIx relation id "${relation.id}"; later entry skipped.`,
        objectId: relation.id,
      });
      return null;
    }
    seenRawRelationIds.add(relation.id);
  }
  const sourceId = idMap.get(relation.from);
  const targetId = idMap.get(relation.to);
  if (!sourceId || !targetId) {
    const missing = !sourceId ? relation.from : relation.to;
    issues.push({
      severity: "error",
      code: "BROKEN_REFERENCE",
      message: `Relation ${label} references unknown MatrAIx id "${missing}"; skipped.`,
      objectId: relation.id ?? null,
    });
    return null;
  }
  const id = relation.id
    ? ids.allocate(`relationship_mx_${slug(relation.id)}`, relation.id)
    : ids.allocate(
        `relationship_mx_rel_${index + 1}`,
        `\u0000relation\u0000${index + 1}`,
      );
  return {
    id,
    source: sourceId,
    type: relation.type,
    target: targetId,
    ...(relation.attributes ? { attributes: relation.attributes } : {}),
  };
}
