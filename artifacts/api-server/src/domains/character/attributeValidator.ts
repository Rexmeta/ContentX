import type { Dimension } from "../population/dimensionModel";
import {
  ATTRIBUTE_GROUPS,
  type CharacterAttributes,
  type AttributeGroup,
} from "./model";

/**
 * Dimension-based semantic validation of character attributes.
 *
 * Rules:
 * - Attribute keys inside dimension-keyed groups must be registered
 *   dimensions (the registry is the vocabulary — no ad-hoc keys).
 * - Values must match the dimension's dataType; enum values must be in
 *   allowedValues.
 * - MBTI (and similar typology keys) are rejected in core groups — they are
 *   only allowed as derived classifications.
 * - goals/constraints are free-form string lists (no dimension keys).
 */

export class InvalidCharacterError extends Error {}

/**
 * Which dimension categories may appear in each dimension-keyed group.
 * This keeps the eight-group structure semantically meaningful (a
 * behavioral dimension cannot be stored under identity).
 */
export const GROUP_CATEGORY_MAP: Record<string, readonly string[]> = {
  identity: ["demographic", "social"],
  professional: ["professional", "domain"],
  psychological: ["psychological"],
  behavioral: ["behavioral", "social"],
  capabilities: ["capability", "technology"],
  preferences: ["preference", "technology"],
};

const DIMENSION_KEYED_GROUPS = Object.keys(
  GROUP_CATEGORY_MAP,
) as AttributeGroup[];

const FORBIDDEN_CORE_KEYS = new Set(["mbti", "enneagram", "disc"]);

function checkValue(dim: Dimension, value: unknown, path: string): void {
  switch (dim.dataType) {
    case "string":
      if (typeof value !== "string" || value.trim() === "") {
        throw new InvalidCharacterError(`${path}: expected a non-empty string.`);
      }
      break;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new InvalidCharacterError(`${path}: expected a finite number.`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        throw new InvalidCharacterError(`${path}: expected a boolean.`);
      }
      break;
    case "enum":
      if (typeof value !== "string" || !dim.allowedValues?.includes(value)) {
        throw new InvalidCharacterError(
          `${path}: "${String(value)}" is not one of [${(dim.allowedValues ?? []).join(", ")}].`,
        );
      }
      break;
    case "array":
      if (
        !Array.isArray(value) ||
        value.some((v) => typeof v !== "string" || v.trim() === "")
      ) {
        throw new InvalidCharacterError(
          `${path}: expected an array of non-empty strings.`,
        );
      }
      break;
  }
}

export function validateCharacterAttributes(
  attributes: CharacterAttributes,
  dimensionsByName: Map<string, Dimension>,
): void {
  for (const group of Object.keys(attributes)) {
    if (!ATTRIBUTE_GROUPS.includes(group as AttributeGroup)) {
      throw new InvalidCharacterError(
        `Unknown attribute group "${group}". Allowed: ${ATTRIBUTE_GROUPS.join(", ")}`,
      );
    }
  }

  for (const group of DIMENSION_KEYED_GROUPS) {
    const map = attributes[group];
    if (!map) continue;
    for (const [key, value] of Object.entries(map)) {
      const path = `${group}.${key}`;
      if (FORBIDDEN_CORE_KEYS.has(key.toLowerCase())) {
        throw new InvalidCharacterError(
          `${path}: typology classifications (e.g. MBTI) are only allowed as derivedClassifications, never core attributes.`,
        );
      }
      const dim = dimensionsByName.get(key);
      if (!dim) {
        throw new InvalidCharacterError(
          `${path}: "${key}" is not a registered dimension. Register it via /v1/dimensions first.`,
        );
      }
      const allowedCategories = GROUP_CATEGORY_MAP[group] ?? [];
      if (!allowedCategories.includes(dim.category)) {
        throw new InvalidCharacterError(
          `${path}: dimension "${key}" has category "${dim.category}", which does not belong in group "${group}" (allowed: ${allowedCategories.join(", ")}).`,
        );
      }
      checkValue(dim, value, path);
    }
  }

  for (const listGroup of ["goals", "constraints"] as const) {
    const list = attributes[listGroup];
    if (list === undefined) continue;
    if (
      !Array.isArray(list) ||
      list.some((v) => typeof v !== "string" || v.trim() === "")
    ) {
      throw new InvalidCharacterError(
        `${listGroup}: expected an array of non-empty strings.`,
      );
    }
  }
}

export function validateDerivedClassifications(
  derived: Record<string, string> | null | undefined,
): void {
  if (!derived) return;
  for (const [key, value] of Object.entries(derived)) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new InvalidCharacterError(
        `derivedClassifications.${key}: expected a non-empty string.`,
      );
    }
  }
}
