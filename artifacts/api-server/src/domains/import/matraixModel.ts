import { z } from "zod";

/**
 * MatrAIx source format (import boundary).
 *
 * This module owns the *external* MatrAIx export shape ONLY. Nothing here
 * may leak into the canonical content model — the importer maps this format
 * into canonical Entity/Relationship and records provenance
 * (sourceType: "matraix") so the origin is always auditable.
 *
 * Raw input is validated with a strict zod schema in the domain layer
 * (unknown top-level keys are a 400, per the platform rule that external
 * data never bypasses schema validation).
 */

export const MATRAIX_SCHEMA_VERSION_PREFIX = "matraix/";

const matraixId = z.string().min(1).max(200);

const matraixSource = z
  .strictObject({
    uri: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
  })
  .optional();

const matraixWorld = z.strictObject({
  id: matraixId,
  name: z.string().min(1),
  description: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

const matraixDimension = z.strictObject({
  id: matraixId,
  name: z.string().min(1),
  category: z.string().optional(),
  dataType: z.string().optional(),
  allowedValues: z.array(z.union([z.string(), z.number()])).optional(),
});

const matraixPopulation = z.strictObject({
  id: matraixId,
  name: z.string().min(1),
  description: z.string().optional(),
  dimensions: z.array(matraixDimension).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

const matraixPersona = z.strictObject({
  id: matraixId,
  name: z.string().min(1),
  populationId: matraixId.optional(),
  aliases: z.array(z.string().min(1)).optional(),
  description: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  traits: z.array(z.string().min(1)).optional(),
  goals: z.array(z.string().min(1)).optional(),
});

const matraixRelation = z.strictObject({
  id: matraixId.optional(),
  from: matraixId,
  type: z.string().min(1),
  to: matraixId,
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export const matraixDatasetSchema = z.strictObject({
  schemaVersion: z
    .string()
    .startsWith(
      MATRAIX_SCHEMA_VERSION_PREFIX,
      `schemaVersion must start with "${MATRAIX_SCHEMA_VERSION_PREFIX}"`,
    ),
  source: matraixSource,
  world: matraixWorld.optional(),
  populations: z.array(matraixPopulation).optional(),
  personas: z.array(matraixPersona).min(1, "At least one persona is required"),
  relations: z.array(matraixRelation).optional(),
});

export type MatraixDataset = z.infer<typeof matraixDatasetSchema>;
export type MatraixPersona = z.infer<typeof matraixPersona>;
export type MatraixPopulation = z.infer<typeof matraixPopulation>;
export type MatraixRelation = z.infer<typeof matraixRelation>;
