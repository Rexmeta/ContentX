/**
 * Evaluation domain model. Trace-derived, never opinion-derived: every
 * score cites evidence from InteractionEvents. Agent evaluations
 * (behavior, persona fidelity) and simulation evaluations (outcome) are
 * distinct subject types; learner evaluation is a future subjectType and
 * must never be conflated with agent evaluation.
 */
export const EVALUATION_KINDS = [
  "behavior",
  "personaFidelity",
  "outcome",
] as const;
export type EvaluationKind = (typeof EVALUATION_KINDS)[number];

export const EVALUATION_SUBJECT_TYPES = ["agent", "simulation"] as const;
export type EvaluationSubjectType = (typeof EVALUATION_SUBJECT_TYPES)[number];

export interface EvaluationProvenance {
  operation: "evaluate";
  createdAt: string;
  simulationId: string;
  evaluator: string;
  evaluatorVersion: string;
  /** Number of trace events the evaluation was computed from. */
  traceEventCount: number;
}

export interface Evaluation {
  id: string;
  simulationId: string;
  kind: EvaluationKind;
  subjectType: EvaluationSubjectType;
  subjectId: string;
  scores: Record<string, number>;
  findings: Record<string, unknown>;
  provenance: EvaluationProvenance;
  createdAt: string;
}

export class EvaluationNotFoundError extends Error {
  constructor(id: string) {
    super(`Evaluation "${id}" not found`);
    this.name = "EvaluationNotFoundError";
  }
}

export class InvalidEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEvaluationError";
  }
}
