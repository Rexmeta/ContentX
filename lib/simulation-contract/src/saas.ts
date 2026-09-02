import { z } from "zod";

export const UserRoleSchema = z.enum(["owner", "admin", "engineer", "analyst", "viewer"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const ApiKeyScopeSchema = z.enum([
  "benchmark:read",
  "benchmark:run",
  "evaluation:read",
  "agent:manage",
  "dataset:export",
  "deployment:gate",
]);
export type ApiKeyScope = z.infer<typeof ApiKeyScopeSchema>;

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  plan: z.enum(["developer", "team", "business", "enterprise"]).default("enterprise"),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type Project = z.infer<typeof ProjectSchema>;

export const MemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema.default("engineer"),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type Member = z.infer<typeof MemberSchema>;

export const ApiKeySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string().optional(),
  name: z.string(),
  keyPrefix: z.string(), // e.g. "rpx_live_..."
  keyHash: z.string(),   // SHA-256
  scopes: z.array(ApiKeyScopeSchema),
  lastUsedAt: z.string().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type ApiKey = z.infer<typeof ApiKeySchema>;

export const AuditLogActionSchema = z.enum([
  "organization_created",
  "project_created",
  "agent_registered",
  "agent_version_created",
  "contract_check_executed",
  "benchmark_started",
  "benchmark_completed",
  "regression_detected",
  "deployment_approved",
  "deployment_blocked",
  "api_key_generated",
  "dataset_package_exported",
]);
export type AuditLogAction = z.infer<typeof AuditLogActionSchema>;

export const AuditLogEntrySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string().optional(),
  actorId: z.string(),
  actorType: z.enum(["user", "service_account", "ci_cd_webhook", "system"]),
  action: AuditLogActionSchema,
  targetResourceId: z.string(),
  targetResourceType: z.string(),
  metadata: z.record(z.unknown()).default({}),
  timestamp: z.string().default(() => new Date().toISOString()),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export const UsageMetricsSchema = z.object({
  organizationId: z.string(),
  period: z.string(), // e.g. "2026-09"
  simulationRuns: z.number().int().nonnegative().default(0),
  simulationRunsQuota: z.number().int().default(50000),
  llmTokens: z.number().int().nonnegative().default(0),
  evaluationRuns: z.number().int().nonnegative().default(0),
  storageBytes: z.number().int().nonnegative().default(0),
  apiRequests: z.number().int().nonnegative().default(0),
});
export type UsageMetrics = z.infer<typeof UsageMetricsSchema>;

export const CalibrationCertificationSchema = z.enum([
  "certified_gold_standard",
  "provisional_synthetic",
  "uncalibrated",
]);
export type CalibrationCertification = z.infer<typeof CalibrationCertificationSchema>;

export const UnifiedDashboardSummarySchema = z.object({
  organizationId: z.string(),
  projectId: z.string().optional(),
  // Question 1: Is my Agent safe?
  agentQuality: z.object({
    overallScore: z.number(),
    regressionStatus: z.enum(["PASS", "WARN", "FAIL", "NO_CANDIDATE"]),
    failureRate: z.number(),
    validRunRate: z.number(),
    calibrationCertification: CalibrationCertificationSchema.default("provisional_synthetic"),
  }),
  // Question 2: What changed?
  whatChanged: z.object({
    baselineVersion: z.string(),
    candidateVersion: z.string(),
    scoreDeltas: z.record(z.number()),
    criticalRegressions: z.array(z.string()),
    deploymentGate: z.enum(["APPROVED", "BLOCKED", "WARNING"]),
  }).optional(),
  benchmarkHealth: z.object({
    totalRuns: z.number().int(),
    totalExperiments: z.number().int(),
    totalAgents: z.number().int(),
    totalScenarios: z.number().int(),
    totalPersonas: z.number().int(),
  }),
  reliability: z.object({
    p50LatencyMs: z.number(),
    p95LatencyMs: z.number(),
    retryRate: z.number(),
    estimatedCostPer1kRunsUSD: z.number(),
  }),
});
export type UnifiedDashboardSummary = z.infer<typeof UnifiedDashboardSummarySchema>;

export const FailureExplorerNodeSchema = z.object({
  patternType: z.string(),
  description: z.string(),
  frequency: z.number().int(),
  rate: z.number(),
  baselineRate: z.number().optional(),
  rateDelta: z.number().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  affectedCohorts: z.array(z.string()),
  affectedScenarios: z.array(z.string()),
  evidenceRunIds: z.array(z.string()),
  // Behavioral evidence instead of unproven causal assertions:
  observedBehavioralDivergence: z.string(),
  causalHypothesis: z.string(),
});
export type FailureExplorerNode = z.infer<typeof FailureExplorerNodeSchema>;

export const CorrelationLineageSchema = z.object({
  requestId: z.string(),
  organizationId: z.string(),
  projectId: z.string().optional(),
  experimentId: z.string().optional(),
  runId: z.string().optional(),
  trajectoryId: z.string().optional(),
  evaluationId: z.string().optional(),
  failureId: z.string().optional(),
  deploymentId: z.string().optional(),
  timestamp: z.string().default(() => new Date().toISOString()),
});
export type CorrelationLineage = z.infer<typeof CorrelationLineageSchema>;
