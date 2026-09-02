import { z } from "zod";

/**
 * Universal Agent Endpoint Configuration
 * Decoupled from specific LLM providers to support OpenAI, Anthropic, Google,
 * Custom HTTP Webhooks, MCP agents, and local heuristic mocks.
 */
export const AgentEndpointConfigSchema = z.object({
  provider: z.string().min(1),
  config: z.record(z.unknown()).default({}),
});
export type AgentEndpointConfig = z.infer<typeof AgentEndpointConfigSchema>;

export const ActorTypeSchema = z.enum([
  "persona_actor",
  "ai_agent_target",
  "human_actor",
  "tool_actor",
  "env_actor",
]);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const SimulationActorSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  actorType: ActorTypeSchema,
  personaSnapshotId: z.string().optional(),
  behaviorProfile: z
    .object({
      traits: z.record(z.union([z.string(), z.number()])).default({}),
      initialState: z.record(z.record(z.number())).default({}),
    })
    .optional(),
  agentConfig: AgentEndpointConfigSchema.optional(),
});
export type SimulationActorSpec = z.infer<typeof SimulationActorSpecSchema>;

export const WorldSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  rules: z.array(z.string()).default([]),
  context: z.record(z.unknown()).default({}),
});
export type WorldSpec = z.infer<typeof WorldSpecSchema>;

export const EnvironmentSpecSchema = z.object({
  type: z.string().min(1),
  config: z.record(z.unknown()).default({}),
  termination: z.object({
    maxTurns: z.number().int().positive().default(10),
    timeoutMs: z.number().int().positive().optional(),
    successCondition: z.string().optional(),
  }),
});
export type EnvironmentSpec = z.infer<typeof EnvironmentSpecSchema>;

export const RelationshipSpecSchema = z.object({
  sourceActorId: z.string().min(1),
  targetActorId: z.string().min(1),
  type: z.string().min(1),
  intensity: z.number().min(-1).max(1).default(0),
});
export type RelationshipSpec = z.infer<typeof RelationshipSpecSchema>;

export const GoalSpecSchema = z.object({
  actorId: z.string().min(1),
  description: z.string().min(1),
  priority: z.number().int().min(1).max(10).default(5),
  successCriteria: z.string().min(1),
});
export type GoalSpec = z.infer<typeof GoalSpecSchema>;

export const ConstraintSpecSchema = z.object({
  actorId: z.string().optional(),
  type: z.enum(["hard", "soft"]).default("hard"),
  rule: z.string().min(1),
});
export type ConstraintSpec = z.infer<typeof ConstraintSpecSchema>;

export const BehaviorPolicyTriggerSchema = z.object({
  condition: z.string().min(1),
});
export type BehaviorPolicyTrigger = z.infer<typeof BehaviorPolicyTriggerSchema>;

export const BehaviorPolicyResponseSchema = z.object({
  action: z.string().min(1),
  reasonCode: z.string().min(1),
  stateDeltas: z.record(z.record(z.number())).optional(),
});
export type BehaviorPolicyResponse = z.infer<typeof BehaviorPolicyResponseSchema>;

export const BehaviorPolicySpecSchema = z.object({
  id: z.string().min(1),
  actorId: z.string().min(1),
  trigger: BehaviorPolicyTriggerSchema,
  response: BehaviorPolicyResponseSchema,
});
export type BehaviorPolicySpec = z.infer<typeof BehaviorPolicySpecSchema>;

export const EvaluationMetricRubricSchema = z.object({
  name: z.string().min(1),
  subjectType: z.enum(["agent", "simulation"]).default("agent"),
  subjectId: z.string().optional(),
  weight: z.number().min(0).max(1).default(1),
  criteriaPrompt: z.string().min(1),
});
export type EvaluationMetricRubric = z.infer<typeof EvaluationMetricRubricSchema>;

export const EvaluationRubricSpecSchema = z.object({
  metrics: z.array(EvaluationMetricRubricSchema).min(1),
});
export type EvaluationRubricSpec = z.infer<typeof EvaluationRubricSpecSchema>;

/**
 * Canonical Simulation Specification v1
 * The core API / Data contract between ContentX (Compiler) and RoleplayX (Runtime).
 */
export const SimulationSpecSchema = z.object({
  schemaVersion: z.literal("1.0.0").default("1.0.0"),
  id: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(1),
  version: z.number().int().positive().default(1),
  metadata: z.object({
    author: z.string().default("system"),
    createdAt: z.string(),
    description: z.string().default(""),
    tags: z.array(z.string()).default([]),
  }),
  world: WorldSpecSchema,
  environment: EnvironmentSpecSchema,
  actors: z.array(SimulationActorSpecSchema).min(1),
  relationships: z.array(RelationshipSpecSchema).default([]),
  goals: z.array(GoalSpecSchema).default([]),
  constraints: z.array(ConstraintSpecSchema).default([]),
  behaviorPolicies: z.array(BehaviorPolicySpecSchema).default([]),
  evaluationRubric: EvaluationRubricSpecSchema,
  expectedOutcomes: z.record(z.unknown()).optional(),
});
export type SimulationSpec = z.infer<typeof SimulationSpecSchema>;
