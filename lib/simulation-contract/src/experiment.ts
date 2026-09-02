import { z } from "zod";
import { SimulationActorSpecSchema } from "./spec";

export const ExperimentRunStateSchema = z.enum([
  "pending",
  "queued",
  "running",
  "succeeded",
  "failed",
  "retrying",
  "cancelled",
]);
export type ExperimentRunState = z.infer<typeof ExperimentRunStateSchema>;

export const RunCostMetricsSchema = z.object({
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  estimatedCost: z.number().nonnegative().default(0.0), // in USD
  latencyMs: z.number().int().nonnegative().default(0),
  provider: z.string().default("openai"),
  model: z.string().default("gpt-4o"),
});
export type RunCostMetrics = z.infer<typeof RunCostMetricsSchema>;

export const ExecutionPolicySchema = z.object({
  concurrencyByProvider: z.record(z.number().int().positive()).default({
    openai: 10,
    anthropic: 5,
    google: 10,
    http: 20,
    mock: 50,
  }),
  maxRetries: z.number().int().nonnegative().default(3),
  retryBackoffMs: z.number().int().positive().default(100),
  timeoutMs: z.number().int().positive().default(30000),
});
export type ExecutionPolicy = z.infer<typeof ExecutionPolicySchema>;

export const ExperimentSpecSchema = z.object({
  id: z.string(),
  benchmarkId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  specIds: z.array(z.string()),
  targetAgents: z.array(SimulationActorSpecSchema),
  samplingStrategy: z.enum(["random", "stratified", "boundary", "adversarial", "scenario_driven"]).default("stratified"),
  sampleSize: z.number().int().positive().default(10),
  repetitions: z.number().int().positive().default(1),
  baseSeed: z.number().int().default(42),
  evaluatorVersion: z.string().default("2.0.0-multi-layer"),
  executionPolicy: ExecutionPolicySchema.default({}),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type ExperimentSpec = z.infer<typeof ExperimentSpecSchema>;

export const ExperimentRunEntrySchema = z.object({
  runId: z.string(),
  experimentId: z.string(),
  specId: z.string(),
  personaId: z.string(),
  agentId: z.string(),
  agentName: z.string(),
  provider: z.string(),
  seed: z.number().int(),
  repetition: z.number().int(),
  state: ExperimentRunStateSchema,
  attempts: z.number().int().default(0),
  cost: RunCostMetricsSchema.default({}),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  runResult: z.unknown().optional(), // Holds SimulationRunResult
});
export type ExperimentRunEntry = z.infer<typeof ExperimentRunEntrySchema>;

export const ExperimentExecutionReportSchema = z.object({
  experimentId: z.string(),
  benchmarkId: z.string(),
  totalPlannedRuns: z.number().int(),
  succeededRuns: z.number().int(),
  failedRuns: z.number().int(),
  totalDurationMs: z.number(),
  runsPerMinute: z.number(),
  totalCostUSD: z.number(),
  costPer1kRunsUSD: z.number(),
  latencyP50Ms: z.number(),
  latencyP95Ms: z.number(),
  validRunRate: z.number(), // 0.0 ~ 1.0 (e.g. 0.983)
  runs: z.array(ExperimentRunEntrySchema),
  completedAt: z.string(),
});
export type ExperimentExecutionReport = z.infer<typeof ExperimentExecutionReportSchema>;
