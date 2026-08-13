/**
 * Dimension registry model — reusable, versioned attribute dimensions.
 * Dimensions describe WHAT can vary about characters/populations;
 * distributions and dependency rules (later phases) describe HOW.
 */

export const DIMENSION_CATEGORIES = [
  "demographic",
  "professional",
  "psychological",
  "behavioral",
  "social",
  "preference",
  "capability",
  "technology",
  "domain",
] as const;

export type DimensionCategory = (typeof DIMENSION_CATEGORIES)[number];

export const DIMENSION_DATA_TYPES = [
  "string",
  "number",
  "boolean",
  "enum",
  "array",
] as const;

export type DimensionDataType = (typeof DIMENSION_DATA_TYPES)[number];

export interface Dimension {
  id: string;
  name: string;
  category: DimensionCategory;
  dataType: DimensionDataType;
  allowedValues?: string[] | null;
  source: string;
  version: number;
  description?: string | null;
}

/** Thrown when a dimension definition violates registry invariants (→ 400). */
export class InvalidDimensionError extends Error {}

const NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

/** Validate a dimension definition; throws InvalidDimensionError. */
export function validateDimensionDefinition(input: {
  name: string;
  category: string;
  dataType: string;
  allowedValues?: string[] | null;
}): void {
  if (!NAME_PATTERN.test(input.name)) {
    throw new InvalidDimensionError(
      `Dimension name "${input.name}" must be snake_case (a-z, 0-9, _), 2-64 chars.`,
    );
  }
  if (!DIMENSION_CATEGORIES.includes(input.category as DimensionCategory)) {
    throw new InvalidDimensionError(
      `Unknown dimension category "${input.category}". Allowed: ${DIMENSION_CATEGORIES.join(", ")}`,
    );
  }
  if (!DIMENSION_DATA_TYPES.includes(input.dataType as DimensionDataType)) {
    throw new InvalidDimensionError(
      `Unknown dimension dataType "${input.dataType}". Allowed: ${DIMENSION_DATA_TYPES.join(", ")}`,
    );
  }
  if (input.dataType === "enum") {
    if (!input.allowedValues || input.allowedValues.length < 2) {
      throw new InvalidDimensionError(
        `Enum dimension "${input.name}" requires at least 2 allowedValues.`,
      );
    }
    if (input.allowedValues.some((v) => !v || v.trim() === "")) {
      throw new InvalidDimensionError(
        `Enum dimension "${input.name}" has an empty allowed value.`,
      );
    }
    if (new Set(input.allowedValues).size !== input.allowedValues.length) {
      throw new InvalidDimensionError(
        `Enum dimension "${input.name}" has duplicate allowed values.`,
      );
    }
  } else if (input.allowedValues && input.allowedValues.length > 0) {
    throw new InvalidDimensionError(
      `allowedValues is only valid for enum dimensions ("${input.name}" is ${input.dataType}).`,
    );
  }
}
