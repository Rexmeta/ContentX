import * as contentRepo from "../content/repository";
import { toContentGraph } from "../content/service";
import * as simulationService from "../simulation/service";
import * as snapshotService from "../character/snapshotService";
import * as evaluationService from "../evaluation/service";
import { SimulationNotFoundError } from "../simulation/model";
import {
  InvalidProjectionError,
  validateProvenanceChain,
  PROJECTION_TARGETS,
  type ProjectionAdapter,
  type ProjectionResult,
  type ProjectionSource,
  type ProjectionTarget,
} from "./contract";
import { roleplayxAdapter } from "./roleplayxAdapter";
import { novelAdapter } from "./novelAdapter";
import { businessAdapter } from "./businessAdapter";

export {
  InvalidProjectionError,
  ProjectionExecutionError,
  PROJECTION_TARGETS,
} from "./contract";

const adapters: Record<ProjectionTarget, ProjectionAdapter> = {
  roleplayx: roleplayxAdapter,
  novel: novelAdapter,
  business: businessAdapter,
};

export class ContentNotFoundError extends Error {
  constructor(id: string) {
    super(`Content "${id}" not found`);
    this.name = "ContentNotFoundError";
  }
}

/** Resolves canonical/runtime sources for a projection. Read-only. */
export async function resolveSource(input: {
  contentId?: string | undefined;
  simulationId?: string | undefined;
}): Promise<ProjectionSource> {
  if (!input.contentId && !input.simulationId) {
    throw new InvalidProjectionError(
      "At least one of contentId or simulationId is required",
    );
  }

  const source: ProjectionSource = { graph: null, simulation: null };

  if (input.contentId) {
    const row = await contentRepo.getContent(input.contentId);
    if (!row) throw new ContentNotFoundError(input.contentId);
    source.graph = toContentGraph(row);
  }

  if (input.simulationId) {
    const simulation = await simulationService.getSimulation(
      input.simulationId,
    );
    if (!simulation) throw new SimulationNotFoundError(input.simulationId);
    const trace = (await simulationService.listEvents(input.simulationId)) ?? [];
    const snapshots = [];
    for (const p of simulation.participants) {
      const snapshot = await snapshotService.getSnapshot(p.snapshotId);
      if (snapshot) snapshots.push(snapshot);
    }
    const evaluations = await evaluationService.listEvaluations(
      input.simulationId,
    );
    source.simulation = { simulation, trace, snapshots, evaluations };
  }

  return source;
}

export async function project(input: {
  target: ProjectionTarget;
  contentId?: string | undefined;
  simulationId?: string | undefined;
}): Promise<ProjectionResult> {
  const adapter = adapters[input.target];
  const source = await resolveSource(input);
  const result = await adapter.project(source);
  // Contract-level guard: every adapter (current or future) must return an
  // ordered, duplicate-free chain ending in a projection link.
  validateProvenanceChain(result.provenance);
  return result;
}
