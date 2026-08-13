import type { ContentGraph } from "../content/model";
import type { Simulation, InteractionEvent } from "../simulation/model";
import type { CharacterSnapshot } from "../character/snapshotModel";
import type { Evaluation } from "../evaluation/model";

/**
 * Shared Projection contract (Phase 13).
 *
 * A projection reads canonical data (content graph) and/or runtime results
 * (simulation + trace + snapshots + evaluations) and produces a
 * runtime-specific JSON payload plus an explicit provenance chain.
 *
 * Invariants:
 * - Projections are read-only: they NEVER mutate canonical or runtime data.
 * - The canonical model NEVER depends on any projection; runtime-specific
 *   concepts live exclusively inside adapters.
 * - Every result carries a provenance chain describing exactly which
 *   canonical/runtime sources it was derived from.
 */

export const PROJECTION_TARGETS = ["roleplayx", "novel"] as const;
export type ProjectionTarget = (typeof PROJECTION_TARGETS)[number];

/** Everything an adapter may read. At least one source must be present. */
export interface ProjectionSource {
  graph: ContentGraph | null;
  simulation: {
    simulation: Simulation;
    trace: InteractionEvent[];
    snapshots: CharacterSnapshot[];
    evaluations: Evaluation[];
  } | null;
}

/** One link in the provenance chain, ordered canonical → runtime → projection. */
export type ProvenanceLink =
  | {
      layer: "canonical";
      contentId: string;
      contentVersion: number;
    }
  | {
      layer: "simulation";
      simulationId: string;
      seed: number;
      snapshotIds: string[];
      evaluationIds: string[];
    }
  | {
      layer: "projection";
      adapter: string;
      adapterVersion: string;
      /** null for deterministic (non-LLM) adapters. */
      modelVersion: string | null;
      projectedAt: string;
    };

export interface ProjectionResult {
  target: ProjectionTarget;
  /** Runtime-specific JSON — schema owned entirely by the adapter. */
  payload: Record<string, unknown>;
  provenance: ProvenanceLink[];
}

export interface ProjectionAdapter {
  target: ProjectionTarget;
  version: string;
  /** Throws InvalidProjectionError when required sources are missing. */
  project(source: ProjectionSource): Promise<ProjectionResult>;
}

export class InvalidProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProjectionError";
  }
}

export class ProjectionExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectionExecutionError";
  }
}

/**
 * Contract-level validation of a provenance chain. Enforces what the
 * OpenAPI spec can only document in prose:
 * - strict layer order: canonical → simulation → projection
 * - at most one link per layer (no duplicates)
 * - at least one source link (canonical or simulation)
 * - the chain ends with exactly one projection link
 *
 * Throws ProjectionExecutionError so a misbehaving adapter fails loudly
 * instead of persisting a scrambled chain.
 */
export function validateProvenanceChain(chain: ProvenanceLink[]): void {
  const order: Record<ProvenanceLink["layer"], number> = {
    canonical: 0,
    simulation: 1,
    projection: 2,
  };
  const layers = chain.map((link) => link.layer);

  const seen = new Set<string>();
  for (const layer of layers) {
    if (seen.has(layer)) {
      throw new ProjectionExecutionError(
        `Invalid provenance chain: duplicate "${layer}" link`,
      );
    }
    seen.add(layer);
  }
  for (let i = 1; i < layers.length; i++) {
    if (order[layers[i]!] <= order[layers[i - 1]!]) {
      throw new ProjectionExecutionError(
        `Invalid provenance chain: "${layers[i]}" link may not follow "${layers[i - 1]}" (expected canonical → simulation → projection)`,
      );
    }
  }
  if (layers[layers.length - 1] !== "projection") {
    throw new ProjectionExecutionError(
      "Invalid provenance chain: chain must end with a projection link",
    );
  }
  if (!seen.has("canonical") && !seen.has("simulation")) {
    throw new ProjectionExecutionError(
      "Invalid provenance chain: at least one canonical or simulation source link is required",
    );
  }
}

/** Builds the shared provenance chain every adapter must attach. */
export function buildProvenanceChain(
  source: ProjectionSource,
  projection: { adapter: string; adapterVersion: string; modelVersion: string | null },
): ProvenanceLink[] {
  const chain: ProvenanceLink[] = [];
  if (source.graph) {
    chain.push({
      layer: "canonical",
      contentId: source.graph.id,
      contentVersion: source.graph.version,
    });
  }
  if (source.simulation) {
    chain.push({
      layer: "simulation",
      simulationId: source.simulation.simulation.id,
      seed: source.simulation.simulation.seed,
      snapshotIds: source.simulation.snapshots.map((s) => s.id),
      evaluationIds: source.simulation.evaluations.map((e) => e.id),
    });
  }
  chain.push({
    layer: "projection",
    adapter: projection.adapter,
    adapterVersion: projection.adapterVersion,
    modelVersion: projection.modelVersion,
    projectedAt: new Date().toISOString(),
  });
  return chain;
}
