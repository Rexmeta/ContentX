import type { Dimension } from "./dimensionModel";
import {
  InvalidPopulationError,
  DEPENDENCY_RULE_TYPES,
  type Distribution,
  type CategoricalDistribution,
  type NumericDistribution,
  type PopulationConstraint,
  type RuleCondition,
  type RuleEffect,
  type DependencyRuleType,
} from "./model";

const PROBABILITY_TOLERANCE = 1e-6;

export function isCategorical(
  d: Distribution,
): d is CategoricalDistribution {
  return d.type === "categorical";
}

export function isNumeric(d: Distribution): d is NumericDistribution {
  return d.type === "uniform" || d.type === "normal";
}

function validateCategoricalWeights(
  weights: Record<string, number> | undefined,
  dim: Dimension,
  context: string,
): void {
  if (!weights) {
    throw new InvalidPopulationError(
      `${context}: categorical distribution requires weights.`,
    );
  }
  const entries = Object.entries(weights);
  if (entries.length === 0) {
    throw new InvalidPopulationError(`${context}: weights must not be empty.`);
  }
  let sum = 0;
  for (const [value, p] of entries) {
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0) {
      throw new InvalidPopulationError(
        `${context}: weight for "${value}" must be a non-negative number.`,
      );
    }
    if (dim.dataType === "enum" && !dim.allowedValues?.includes(value)) {
      throw new InvalidPopulationError(
        `${context}: "${value}" is not an allowed value of enum dimension "${dim.name}".`,
      );
    }
    if (
      dim.dataType === "boolean" &&
      value !== "true" &&
      value !== "false"
    ) {
      throw new InvalidPopulationError(
        `${context}: boolean dimension "${dim.name}" only allows "true"/"false" weights.`,
      );
    }
    sum += p;
  }
  if (Math.abs(sum - 1) > PROBABILITY_TOLERANCE) {
    throw new InvalidPopulationError(
      `${context}: weights must sum to 1 (got ${sum}).`,
    );
  }
}

export function validateDistribution(
  distribution: Distribution,
  dim: Dimension,
  context: string,
): void {
  if (isCategorical(distribution)) {
    if (dim.dataType === "number") {
      throw new InvalidPopulationError(
        `${context}: numeric dimension "${dim.name}" needs a uniform/normal distribution.`,
      );
    }
    if (dim.dataType === "array") {
      throw new InvalidPopulationError(
        `${context}: array dimension "${dim.name}" is not samplable in v1 — omit it from distributions.`,
      );
    }
    validateCategoricalWeights(distribution.weights, dim, context);
    return;
  }
  if (isNumeric(distribution)) {
    if (dim.dataType !== "number") {
      throw new InvalidPopulationError(
        `${context}: ${distribution.type} distribution requires a number dimension ("${dim.name}" is ${dim.dataType}).`,
      );
    }
    if (
      !Number.isFinite(distribution.min) ||
      !Number.isFinite(distribution.max) ||
      distribution.min >= distribution.max
    ) {
      throw new InvalidPopulationError(
        `${context}: numeric distribution requires finite min < max.`,
      );
    }
    if (distribution.type === "normal") {
      if (
        distribution.mean === undefined ||
        distribution.stddev === undefined ||
        distribution.stddev <= 0
      ) {
        throw new InvalidPopulationError(
          `${context}: normal distribution requires mean and stddev > 0.`,
        );
      }
    }
    return;
  }
  throw new InvalidPopulationError(
    `${context}: unknown distribution type "${(distribution as { type: string }).type}".`,
  );
}

