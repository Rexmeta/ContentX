import { z } from "zod";
import { ActorTypeSchema } from "./spec";
import { ActorActionSchema } from "./actor";

export const TrajectorySourceSchema = z.object({
  type: z.enum(["llm", "rule", "environment", "human", "tool"]),
  provider: z.string().optional(),
  model: z.string().optional(),
  version: z.string().optional(),
});
export type TrajectorySource = z.infer<typeof TrajectorySourceSchema>;

export const StateSnapshotSchema = z.object({
  affective: z.record(z.number()).default({}),
  relational: z.record(z.number()).default({}),
  cognitive: z.record(z.unknown()).default({}),
});
export type StateSnapshot = z.infer<typeof StateSnapshotSchema>;

export const TrajectoryEventSchema = z.object({
  id: z.string().min(1),
  simulationId: z.string().min(1),
  runId: z.string().min(1),
  turn: z.number().int().nonnegative(),
  actorId: z.string().min(1),
  actorType: ActorTypeSchema,
  correlationId: z.string().min(1),
  parentEventId: z.string().optional(),
  source: TrajectorySourceSchema,
  stateBefore: StateSnapshotSchema.default({ affective: {}, relational: {}, cognitive: {} }),
  action: ActorActionSchema,
  stateAfter: StateSnapshotSchema.default({ affective: {}, relational: {}, cognitive: {} }),
  timestamp: z.string(),
});
export type TrajectoryEvent = z.infer<typeof TrajectoryEventSchema>;

export const SimulationOutcomeSchema = z.object({
  status: z.enum(["completed", "terminated", "failed", "escalated"]),
  turnsUsed: z.number().int().nonnegative(),
  goalReached: z.boolean(),
  summary: z.string().default(""),
  finalStates: z.record(StateSnapshotSchema).default({}),
  metrics: z.record(z.number()).default({}),
});
export type SimulationOutcome = z.infer<typeof SimulationOutcomeSchema>;

export const TrajectoryTraceSchema = z.object({
  simulationId: z.string().min(1),
  runId: z.string().min(1),
  specId: z.string().min(1),
  events: z.array(TrajectoryEventSchema),
  outcome: SimulationOutcomeSchema.optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});
export type TrajectoryTrace = z.infer<typeof TrajectoryTraceSchema>;
