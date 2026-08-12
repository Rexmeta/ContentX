import type { DramaticScenario } from "../ai/scenarioAmplifier";
import { classifyWithLLM, type Classifier } from "./classifier";
import {
  getCategoryNamesByAxis,
  registerAutoCategories,
} from "./categoryService";
import { CATEGORY_AXES, type Classification } from "./taxonomy";

/** Thrown when a classification fails normalization (→ 400 for manual input). */
export class InvalidClassificationError extends Error {}

/**
 * Normalize a classification before persistence: trim all values, drop empty
 * tags, and reject blank axes. The normalized values are what get stored and
 * registered in the catalog, keeping filters/similarity comparisons exact.
 */
export function normalizeClassification(
  input: Classification,
): Classification {
  const normalized: Classification = {
    domain: input.domain.trim(),
    conflictType: input.conflictType.trim(),
    tone: input.tone.trim(),
    tags: input.tags.map((t) => t.trim()).filter((t) => t.length > 0),
    classifiedBy: input.classifiedBy ?? null,
  };
  for (const axis of CATEGORY_AXES) {
    if (!normalized[axis]) {
      throw new InvalidClassificationError(`${axis} must not be empty.`);
    }
    if (normalized[axis].length > 30) {
      throw new InvalidClassificationError(
        `${axis} name is too long (max 30 characters).`,
      );
    }
  }
  if (normalized.tags.length === 0) {
    throw new InvalidClassificationError("At least one tag is required.");
  }
  if (normalized.tags.length > 8) {
    normalized.tags = normalized.tags.slice(0, 8);
  }
  return normalized;
}

/**
 * Accept a manual classification override: normalize it and register any
 * new category names in the catalog so filters stay catalog-consistent.
 */
export async function acceptManualClassification(
  input: Classification,
): Promise<Classification> {
  const normalized = normalizeClassification({
    ...input,
    classifiedBy: "manual",
  });
  const existing = await getCategoryNamesByAxis();
  await registerAutoCategories(normalized, existing);
  return normalized;
}

/**
 * Classify a scenario against the current category catalog, persisting any
 * auto-discovered categories. Throws ClassificationError on failure — callers
 * decide whether that fails the request (explicit classify) or results in an
 * explicit "unclassified" state (save pipeline).
 */
export async function classifyScenario(
  scenario: DramaticScenario,
  classifier: Classifier = classifyWithLLM,
): Promise<Classification> {
  const existing = await getCategoryNamesByAxis();
  const classification = normalizeClassification(
    await classifier(scenario, existing),
  );
  await registerAutoCategories(classification, existing);
  return classification;
}
