import { z } from "zod";
import { ActorTypeSchema, type ActorType } from "./spec";

export const ObservationSchema = z.object({
  turn: z.number().int().nonnegative(),
  environmentState: z.record(z.unknown()).default({}),
  recentEvents: z.array(z.record(z.unknown())).default([]),
  actorState: z.record(z.unknown()).default({}),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const ToolCallSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.unknown()).default({}),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const ActorActionSchema = z.object({
  action: z.string().min(1),
  intent: z.string().default(""),
  utterance: z.string().optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
  reasonCodes: z.array(z.string()).default([]),
  policyIdTriggered: z.string().optional(),
  stateDeltas: z.record(z.record(z.number())).optional(),
});
export type ActorAction = z.infer<typeof ActorActionSchema>;

export const ActionResultSchema = z.object({
  success: z.boolean(),
  effect: z.record(z.unknown()).default({}),
  nextState: z.record(z.unknown()).optional(),
  error: z.string().optional(),
});
export type ActionResult = z.infer<typeof ActionResultSchema>;

/**
 * Base Actor Interface: Represents any participant in the simulation.
 * ToolActor and EnvActor implement this directly without requiring a decide() step.
 */
export interface Actor {
  id: string;
  type: ActorType;
  observe(context: Observation): Promise<Observation>;
  capabilities(): string[];
  execute(action: ActorAction): Promise<ActionResult>;
}

/**
 * DecisionActor Interface: Represents participants that make autonomous decisions
 * (e.g. PersonaActor, AIAgentTarget, HumanActor).
 */
export interface DecisionActor extends Actor {
  decide(observation: Observation): Promise<ActorAction>;
}

export function isDecisionActor(actor: Actor): actor is DecisionActor {
  return typeof (actor as DecisionActor).decide === "function";
}