/** Validate a hard constraint against its dimension's type. */
export function validateConstraint(
  c: PopulationConstraint,
  registry: Map<string, Dimension>,
  context: string,
): void {
  const dim = registry.get(c.dimension);
  if (!dim) {
    throw new InvalidPopulationError(
      `${context}: dimension "${c.dimension}" is not registered.`,
    );
  }
  if (
    c.allowedValues === undefined &&
    c.min === undefined &&
    c.max === undefined
  ) {
    throw new InvalidPopulationError(
      `${context}: constraint on "${c.dimension}" must set allowedValues or min/max.`,
    );
  }
  if (c.allowedValues !== undefined) {
    if (dim.dataType === "number") {
      throw new InvalidPopulationError(
        `${context}: allowedValues is not applicable to number dimension "${c.dimension}" — use min/max.`,
      );
    }
    if (c.allowedValues.length === 0) {
      throw new InvalidPopulationError(
        `${context}: allowedValues for "${c.dimension}" must not be empty.`,
      );
    }
    if (dim.dataType === "enum") {
      for (const v of c.allowedValues) {
        if (!dim.allowedValues?.includes(v)) {
          throw new InvalidPopulationError(
            `${context}: "${v}" is not an allowed value of enum dimension "${c.dimension}".`,
          );
        }
      }
    }
    if (dim.dataType === "boolean") {
      for (const v of c.allowedValues) {
        if (v !== "true" && v !== "false") {
          throw new InvalidPopulationError(
            `${context}: boolean dimension "${c.dimension}" only allows "true"/"false".`,
          );
        }
      }
    }
  }
  if (c.min !== undefined || c.max !== undefined) {
    if (dim.dataType !== "number") {
      throw new InvalidPopulationError(
        `${context}: min/max are only applicable to number dimension constraints ("${c.dimension}" is ${dim.dataType}).`,
      );
    }
    if (
      (c.min !== undefined && !Number.isFinite(c.min)) ||
      (c.max !== undefined && !Number.isFinite(c.max)) ||
      (c.min !== undefined && c.max !== undefined && c.min >= c.max)
    ) {
      throw new InvalidPopulationError(
        `${context}: constraint on "${c.dimension}" requires finite min < max.`,
      );
    }
  }
}

export function validatePopulationDefinition(
  input: {
    name: string;
    domain: string;
    dimensions: string[];
    distributions: Record<string, Distribution>;
    constraints?: PopulationConstraint[];
  },
  registry: Map<string, Dimension>,
): void {
  if (!input.name.trim()) {
    throw new InvalidPopulationError("Population name must not be empty.");
  }
  if (!input.domain.trim()) {
    throw new InvalidPopulationError("Population domain must not be empty.");
  }
  if (input.dimensions.length === 0) {
    throw new InvalidPopulationError(
      "Population must reference at least one dimension.",
    );
  }
  if (new Set(input.dimensions).size !== input.dimensions.length) {
    throw new InvalidPopulationError("Duplicate dimension references.");
  }
  for (const name of input.dimensions) {
    if (!registry.has(name)) {
      throw new InvalidPopulationError(
        `Dimension "${name}" is not registered. Register it via /v1/dimensions first.`,
      );
    }
  }
  for (const [name, distribution] of Object.entries(input.distributions)) {
    if (!input.dimensions.includes(name)) {
      throw new InvalidPopulationError(
        `Distribution for "${name}" references a dimension not in this population.`,
      );
    }
    const dim = registry.get(name);
    if (!dim) continue;
    validateDistribution(distribution, dim, `distributions.${name}`);
  }
  for (const name of input.dimensions) {
    const dim = registry.get(name);
    if (dim && dim.dataType !== "array" && !input.distributions[name]) {
      throw new InvalidPopulationError(
        `Dimension "${name}" has no distribution. Every non-array dimension needs one (no silent defaults).`,
      );
    }
  }
  for (const c of input.constraints ?? []) {
    if (!input.dimensions.includes(c.dimension)) {
      throw new InvalidPopulationError(
        `Constraint references dimension "${c.dimension}" not in this population.`,
      );
    }
    validateConstraint(c, registry, "constraints");
  }
}

