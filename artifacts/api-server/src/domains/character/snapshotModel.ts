import type { CharacterAttributes } from "./model";

/**
 * CharacterSnapshot — the IMMUTABLE record of exactly what an agent was
 * instantiated from (binding decision #5: canonical data ≠ runtime state).
 *
 * Immutability contract:
 * - No update API, no update repository function, no updatedAt column.
 * - `usedBySimulation` is the single allowed transition (false → true,
 *   monotonic); once used, the snapshot cannot even be deleted.
 */
export interface BehavioralProfile {
  /** Copied from the character's psychological attribute group. */
  psychological: Record<string, unknown>;
  /** Copied from the character's behavioral attribute group. */
  behavioral: Record<string, unknown>;
  /** Free-form goal statements resolved at snapshot time. */
  goals: string[];
  /** Free-form constraint statements resolved at snapshot time. */
  constraints: string[];
}

export interface SnapshotProvenance {
  operation: "snapshot";
  createdAt: string;
  characterId: string;
  /** Version lineage copied from the character at snapshot time. */
  characterSchemaVersion: string;
  populationId?: string | null;
  populationVersion?: number | null;
  /** Sampling audit lineage copied from the character at snapshot time. */
  samplingRunId?: string | null;
  seed?: number | null;
  dependencyGraphVersion?: string | null;
  sampleIndex?: number | null;
  strategy?: string | null;
}

export interface CharacterSnapshot {
  id: string;
  characterId: string;
  populationId: string | null;
  schemaVersion: string;
  dependencyGraphVersion: string | null;
  seed: number | null;
  resolvedAttributes: CharacterAttributes;
  behavioralProfile: BehavioralProfile;
  provenance: SnapshotProvenance;
  usedBySimulation: boolean;
  createdAt: string;
}

export class SnapshotImmutableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotImmutableError";
  }
}

export class SnapshotNotFoundError extends Error {
  constructor(id: string) {
    super(`Character snapshot "${id}" not found.`);
    this.name = "SnapshotNotFoundError";
  }
}
