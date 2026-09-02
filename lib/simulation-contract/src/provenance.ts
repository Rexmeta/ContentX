import { z } from "zod";
import { createHash } from "crypto";

export const SourceTypeSchema = z.enum([
  "matraix_raw",
  "matraix_curated",
  "contentx_canonical",
  "synthetic_perturbed",
  "manual",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceProvenanceSchema = z.object({
  sourceType: SourceTypeSchema,
  sourceId: z.string(),
  sourceVersion: z.string().default("1.0.0"),
  sourceDataset: z.string().optional(),
  sourceDatasetVersion: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type SourceProvenance = z.infer<typeof SourceProvenanceSchema>;

export const ProvenanceLineageSchema = z.object({
  samplingRunId: z.string().optional(),
  populationVersion: z.string().optional(),
  characterId: z.string().optional(),
  snapshotId: z.string().optional(),
  trajectoryId: z.string().optional(),
  evaluationId: z.string().optional(),
  evidenceTraceId: z.string().optional(),
});
export type ProvenanceLineage = z.infer<typeof ProvenanceLineageSchema>;

export const CanonicalLineageRecordSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string().optional(),
  source: SourceProvenanceSchema,
  lineage: ProvenanceLineageSchema,
  entityLineageHash: z.string(), // SHA-256 of canonically ordered payload
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type CanonicalLineageRecord = z.infer<typeof CanonicalLineageRecordSchema>;

/**
 * Deterministically serialize an object into canonical JSON with alphabetically sorted keys
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalJsonStringify(item)).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys
    .filter((k) => (obj as Record<string, unknown>)[k] !== undefined)
    .map((k) => JSON.stringify(k) + ":" + canonicalJsonStringify((obj as Record<string, unknown>)[k]));
  return "{" + pairs.join(",") + "}";
}

/**
 * Computes a deterministic SHA-256 hash across source dataset, version, ID, and canonical entity payload
 */
export function computeCanonicalLineageHash(input: {
  sourceType: SourceType;
  sourceId: string;
  sourceVersion: string;
  sourceDataset?: string;
  sourceDatasetVersion?: string;
  canonicalPayload: Record<string, unknown>;
  dimensions?: Record<string, number>;
  traits?: Record<string, unknown>;
}): string {
  const canonicalString = canonicalJsonStringify({
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceVersion: input.sourceVersion,
    sourceDataset: input.sourceDataset ?? "",
    sourceDatasetVersion: input.sourceDatasetVersion ?? "",
    canonicalPayload: input.canonicalPayload,
    dimensions: input.dimensions ?? {},
    traits: input.traits ?? {},
  });

  return createHash("sha256").update(canonicalString).digest("hex");
}
