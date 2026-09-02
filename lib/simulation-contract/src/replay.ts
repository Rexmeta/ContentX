import { z } from "zod";

export const ReplayModeSchema = z.enum(["recorded", "reexecute"]);
export type ReplayMode = z.infer<typeof ReplayModeSchema>;

export const ReproducibilityMetadataSchema = z.object({
  mode: z.enum(["exact", "parameterized"]),
  guarantee: z.enum(["exact", "best_effort"]),
  reproducibilityKey: z.string(),
  varianceNote: z.string().optional(),
});
export type ReproducibilityMetadata = z.infer<typeof ReproducibilityMetadataSchema>;

export const SimulationReplayEnvelopeSchema = z.object({
  simulationId: z.string().min(1),
  runId: z.string().min(1),
  specVersion: z.string().min(1),
  actorVersions: z.record(z.string()).default({}),
  modelVersions: z.record(z.string()).default({}),
  promptTemplateVersions: z.record(z.string()).default({}),
  toolVersions: z.record(z.string()).default({}),
  runtimeVersion: z.string().default("1.0.0"),
  seed: z.number().int(),
  environmentType: z.string().min(1),
  mode: ReplayModeSchema,
  reproducibility: ReproducibilityMetadataSchema.default({
    mode: "exact",
    guarantee: "exact",
    reproducibilityKey: "default-key",
  }),
});
export type SimulationReplayEnvelope = z.infer<typeof SimulationReplayEnvelopeSchema>;

export const ReplayRequestSchema = z.object({
  mode: ReplayModeSchema.default("recorded"),
  overrideSeed: z.number().int().optional(),
});
export type ReplayRequest = z.infer<typeof ReplayRequestSchema>;
