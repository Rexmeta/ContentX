import { newId } from "../../shared/id";
import * as characterRepo from "./repository";
import * as repo from "./snapshotRepository";
import { toCharacter } from "./service";
import type { CharacterAttributes } from "./model";
import type { CharacterSnapshotRow } from "@workspace/db";
import {
  SnapshotImmutableError,
  SnapshotNotFoundError,
  type BehavioralProfile,
  type CharacterSnapshot,
  type SnapshotProvenance,
} from "./snapshotModel";

export class CharacterNotFoundError extends Error {
  constructor(id: string) {
    super(`Character "${id}" not found.`);
    this.name = "CharacterNotFoundError";
  }
}

export function toSnapshot(row: CharacterSnapshotRow): CharacterSnapshot {
  return {
    id: row.id,
    characterId: row.characterId,
    populationId: row.populationId,
    schemaVersion: row.schemaVersion,
    dependencyGraphVersion: row.dependencyGraphVersion,
    seed: row.seed,
    resolvedAttributes: row.resolvedAttributes as CharacterAttributes,
    behavioralProfile: row.behavioralProfile as BehavioralProfile,
    provenance: row.provenance as SnapshotProvenance,
    usedBySimulation: row.usedBySimulation,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Create an immutable snapshot of a character: deep-copies the resolved
 * attributes, derives the behavioral profile, and records the full
 * sampling lineage (population/seed/versions) from character provenance.
 */
export async function createSnapshot(input: {
  characterId: string;
}): Promise<CharacterSnapshot> {
  const row = await characterRepo.getCharacter(input.characterId);
  if (!row) throw new CharacterNotFoundError(input.characterId);
  const character = toCharacter(row);

  // Deep copy — the snapshot must stay identical even if the character
  // is edited afterwards.
  const resolvedAttributes = structuredClone(
    character.attributes,
  ) as CharacterAttributes;

  const behavioralProfile: BehavioralProfile = {
    psychological: structuredClone(resolvedAttributes.psychological ?? {}),
    behavioral: structuredClone(resolvedAttributes.behavioral ?? {}),
    goals: [...(resolvedAttributes.goals ?? [])],
    constraints: [...(resolvedAttributes.constraints ?? [])],
  };

  const p = character.provenance;
  const provenance: SnapshotProvenance = {
    operation: "snapshot",
    createdAt: new Date().toISOString(),
    characterId: character.id,
    characterSchemaVersion: character.schemaVersion,
    populationId: p.populationId ?? null,
    populationVersion: p.populationVersion ?? null,
    seed: p.seed ?? null,
    dependencyGraphVersion: p.dependencyGraphVersion ?? null,
    sampleIndex: p.sampleIndex ?? null,
    strategy: p.strategy ?? null,
  };

  const inserted = await repo.insertSnapshot({
    id: newId("snapshot"),
    characterId: character.id,
    populationId: p.populationId ?? null,
    schemaVersion: character.schemaVersion,
    dependencyGraphVersion: p.dependencyGraphVersion ?? null,
    seed: p.seed ?? null,
    resolvedAttributes,
    behavioralProfile,
    provenance,
    usedBySimulation: false,
  });
  return toSnapshot(inserted);
}

export async function getSnapshot(
  id: string,
): Promise<CharacterSnapshot | null> {
  const row = await repo.getSnapshot(id);
  return row ? toSnapshot(row) : null;
}

export async function listSnapshots(): Promise<CharacterSnapshot[]> {
  return (await repo.listSnapshots()).map(toSnapshot);
}

/** Internal (simulation domain): monotonic false → true transition. */
export async function markSnapshotUsed(id: string): Promise<CharacterSnapshot> {
  const updated = await repo.markSnapshotUsed(id);
  if (!updated) throw new SnapshotNotFoundError(id);
  return toSnapshot(updated);
}

/**
 * Delete a snapshot only while it has never been used by a simulation.
 * Used snapshots are permanent — attempting to delete one is an explicit
 * immutability violation, not a silent no-op.
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const result = await repo.deleteSnapshotIfUnused(id);
  if (result === "missing") throw new SnapshotNotFoundError(id);
  if (result === "used") {
    throw new SnapshotImmutableError(
      `Snapshot "${id}" has been used by a simulation and can never be deleted or modified.`,
    );
  }
  if (result === "referenced") {
    throw new SnapshotImmutableError(
      `Snapshot "${id}" has agents instantiated from it — delete those agents first.`,
    );
  }
}