export function validateDependencyRuleDefinition(
  input: {
    sourceDimension: string;
    targetDimension: string;
    type: string;
    conditions: RuleCondition[];
    effect: RuleEffect;
    strength?: number | null;
  },
  populationDimensions: string[],
  registry: Map<string, Dimension>,
): void {
  const { sourceDimension: src, targetDimension: tgt } = input;
  if (!DEPENDENCY_RULE_TYPES.includes(input.type as DependencyRuleType)) {
    throw new InvalidPopulationError(
      `Unknown rule type "${input.type}". Allowed: ${DEPENDENCY_RULE_TYPES.join(", ")}`,
    );
  }
  if (src === tgt) {
    throw new InvalidPopulationError(
      "sourceDimension and targetDimension must differ.",
    );
  }
  for (const name of [src, tgt]) {
    if (!populationDimensions.includes(name)) {
      throw new InvalidPopulationError(
        `Rule references dimension "${name}" not in the population.`,
      );
    }
  }
  if (input.conditions.length === 0) {
    throw new InvalidPopulationError("Rule requires at least one condition.");
  }
  const targetDim = registry.get(tgt);
  if (!targetDim) {
    throw new InvalidPopulationError(`Dimension "${tgt}" is not registered.`);
  }
  const sourceDim = registry.get(src);
  if (!sourceDim) {
    throw new InvalidPopulationError(`Dimension "${src}" is not registered.`);
  }
  for (const [i, cond] of input.conditions.entries()) {
    const ctx = `conditions[${i}]`;
    const clauses = [
      cond.equals !== undefined,
      cond.in !== undefined,
      cond.min !== undefined || cond.max !== undefined,
    ].filter(Boolean).length;
    if (clauses === 0) {
      throw new InvalidPopulationError(
        `${ctx}: condition must set equals, in, or min/max.`,
      );
    }
    if (cond.min !== undefined || cond.max !== undefined) {
      if (sourceDim.dataType !== "number") {
        throw new InvalidPopulationError(
          `${ctx}: min/max conditions require a number source dimension ("${src}" is ${sourceDim.dataType}).`,
        );
      }
      if (
        (cond.min !== undefined && !Number.isFinite(cond.min)) ||
        (cond.max !== undefined && !Number.isFinite(cond.max)) ||
        (cond.min !== undefined &&
          cond.max !== undefined &&
          cond.min > cond.max)
      ) {
        throw new InvalidPopulationError(
          `${ctx}: min/max must be finite with min <= max.`,
        );
      }
    }
    if (cond.equals !== undefined) {
      switch (sourceDim.dataType) {
        case "boolean":
          if (typeof cond.equals !== "boolean") {
            throw new InvalidPopulationError(
              `${ctx}: equals on boolean dimension "${src}" must be a boolean literal (true/false), not ${JSON.stringify(cond.equals)}.`,
            );
          }
          break;
        case "number":
          if (typeof cond.equals !== "number") {
            throw new InvalidPopulationError(
              `${ctx}: equals on number dimension "${src}" must be a number.`,
            );
          }
          break;
        case "enum":
          if (
            typeof cond.equals !== "string" ||
            !sourceDim.allowedValues?.includes(cond.equals)
          ) {
            throw new InvalidPopulationError(
              `${ctx}: "${String(cond.equals)}" is not an allowed value of enum dimension "${src}".`,
            );
          }
          break;
        default:
          if (typeof cond.equals !== "string") {
            throw new InvalidPopulationError(
              `${ctx}: equals on ${sourceDim.dataType} dimension "${src}" must be a string.`,
            );
          }
      }
    }
    if (cond.in !== undefined) {
      if (cond.in.length === 0) {
        throw new InvalidPopulationError(`${ctx}: "in" must not be empty.`);
      }
      if (sourceDim.dataType === "number" || sourceDim.dataType === "boolean") {
        throw new InvalidPopulationError(
          `${ctx}: "in" is not supported on ${sourceDim.dataType} dimension "${src}" — use equals or min/max.`,
        );
      }
      if (sourceDim.dataType === "enum") {
        for (const v of cond.in) {
          if (!sourceDim.allowedValues?.includes(v)) {
            throw new InvalidPopulationError(
              `${ctx}: "${v}" is not an allowed value of enum dimension "${src}".`,
            );
          }
        }
      }
    }
  }
  const effect = input.effect;
  switch (input.type as DependencyRuleType) {
    case "conditional":
      if (!effect.distribution) {
        throw new InvalidPopulationError(
          "conditional rule requires effect.distribution.",
        );
      }
      validateDistribution(effect.distribution, targetDim, "effect.distribution");
      break;
    case "implication":
      if (effect.value === undefined) {
        throw new InvalidPopulationError(
          "implication rule requires effect.value.",
        );
      }
      switch (targetDim.dataType) {
        case "enum":
          if (
            typeof effect.value !== "string" ||
            !targetDim.allowedValues?.includes(effect.value)
          ) {
            throw new InvalidPopulationError(
              `effect.value "${String(effect.value)}" is not allowed for enum dimension "${tgt}".`,
            );
          }
          break;
        case "boolean":
          if (typeof effect.value !== "boolean") {
            throw new InvalidPopulationError(
              `effect.value for boolean dimension "${tgt}" must be a boolean literal (true/false).`,
            );
          }
          break;
        case "number":
          if (
            typeof effect.value !== "number" ||
            !Number.isFinite(effect.value)
          ) {
            throw new InvalidPopulationError(
              `effect.value for number dimension "${tgt}" must be a finite number.`,
            );
          }
          break;
        case "string":
          if (typeof effect.value !== "string") {
            throw new InvalidPopulationError(
              `effect.value for string dimension "${tgt}" must be a string.`,
            );
          }
          break;
        default:
          throw new InvalidPopulationError(
            `implication rules are not supported on ${targetDim.dataType} dimension "${tgt}".`,
          );
      }
      break;
    case "exclusion":
      if (!effect.excludedValues || effect.excludedValues.length === 0) {
        throw new InvalidPopulationError(
          "exclusion rule requires non-empty effect.excludedValues.",
        );
      }
      if (targetDim.dataType === "number") {
        throw new InvalidPopulationError(
          `exclusion rules are not supported on number dimension "${tgt}".`,
        );
      }
      if (targetDim.dataType === "enum") {
        for (const v of effect.excludedValues) {
          if (!targetDim.allowedValues?.includes(v)) {
            throw new InvalidPopulationError(
              `effect.excludedValues: "${v}" is not an allowed value of enum dimension "${tgt}".`,
            );
          }
        }
      }
      break;
    case "constraint":
      if (
        !effect.allowedValues &&
        effect.min === undefined &&
        effect.max === undefined
      ) {
        throw new InvalidPopulationError(
          "constraint rule requires effect.allowedValues or effect.min/max.",
        );
      }
      validateConstraint(
        {
          dimension: tgt,
          ...(effect.allowedValues !== undefined
            ? { allowedValues: effect.allowedValues }
            : {}),
          ...(effect.min !== undefined ? { min: effect.min } : {}),
          ...(effect.max !== undefined ? { max: effect.max } : {}),
        },
        registry,
        "effect",
      );
      break;
    case "correlation": {
      const sourceDim = registry.get(src);
      if (sourceDim?.dataType !== "number" || targetDim.dataType !== "number") {
        throw new InvalidPopulationError(
          "correlation rules are only supported between number dimensions in v1.",
        );
      }
      if (
        input.strength === undefined ||
        input.strength === null ||
        input.strength < -1 ||
        input.strength > 1
      ) {
        throw new InvalidPopulationError(
          "correlation rule requires strength in [-1, 1].",
        );
      }
      break;
    }
  }
}
