/**
 * Evaluation service — computes trace-based evaluations for a completed
 * simulation: BehaviorEvaluation + PersonaFidelityEvaluation per agent,
 * plus one OutcomeEvaluation for the simulation. All rows persist in one
 * transaction with full provenance (evaluator + version + trace size).
 */
import type { EvaluationRow } from "@workspace/db";
import { newId } from "../../shared/id";
import * as simulationService from "../simulation/service";
import { SimulationNotFoundError } from "../simulation/model";
import * as snapshotService from "../character/snapshotService";
import { SnapshotNotFoundError } from "../character/snapshotModel";
import * as repo from "./repository";
import {
  evaluateBehavior,
  evaluateOutcome,
  evaluatePersonaFidelity,
  EVALUATOR_VERSION,
} from "./evaluators";
import type {
  Evaluation,
  EvaluationKind,
  EvaluationProvenance,
  EvaluationSubjectType,
} from "./model";

export { EvaluationNotFoundError, InvalidEvaluationError } from "./model";
export { SimulationNotFoundError };

export function toEvaluation(row: EvaluationRow): Evaluation {
  return {
    id: row.id,
    simulationId: row.simulationId,
    kind: row.kind as EvaluationKind,
    subjectType: row.subjectType as EvaluationSubjectType,
    subjectId: row.subjectId,
    scores: row.scores as Record<string, number>,
    findings: row.findings as Record<string, unknown>,
    provenance: row.provenance as EvaluationProvenance,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Run the full evaluation suite over a simulation's immutable trace. */
export async function evaluateSimulation(input: {
  simulationId: string;
}): Promise<Evaluation[]> {
  const simulation = await simulationService.getSimulation(input.simulationId);
  if (!simulation) throw new SimulationNotFoundError(input.simulationId);
  const trace = await simulationService.getTrace(input.simulationId);

  const now = new Date().toISOString();
  const provenance = (evaluator: string): EvaluationProvenance => ({
    operation: "evaluate",
    createdAt: now,
    simulationId: simulation.id,
    evaluator,
    evaluatorVersion: EVALUATOR_VERSION,
    traceEventCount: trace.length,
  });

  const rows = [];
  for (const participant of simulation.participants) {
    const behavior = evaluateBehavior(trace, participant.agentId);
    rows.push({
      id: newId("evaluation"),
      simulationId: simulation.id,
      kind: "behavior",
      subjectType: "agent",
      subjectId: participant.agentId,
      scores: behavior.scores,
      findings: behavior.findings,
      provenance: provenance("BehaviorEvaluation"),
    });

    const snapshot = await snapshotService.getSnapshot(participant.snapshotId);
    if (!snapshot) throw new SnapshotNotFoundError(participant.snapshotId);
    const fidelity = evaluatePersonaFidelity(
      trace,
      participant.agentId,
      snapshot,
    );
    rows.push({
      id: newId("evaluation"),
      simulationId: simulation.id,
      kind: "personaFidelity",
      subjectType: "agent",
      subjectId: participant.agentId,
      scores: fidelity.scores,
      findings: fidelity.findings,
      provenance: provenance("PersonaFidelityEvaluation"),
    });
  }

  const outcome = evaluateOutcome(simulation, trace);
  rows.push({
    id: newId("evaluation"),
    simulationId: simulation.id,
    kind: "outcome",
    subjectType: "simulation",
    subjectId: simulation.id,
    scores: outcome.scores,
    findings: outcome.findings,
    provenance: provenance("OutcomeEvaluation"),
  });

  const inserted = await repo.insertEvaluations(rows);
  return inserted.map(toEvaluation);
}

export async function getEvaluation(
  id: string,
): Promise<Evaluation | undefined> {
  const row = await repo.getEvaluation(id);
  return row ? toEvaluation(row) : undefined;
}

export async function listEvaluations(
  simulationId?: string,
): Promise<Evaluation[]> {
  return (await repo.listEvaluations(simulationId)).map(toEvaluation);
}
