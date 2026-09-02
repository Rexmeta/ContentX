import { z } from "zod";
import {
  SimulationSpecSchema,
  type SimulationSpec,
} from "./spec";
import {
  TrajectoryEventSchema,
  TrajectoryTraceSchema,
  type TrajectoryEvent,
  type TrajectoryTrace,
} from "./trajectory";
import {
  EvaluationResultSchema,
  type EvaluationResult,
} from "./evaluation";
import {
  SimulationReplayEnvelopeSchema,
  type SimulationReplayEnvelope,
} from "./replay";

export interface ValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export interface ValidationReport<T> {
  success: boolean;
  data?: T;
  issues: ValidationIssue[];
}

export function validateSimulationSpec(input: unknown): ValidationReport<SimulationSpec> {
  const parseResult = SimulationSpecSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      issues: parseResult.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    };
  }

  const spec = parseResult.data;
  const issues: ValidationIssue[] = [];
  const actorIds = new Set(spec.actors.map((a) => a.id));

  // Check unique actor IDs
  if (actorIds.size !== spec.actors.length) {
    issues.push({
      path: "actors",
      message: "Duplicate actor IDs found in actors array",
    });
  }

  // Check relationships reference existing actors
  for (let i = 0; i < spec.relationships.length; i++) {
    const rel = spec.relationships[i];
    if (!actorIds.has(rel.sourceActorId)) {
      issues.push({
        path: `relationships.${i}.sourceActorId`,
        message: `Referenced sourceActorId "${rel.sourceActorId}" does not exist in actors`,
      });
    }
    if (!actorIds.has(rel.targetActorId)) {
      issues.push({
        path: `relationships.${i}.targetActorId`,
        message: `Referenced targetActorId "${rel.targetActorId}" does not exist in actors`,
      });
    }
  }

  // Check goals reference existing actors
  for (let i = 0; i < spec.goals.length; i++) {
    const goal = spec.goals[i];
    if (!actorIds.has(goal.actorId)) {
      issues.push({
        path: `goals.${i}.actorId`,
        message: `Referenced actorId "${goal.actorId}" in goal does not exist in actors`,
      });
    }
  }

  // Check behavior policies reference existing actors
  for (let i = 0; i < spec.behaviorPolicies.length; i++) {
    const policy = spec.behaviorPolicies[i];
    if (!actorIds.has(policy.actorId)) {
      issues.push({
        path: `behaviorPolicies.${i}.actorId`,
        message: `Referenced actorId "${policy.actorId}" in behavior policy does not exist in actors`,
      });
    }
  }

  return {
    success: issues.length === 0,
    data: issues.length === 0 ? spec : undefined,
    issues,
  };
}

export function validateTrajectoryEvent(input: unknown): ValidationReport<TrajectoryEvent> {
  const result = TrajectoryEventSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      })),
    };
  }
  return { success: true, data: result.data, issues: [] };
}

export function validateTrajectoryTrace(input: unknown): ValidationReport<TrajectoryTrace> {
  const result = TrajectoryTraceSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      })),
    };
  }
  return { success: true, data: result.data, issues: [] };
}

export function validateEvaluationResult(input: unknown): ValidationReport<EvaluationResult> {
  const result = EvaluationResultSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      })),
    };
  }
  return { success: true, data: result.data, issues: [] };
}

export function validateReplayEnvelope(input: unknown): ValidationReport<SimulationReplayEnvelope> {
  const result = SimulationReplayEnvelopeSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
        code: i.code,
      })),
    };
  }
  return { success: true, data: result.data, issues: [] };
}
