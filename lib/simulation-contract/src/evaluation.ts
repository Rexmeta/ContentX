import { z } from "zod";

export const EvaluationMetricResultSchema = z.object({
  metric: z.string().min(1),
  subjectType: z.enum(["agent", "simulation"]),
  subjectId: z.string().min(1),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1).default(1.0),
  evidenceEventIds: z.array(z.string()).default([]),
  summary: z.string().default(""),
});
export type EvaluationMetricResult = z.infer<typeof EvaluationMetricResultSchema>;

export const EvaluationResultSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  specId: z.string().min(1),
  evaluatorVersion: z.string().default("1.0.0"),
  overallScore: z.number().min(0).max(100),
  metrics: z.array(EvaluationMetricResultSchema).min(1),
  createdAt: z.string(),
  metadata: z.record(z.unknown()).default({}),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
