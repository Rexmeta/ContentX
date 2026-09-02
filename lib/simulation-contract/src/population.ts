import { z } from "zod";
import { SimulationActorSpecSchema } from "./spec";

export const DimensionDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  min: z.number().default(0.0),
  max: z.number().default(1.0),
  defaultValue: z.number().default(0.5),
  boundaryThresholds: z.array(z.number()).default([0.3, 0.7]),
});
export type DimensionDefinition = z.infer<typeof DimensionDefinitionSchema>;

export const PersonaCohortSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  archetype: z.string(), // e.g. "highly_frustrated_assertive", "calm_cooperative", "impatient_policy_aware"
  dimensions: z.record(z.object({
    min: z.number(),
    max: z.number(),
    target: z.number(),
  })),
  behaviorTendencies: z.array(z.string()).default([]),
  expectedFailureModes: z.array(z.string()).default([]),
});
export type PersonaCohort = z.infer<typeof PersonaCohortSchema>;

export const SamplingStrategySchema = z.enum([
  "random",
  "stratified",
  "boundary",
  "adversarial",
  "scenario_driven",
]);
export type SamplingStrategy = z.infer<typeof SamplingStrategySchema>;

export const SamplingRequestSchema = z.object({
  strategy: SamplingStrategySchema,
  sampleSize: z.number().int().positive().default(10),
  cohortIds: z.array(z.string()).optional(),
  targetDimensions: z.array(z.string()).optional(),
  scenarioDomain: z.string().optional(),
  baseSeed: z.number().int().optional().default(42),
  adversarialTargetWeaknesses: z.array(z.string()).optional(),
});
export type SamplingRequest = z.infer<typeof SamplingRequestSchema>;

export const SamplingResultSchema = z.object({
  strategy: SamplingStrategySchema,
  sampleSize: z.number().int(),
  personas: z.array(SimulationActorSpecSchema),
  sampledCohorts: z.array(z.string()),
  metadata: z.record(z.unknown()).default({}),
});
export type SamplingResult = z.infer<typeof SamplingResultSchema>;

export const PopulationCoverageReportSchema = z.object({
  benchmarkSpaceCoverage: z.number(), // 0 ~ 100% (scientifically grounded name)
  configuredBehavioralSpaceCoverage: z.number(), // alias for compatibility
  behavioralCoverage: z.number(), // 0 ~ 100%
  dimensionCoverage: z.number(),  // 0 ~ 100%
  cohortCoverage: z.number(),     // 0 ~ 100%
  boundaryCoverage: z.number(),   // 0 ~ 100%
  scenarioCoverage: z.number(),   // 0 ~ 100%
  overallCoverageScore: z.number(), // legacy alias
  uncoveredRegions: z.array(z.string()),
  summary: z.string(),
});
export type PopulationCoverageReport = z.infer<typeof PopulationCoverageReportSchema>;

export const AdaptiveSamplingRequestSchema = z.object({
  benchmarkId: z.string(),
  failurePatterns: z.array(z.string()),
  vulnerableCohorts: z.array(z.string()),
  sampleSize: z.number().int().positive().default(10),
  intensity: z.number().min(0.0).max(1.0).default(0.8), // Stresses boundary conditions
});
export type AdaptiveSamplingRequest = z.infer<typeof AdaptiveSamplingRequestSchema>;

/**
 * Universal Population Provider Contract:
 * Allows Local, CSV, API, and MatrAIx engines to be interchangeable.
 */
export interface PopulationProvider {
  readonly name: string;
  listDimensions(): Promise<DimensionDefinition[]>;
  listCohorts(): Promise<PersonaCohort[]>;
  sample(request: SamplingRequest): Promise<SamplingResult>;
  getPersona(id: string): Promise<z.infer<typeof SimulationActorSpecSchema> | undefined>;
}
