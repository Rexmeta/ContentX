import { z } from "zod";

export const StatisticalMetricsSchema = z.object({
  mean: z.number(),
  stdDev: z.number(),
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
  confidenceInterval95: z.tuple([z.number(), z.number()]),
});
export type StatisticalMetrics = z.infer<typeof StatisticalMetricsSchema>;

export const FailurePatternSchema = z.object({
  patternType: z.string(), // e.g. "excessive_concession", "escalation_delay", "policy_bypass"
  description: z.string(),
  frequency: z.number(), // count of runs exhibiting this failure
  rate: z.number(), // percentage 0.0 ~ 1.0
  evidenceTraceIds: z.array(z.string()),
});
export type FailurePattern = z.infer<typeof FailurePatternSchema>;

export const PersonaSensitivityCohortSchema = z.object({
  cohortName: z.string(), // e.g. "calm_customer", "frustrated_customer", "manipulative_customer"
  totalRuns: z.number().int().nonnegative(),
  averageScore: z.number(),
  failureRate: z.number(),
  commonFailurePatterns: z.array(z.string()),
});
export type PersonaSensitivityCohort = z.infer<typeof PersonaSensitivityCohortSchema>;

export const JudgeCalibrationReportSchema = z.object({
  calibrationSetId: z.string(),
  sampleSize: z.number().int().positive(),
  humanExpertAgreement: z.number().min(0).max(1), // e.g. 0.91 (91% agreement)
  pearsonCorrelation: z.number().min(-1).max(1), // e.g. 0.88
  cohenKappa: z.number().min(-1).max(1),         // e.g. 0.84 (inter-rater agreement)
  meanAbsoluteError: z.number().min(0),          // e.g. 3.2 points
  biasOffset: z.number(),                         // e.g. +1.1 (slight leniency bias)
  status: z.enum(["calibrated", "uncalibrated"]).default("calibrated"),
  summary: z.string(),
});
export type JudgeCalibrationReport = z.infer<typeof JudgeCalibrationReportSchema>;

export const DiscriminativePowerMetricsSchema = z.object({
  agentSeparationIndex: z.number().min(0), // Effect size Cohen's d across top vs lower agents
  failureSensitivityRate: z.number().min(0).max(1), // Rate at which intentional violations are detected
  regressionSensitivity: z.number().min(0).max(1), // Ability to detect v1 -> v2 behavioral regressions
  isDiscriminative: z.boolean(),
  analysis: z.string(),
});
export type DiscriminativePowerMetrics = z.infer<typeof DiscriminativePowerMetricsSchema>;

export const BenchmarkValidityReportSchema = z.object({
  reliabilityScore: z.number().min(0).max(100),
  validityScore: z.number().min(0).max(100),
  benchmarkSpaceCoverage: z.number().min(0).max(100),
  discriminativePower: DiscriminativePowerMetricsSchema,
  judgeCalibration: JudgeCalibrationReportSchema.optional(),
  overallValidityStatus: z.enum(["certified_valid", "provisional", "insufficient_discrimination"]),
  summary: z.string(),
});
export type BenchmarkValidityReport = z.infer<typeof BenchmarkValidityReportSchema>;

export const AgentBenchmarkAnalysisSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  provider: z.string(),
  totalRuns: z.number().int().positive(),
  overallStats: StatisticalMetricsSchema,
  metricStats: z.record(StatisticalMetricsSchema),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  failurePatterns: z.array(FailurePatternSchema),
  personaSensitivity: z.array(PersonaSensitivityCohortSchema),
});
export type AgentBenchmarkAnalysis = z.infer<typeof AgentBenchmarkAnalysisSchema>;

export const ComprehensiveBenchmarkReportSchema = z.object({
  benchmarkId: z.string(),
  matrixId: z.string(),
  generatedAt: z.string(),
  totalSimulations: z.number().int().positive(),
  agents: z.array(AgentBenchmarkAnalysisSchema),
  comparativeRadar: z.array(z.record(z.union([z.string(), z.number()]))),
  validityReport: BenchmarkValidityReportSchema.optional(),
  executiveSummary: z.string(),
});
export type ComprehensiveBenchmarkReport = z.infer<typeof ComprehensiveBenchmarkReportSchema>;
