import { z } from "zod";

export const FailureSeveritySchema = z.enum(["info", "low", "medium", "high", "critical"]);
export type FailureSeverity = z.infer<typeof FailureSeveritySchema>;

export const ObservedBehavioralDivergenceSchema = z.object({
  expected: z.string(),
  observed: z.string(),
  turnNumber: z.number().int().optional(),
  actionTaken: z.string().optional(),
  expectedAction: z.string().optional(),
});
export type ObservedBehavioralDivergence = z.infer<typeof ObservedBehavioralDivergenceSchema>;

export const CausalHypothesisSchema = z.object({
  hypothesis: z.string(),
  confidence: z.enum(["provisional", "moderate", "high"]).default("provisional"),
  potentialContributingFactors: z.array(z.string()).default([]),
});
export type CausalHypothesis = z.infer<typeof CausalHypothesisSchema>;

export const HiddenFailurePatternSchema = z.object({
  id: z.string(),
  patternType: z.string(),
  metricId: z.string(),
  severity: FailureSeveritySchema,
  affectedScenarios: z.array(z.string()),
  affectedCohorts: z.array(z.string()),
  occurrences: z.number().int().nonnegative(),
  rate: z.number().min(0).max(1),
  evidenceTraceIds: z.array(z.string()),
  observedBehavioralDivergence: ObservedBehavioralDivergenceSchema,
  causalHypothesis: CausalHypothesisSchema,
});
export type HiddenFailurePattern = z.infer<typeof HiddenFailurePatternSchema>;

export const FailureDiscoveryReportSchema = z.object({
  reportId: z.string(),
  agentId: z.string(),
  agentVersion: z.string(),
  totalTrajectoriesAnalyzed: z.number().int(),
  discoveredFailures: z.array(HiddenFailurePatternSchema),
  impactAnalysis: z.object({
    criticalFailureCount: z.number().int(),
    highFailureCount: z.number().int(),
    overallFailureRate: z.number(),
    mostVulnerableCohort: z.string(),
    mostVulnerableScenario: z.string(),
  }),
  generatedAt: z.string().default(() => new Date().toISOString()),
});
export type FailureDiscoveryReport = z.infer<typeof FailureDiscoveryReportSchema>;

export const DimensionRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
});
export type DimensionRange = z.infer<typeof DimensionRangeSchema>;

export const TargetedStressCohortSpecSchema = z.object({
  cohortId: z.string(),
  name: z.string(),
  sourceFailurePatternId: z.string(),
  samplingStrategy: z.enum(["adversarial", "boundary", "extreme_stress"]).default("adversarial"),
  dimensions: z.record(DimensionRangeSchema),
  intensity: z.number().min(0).max(1).default(0.85),
});
export type TargetedStressCohortSpec = z.infer<typeof TargetedStressCohortSpecSchema>;

export const BeforeAfterEvidenceSchema = z.object({
  baselineTraceId: z.string(),
  stressTraceId: z.string(),
  observedDivergenceDelta: z.string(),
});
export type BeforeAfterEvidence = z.infer<typeof BeforeAfterEvidenceSchema>;

export const AdaptiveStressResultSchema = z.object({
  stressRunId: z.string(),
  targetAgentId: z.string(),
  sourceFailurePattern: HiddenFailurePatternSchema,
  targetedCohort: TargetedStressCohortSpecSchema,
  baselineFailureRate: z.number(),
  stressFailureRate: z.number(),
  amplificationFactor: z.number(),
  beforeAfterEvidence: z.array(BeforeAfterEvidenceSchema),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type AdaptiveStressResult = z.infer<typeof AdaptiveStressResultSchema>;
