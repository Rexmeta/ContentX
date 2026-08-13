import { newId } from "../../shared/id";
import type { DimensionRow } from "@workspace/db";
import {
  validateDimensionDefinition,
  InvalidDimensionError,
  type Dimension,
  type DimensionCategory,
  type DimensionDataType,
} from "./dimensionModel";
import { SEED_DIMENSIONS } from "./seedDimensions";
import * as repo from "./dimensionRepository";

/** Thrown when a dimension name is already registered (→ 409). */
export class DuplicateDimensionError extends Error {}

export function toDimension(row: DimensionRow): Dimension {
  return {
    id: row.id,
    name: row.name,
    category: row.category as DimensionCategory,
    dataType: row.dataType as DimensionDataType,
    allowedValues: (row.allowedValues as string[] | null) ?? null,
    source: row.source,
    version: row.version,
    description: row.description ?? null,
  };
}

/** Idempotently register the seed dimension set (unique on name). */
export async function ensureSeedDimensions(): Promise<void> {
  for (const seed of SEED_DIMENSIONS) {
    validateDimensionDefinition(seed);
    await repo.insertDimensionIfAbsent({
      id: newId("dimension"),
      name: seed.name,
      category: seed.category,
      dataType: seed.dataType,
      allowedValues: seed.allowedValues ?? null,
      source: "seed",
      version: 1,
      description: seed.description,
    });
  }
}

export async function listDimensions(): Promise<Dimension[]> {
  return (await repo.listDimensions()).map(toDimension);
}

export async function createDimension(input: {
  name: string;
  category: string;
  dataType: string;
  allowedValues?: string[] | null;
  description?: string | null;
}): Promise<Dimension> {
  validateDimensionDefinition(input);
  // Atomic: insert with ON CONFLICT DO NOTHING; no row back means duplicate.
  const row = await repo.insertDimensionReturningIfAbsent({
    id: newId("dimension"),
    name: input.name,
    category: input.category,
    dataType: input.dataType,
    allowedValues: input.allowedValues ?? null,
    source: "user",
    version: 1,
    description: input.description ?? null,
  });
  if (!row) {
    throw new DuplicateDimensionError(
      `Dimension "${input.name}" is already registered.`,
    );
  }
  return toDimension(row);
}

export { InvalidDimensionError };
