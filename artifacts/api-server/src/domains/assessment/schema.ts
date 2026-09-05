import { z } from "zod";

const nonBlank = z.string().trim().min(1);
const stringList = z.array(nonBlank);

export const AssessmentCompetencySchema = z.object({
  key: nonBlank,
  name: nonBlank,
  description: nonBlank.optional(),
}).strict();

const EvaluationDimensionSchema = z.object({
  key: nonBlank,
  label: nonBlank,
  weight: z.number().finite().nonnegative(),
  criteria: stringList.min(1),
  description: nonBlank.optional(),
}).strict();

export const AssessmentScenarioPackageV1Schema = z.object({
  schemaVersion: z.literal("1.0"),
  packageKey: nonBlank,
  version: nonBlank,
  publishedAt: z.string().datetime({ offset: true }),
  metadata: z.object({
    title: nonBlank,
    description: nonBlank,
    locale: nonBlank,
    tags: stringList,
  }).strict(),
  competencies: z.array(AssessmentCompetencySchema).min(1),
  scenarios: z.array(z.object({
    key: nonBlank,
    title: nonBlank,
    description: nonBlank,
    locale: nonBlank,
    categoryKey: nonBlank,
    competencies: stringList.min(1),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    estimatedTime: z.number().finite().positive(),
    objectiveType: nonBlank,
    context: z.object({
      situation: nonBlank,
      timeline: nonBlank,
      stakes: nonBlank,
      playerRole: nonBlank,
    }).strict(),
    objectives: stringList.min(1),
    successCriteria: stringList.min(1),
    personas: z.array(z.object({
      key: nonBlank,
      name: nonBlank,
      role: nonBlank,
      background: nonBlank,
      traits: stringList,
      isPrimary: z.boolean(),
    }).strict()).min(1),
    recommendedFlow: stringList.min(1),
    flow: z.array(z.object({
      key: nonBlank,
      title: nonBlank,
      description: nonBlank,
      beats: stringList,
    }).strict()).min(1),
    personaSwitches: z.array(z.object({
      fromPersonaKey: nonBlank,
      toPersonaKey: nonBlank,
      atFlowKey: nonBlank.optional(),
      reason: nonBlank.optional(),
    }).strict()),
    personaSwitchMode: z.enum(["manual", "automatic", "disabled"]),
    constraints: stringList,
    difficultyProfile: z.object({ level: nonBlank, rationale: nonBlank.optional() }).strict(),
    evaluation: z.object({
      dimensions: z.array(EvaluationDimensionSchema).min(1),
      passingScore: z.number().finite().min(0).max(100).optional(),
    }).strict(),
    termination: z.object({ conditions: stringList.min(1), maxTurns: z.number().int().positive() }).strict(),
    simulation: z.object({ mode: nonBlank, initialPrompt: nonBlank.optional(), rules: stringList.optional() }).strict(),
    analytics: z.object({ eventTypes: stringList, trackPersonaSwitches: z.boolean() }).strict(),
    targetDurationMinutes: z.number().finite().positive(),
    targetTurns: z.number().int().positive(),
    minValidTurns: z.number().int().positive(),
  }).strict()).min(1),
  provenance: z.object({
    source: z.literal("ContentX"),
    sourcePackageId: nonBlank,
    author: nonBlank,
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
}).strict();

export type AssessmentScenarioPackageV1SchemaType = z.infer<typeof AssessmentScenarioPackageV1Schema>;
export const AssessmentScenarioPackageSchema = AssessmentScenarioPackageV1Schema;