import { z } from "zod";

export const AgentVersionStatusSchema = z.enum(["draft", "candidate", "active", "deprecated"]);
export type AgentVersionStatus = z.infer<typeof AgentVersionStatusSchema>;

export const AgentVersionSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  version: z.string(),
  configurationHash: z.string(),
  endpoint: z.object({
    protocol: z.enum(["http", "webhook", "mcp", "sdk"]),
    endpointUrl: z.string().optional(),
    authConfig: z.record(z.unknown()).optional(),
  }),
  metadata: z.object({
    releaseId: z.string().optional(),
    gitCommit: z.string().optional(),
    deploymentId: z.string().optional(),
    environment: z.string().default("production"),
  }).default({ environment: "production" }),
  status: AgentVersionStatusSchema.default("candidate"),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type AgentVersion = z.infer<typeof AgentVersionSchema>;

export const EvaluationContextSnapshotSchema = z.object({
  contextHash: z.string(),
  specHash: z.string(),
  populationSnapshotHash: z.string(),
  rubricHash: z.string(),
  evaluatorVersion: z.string(),
  judgeCalibrationVersion: z.string().default("1.0.0"),
  seedPolicy: z.string().default("deterministic-combinatorial-v1"),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type EvaluationContextSnapshot = z.infer<typeof EvaluationContextSnapshotSchema>;

export const EvaluationTierSchema = z.enum(["tier0_smoke", "tier1_regression", "tier2_full"]);
export type EvaluationTier = z.infer<typeof EvaluationTierSchema>;

export const RegressionStatisticsSchema = z.object({
  n: z.number().int().positive(),
  mean: z.number(),
  stdDev: z.number(),
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
  confidenceInterval95: z.tuple([z.number(), z.number()]),
});
export type RegressionStatistics = z.infer<typeof RegressionStatisticsSchema>;

export const MetricRegressionSchema = z.object({
  metric: z.string(),
  baselineScore: z.number(),
  candidateScore: z.number(),
  delta: z.number(),
  effectSize: z.number(), // Cohen's d
  status: z.enum(["pass", "warn", "fail"]),
});
export type MetricRegression = z.infer<typeof MetricRegressionSchema>;

export const CohortRegressionSchema = z.object({
  cohortName: z.string(),
  baselineScore: z.number(),
  candidateScore: z.number(),
  delta: z.number(),
  status: z.enum(["pass", "warn", "fail"]),
  criticalFailure: z.boolean().default(false),
});
export type CohortRegression = z.infer<typeof CohortRegressionSchema>;

export const ScenarioRegressionSchema = z.object({
  scenarioId: z.string(),
  baselineScore: z.number(),
  candidateScore: z.number(),
  delta: z.number(),
  status: z.enum(["pass", "warn", "fail"]),
});
export type ScenarioRegression = z.infer<typeof ScenarioRegressionSchema>;

export const FailurePatternRegressionSchema = z.object({
  patternType: z.string(),
  baselineRate: z.number(), // 0.0 ~ 1.0
  candidateRate: z.number(), // 0.0 ~ 1.0
  rateDelta: z.number(),     // candidateRate - baselineRate
  status: z.enum(["pass", "warn", "fail"]),
  evidenceRunIds: z.array(z.string()),
});
export type FailurePatternRegression = z.infer<typeof FailurePatternRegressionSchema>;

export const TrajectoryDifferentialSchema = z.object({
  runId: z.string(),
  divergenceTurn: z.number().int(),
  baselineAction: z.string(),
  candidateAction: z.string(),
  causeHypothesis: z.string(),
  evidenceEventIds: z.array(z.string()),
});
export type TrajectoryDifferential = z.infer<typeof TrajectoryDifferentialSchema>;

export const RegressionReportSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  baselineVersionId: z.string(),
  candidateVersionId: z.string(),
  evaluationContextHash: z.string(),
  tier: EvaluationTierSchema,
  status: z.enum(["pass", "warn", "fail"]),
  isComparable: z.boolean().default(true),
  overall: z.object({
    baseline: RegressionStatisticsSchema,
    candidate: RegressionStatisticsSchema,
    delta: z.number(),
    effectSize: z.number().optional(),
  }),
  metricRegressions: z.array(MetricRegressionSchema),
  cohortRegressions: z.array(CohortRegressionSchema),
  scenarioRegressions: z.array(ScenarioRegressionSchema),
  failurePatternRegressions: z.array(FailurePatternRegressionSchema),
  trajectoryDifferentials: z.array(TrajectoryDifferentialSchema),
  recommendation: z.string(),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type RegressionReport = z.infer<typeof RegressionReportSchema>;

export const EvaluationJobSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  candidateVersionId: z.string(),
  baselineVersionId: z.string(),
  tier: EvaluationTierSchema.default("tier1_regression"),
  trigger: z.enum(["manual", "schedule", "deployment", "webhook", "api"]).default("manual"),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).default("pending"),
  evaluationContextHash: z.string(),
  reportId: z.string().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});
export type EvaluationJob = z.infer<typeof EvaluationJobSchema>;

export const DeploymentGateResultSchema = z.object({
  decision: z.enum(["APPROVED", "BLOCKED", "WARNING"]),
  jobId: z.string(),
  reportId: z.string(),
  agentId: z.string(),
  candidateVersionId: z.string(),
  reason: z.string(),
  regressionReport: RegressionReportSchema.optional(),
});
export type DeploymentGateResult = z.infer<typeof DeploymentGateResultSchema>;
