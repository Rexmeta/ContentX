/**
 * Evaluation lineage resolver — walks provenance REFERENCES backwards from
 * any Evaluation to its origin:
 *
 *   evaluation → simulationId → agentId → snapshotId → samplingRunId
 *              → populationId → importId → matraixId
 *
 * Nothing is copied along the chain; every hop is resolved from the stored
 * reference. A missing hop is an explicit LineageBrokenError, never a
 * silently shortened chain.
 */
import * as simulationService from "../simulation/service";
import * as agentService from "../agent/service";
import * as snapshotService from "../character/snapshotService";
import * as populationService from "../population/service";
import * as contentRepo from "../content/repository";
import * as repo from "./repository";
import { EvaluationNotFoundError } from "./model";
import { toEvaluation } from "./service";

export class LineageBrokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LineageBrokenError";
  }
}

export interface AgentLineage {
  agentId: string;
  snapshotId: string;
  characterId: string;
  samplingRunId: string | null;
  populationId: string | null;
  populationVersion: number | null;
  seed: number | null;
  /** Import references from population provenance (matraix bridge). */
  importId: string | null;
  matraixId: string | null;
  sourceUri: string | null;
}

export interface EvaluationLineage {
  evaluationId: string;
  kind: string;
  simulationId: string;
  simulationSeed: number;
  agents: AgentLineage[];
}

export async function resolveEvaluationLineage(
  evaluationId: string,
): Promise<EvaluationLineage> {
  const row = await repo.getEvaluation(evaluationId);
  if (!row) throw new EvaluationNotFoundError(evaluationId);
  const evaluation = toEvaluation(row);

  const simulation = await simulationService.getSimulation(
    evaluation.simulationId,
  );
  if (!simulation) {
    throw new LineageBrokenError(
      `Evaluation "${evaluationId}" references missing simulation "${evaluation.simulationId}".`,
    );
  }

  const participants =
    evaluation.subjectType === "agent"
      ? simulation.participants.filter(
          (p) => p.agentId === evaluation.subjectId,
        )
      : simulation.participants;
  if (participants.length === 0) {
    throw new LineageBrokenError(
      `Evaluation "${evaluationId}" subject "${evaluation.subjectId}" is not a participant of simulation "${simulation.id}".`,
    );
  }

  const agents: AgentLineage[] = [];
  for (const participant of participants) {
    const agent = await agentService.getAgentWithState(participant.agentId);
    if (!agent) {
      throw new LineageBrokenError(
        `Simulation "${simulation.id}" references missing agent "${participant.agentId}".`,
      );
    }
    const snapshot = await snapshotService.getSnapshot(agent.snapshotId);
    if (!snapshot) {
      throw new LineageBrokenError(
        `Agent "${agent.id}" references missing snapshot "${agent.snapshotId}".`,
      );
    }

    const samplingRunId = snapshot.provenance.samplingRunId ?? null;
    let populationId = snapshot.populationId;
    let populationVersion = snapshot.provenance.populationVersion ?? null;
    if (samplingRunId) {
      const run = await populationService.getSamplingRun(samplingRunId);
      if (!run) {
        throw new LineageBrokenError(
          `Snapshot "${snapshot.id}" references missing sampling run "${samplingRunId}".`,
        );
      }
      populationId = run.populationId;
      populationVersion = run.populationVersion;
    }

    let importId: string | null = null;
    let matraixId: string | null = null;
    let sourceUri: string | null = null;
    if (populationId) {
      const population = await populationService.getPopulation(populationId);
      if (!population) {
        throw new LineageBrokenError(
          `Snapshot "${snapshot.id}" references missing population "${populationId}".`,
        );
      }
      importId = population.provenance.importId ?? null;
      matraixId = population.provenance.matraixId ?? null;
      sourceUri = population.provenance.sourceUri ?? null;

      // The import hop is a reference too — verify it still resolves instead
      // of reporting a lineage that dangles into a deleted import.
      if (importId) {
        const content = await contentRepo.getContent(importId);
        if (!content) {
          throw new LineageBrokenError(
            `Population "${populationId}" references missing imported content "${importId}".`,
          );
        }
        const recordedVersion = population.provenance.contentVersion;
        if (
          typeof recordedVersion === "number" &&
          content.version < recordedVersion
        ) {
          throw new LineageBrokenError(
            `Population "${populationId}" was bridged from content "${importId}" version ${recordedVersion}, but the content is now at version ${content.version}.`,
          );
        }
      }
    }

    agents.push({
      agentId: agent.id,
      snapshotId: snapshot.id,
      characterId: snapshot.characterId,
      samplingRunId,
      populationId: populationId ?? null,
      populationVersion,
      seed: snapshot.seed,
      importId,
      matraixId,
      sourceUri,
    });
  }

  return {
    evaluationId: evaluation.id,
    kind: evaluation.kind,
    simulationId: simulation.id,
    simulationSeed: simulation.seed,
    agents,
  };
}
