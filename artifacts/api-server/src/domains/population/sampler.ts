import { mulberry32, deriveSeed, shuffle, type Rng } from "./prng";
import type { Dimension } from "./dimensionModel";
import {
  InvalidPopulationError,
  type Distribution,
  type CategoricalDistribution,
  type NumericDistribution,
  type DependencyRule,
  type Population,
  type PopulationConstraint,
  type RuleCondition,
  type SamplingStrategy,
  type TargetDistribution,
} from "./model";
import { isCategorical, isNumeric } from "./populationValidator";

/**
 * Deterministic sampler engine (pure — no I/O).
 * Same population definition + rules + seed + strategy → identical samples.
 *
 * Strategies:
 * - random:      uniform over allowed values/range; ignores weights & rules
 * - weighted:    base distributions; ignores dependency rules
 * - conditional: weighted + dependency rules applied in topological order
 * - stratified:  conditional + targetDistribution marginals enforced by
 *                largest-remainder allocation per dimension
 */

export type SampleValue = string | number | boolean;
export type Sample = Record<string, SampleValue>;

const MAX_REJECTION_TRIES = 100;

// ---------- primitive draws ----------

function drawCategorical(dist: CategoricalDistribution, rng: Rng): string {
  const entries = Object.entries(dist.weights).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const total = entries.reduce((s, [, p]) => s + p, 0);
  let r = rng() * total;
  for (const [value, p] of entries) {
    r -= p;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

function drawNumeric(dist: NumericDistribution, rng: Rng): number {
  let v: number;
  if (dist.type === "uniform") {
    v = dist.min + rng() * (dist.max - dist.min);
  } else {
    // Box–Muller, clamped to [min, max].
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    v = (dist.mean ?? (dist.min + dist.max) / 2) + z * (dist.stddev ?? 1);
    v = Math.min(Math.max(v, dist.min), dist.max);
  }
  return dist.integer ? Math.round(v) : v;
}

function uniformOver(dist: Distribution, dim: Dimension): Distribution {
  if (isCategorical(dist)) {
    const values = Object.keys(dist.weights);
    const weights: Record<string, number> = {};
    for (const v of values) weights[v] = 1 / values.length;
    return { type: "categorical", weights };
  }
  void dim;
  return { ...dist, type: "uniform" };
}

// ---------- constraints ----------

function applyConstraintToDistribution(
  dist: Distribution,
  constraint: { allowedValues?: string[]; min?: number; max?: number },
  dimName: string,
): Distribution {
  if (isCategorical(dist)) {
    if (!constraint.allowedValues) return dist;
    const weights: Record<string, number> = {};
    for (const [v, p] of Object.entries(dist.weights)) {
      if (constraint.allowedValues.includes(v)) weights[v] = p;
    }
    if (Object.keys(weights).length === 0) {
      throw new InvalidPopulationError(
        `Constraint on "${dimName}" excludes every value — nothing to sample.`,
      );
    }
    return { type: "categorical", weights };
  }
  const min = Math.max(dist.min, constraint.min ?? dist.min);
  const max = Math.min(dist.max, constraint.max ?? dist.max);
  if (min >= max) {
    throw new InvalidPopulationError(
      `Constraint on "${dimName}" empties the numeric range [${min}, ${max}].`,
    );
  }
  return { ...dist, min, max };
}

function excludeValues(
  dist: Distribution,
  excluded: string[],
  dimName: string,
): Distribution {
  if (!isCategorical(dist)) {
    throw new InvalidPopulationError(
      `exclusion rule on numeric dimension "${dimName}" is not supported.`,
    );
  }
  const weights: Record<string, number> = {};
  for (const [v, p] of Object.entries(dist.weights)) {
    if (!excluded.includes(v)) weights[v] = p;
  }
  if (Object.keys(weights).length === 0) {
    throw new InvalidPopulationError(
      `Exclusion on "${dimName}" removes every value — nothing to sample.`,
    );
  }
  return { type: "categorical", weights };
}

// ---------- dependency graph ----------

function conditionMatches(value: SampleValue, cond: RuleCondition): boolean {
  if (cond.equals !== undefined) return value === cond.equals;
  if (cond.in !== undefined) return cond.in.includes(String(value));
  if (cond.min !== undefined || cond.max !== undefined) {
    if (typeof value !== "number") return false;
    if (cond.min !== undefined && value < cond.min) return false;
    if (cond.max !== undefined && value > cond.max) return false;
    return true;
  }
  return false;
}

export function ruleFires(rule: DependencyRule, sample: Sample): boolean {
  const source = sample[rule.sourceDimension];
  if (source === undefined) return false;
  return rule.conditions.some((c) => conditionMatches(source, c));
}

/**
 * Topological order of dimensions given rule edges source→target.
 * Throws on cycles — dependency graphs must be acyclic.
 */
export function topologicalDimensionOrder(
  dimensions: string[],
  rules: DependencyRule[],
): string[] {
  const inDegree = new Map<string, number>(dimensions.map((d) => [d, 0]));
  const outEdges = new Map<string, Set<string>>();
  for (const r of rules) {
    const targets = outEdges.get(r.sourceDimension) ?? new Set<string>();
    if (!targets.has(r.targetDimension)) {
      targets.add(r.targetDimension);
      outEdges.set(r.sourceDimension, targets);
      inDegree.set(
        r.targetDimension,
        (inDegree.get(r.targetDimension) ?? 0) + 1,
      );
    }
  }
  // Stable order: process zero-in-degree dimensions in declaration order.
  const queue = dimensions.filter((d) => (inDegree.get(d) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const d = queue.shift() as string;
    order.push(d);
    for (const t of outEdges.get(d) ?? []) {
      const deg = (inDegree.get(t) ?? 0) - 1;
      inDegree.set(t, deg);
      if (deg === 0) {
        queue.push(t);
        queue.sort(
          (a, b) => dimensions.indexOf(a) - dimensions.indexOf(b),
        );
      }
    }
  }
  if (order.length !== dimensions.length) {
    const cyclic = dimensions.filter((d) => !order.includes(d));
    throw new InvalidPopulationError(
      `Dependency rules form a cycle involving: ${cyclic.join(", ")}.`,
    );
  }
  return order;
}

// ---------- core sampling ----------

interface SamplerInput {
  population: Population;
  rules: DependencyRule[];
  registry: Map<string, Dimension>;
  sampleSize: number;
  strategy: SamplingStrategy;
  seed: number;
  constraints?: PopulationConstraint[] | null;
  targetDistribution?: TargetDistribution | null;
}

export interface SamplerOutput {
  samples: Sample[];
  dimensionOrder: string[];
  achievedDistribution: Record<string, Record<string, number>>;
}

function baseDistributionFor(
  dimName: string,
  input: SamplerInput,
): Distribution {
  const dist = input.population.distributions[dimName];
  if (!dist) {
    throw new InvalidPopulationError(
      `No distribution defined for dimension "${dimName}".`,
    );
  }
  let effective = dist;
  const dim = input.registry.get(dimName);
  if (!dim) {
    throw new InvalidPopulationError(`Dimension "${dimName}" not registered.`);
  }
  if (input.strategy === "random") effective = uniformOver(effective, dim);
  for (const c of [
    ...(input.population.constraints ?? []),
    ...(input.constraints ?? []),
  ]) {
    if (c.dimension === dimName) {
      effective = applyConstraintToDistribution(effective, c, dimName);
    }
  }
  return effective;
}

/** All hard constraints (population-level + request-level) for a dimension. */
function hardConstraintsFor(
  dimName: string,
  input: SamplerInput,
): PopulationConstraint[] {
  return [
    ...(input.population.constraints ?? []),
    ...(input.constraints ?? []),
  ].filter((c) => c.dimension === dimName);
}

/** True when a resolved value satisfies a hard constraint. */
function satisfiesHardConstraint(
  value: SampleValue,
  c: PopulationConstraint,
): boolean {
  if (c.allowedValues && !c.allowedValues.includes(String(value))) {
    return false;
  }
  if (typeof value === "number") {
    if (c.min !== undefined && value < c.min) return false;
    if (c.max !== undefined && value > c.max) return false;
  }
  return true;
}

/**
 * Enforce hard constraints on a fully resolved value (covers implication
 * results, stratified forced values, and rule-replaced distributions).
 * A violation is a definition conflict — fail loudly, never emit the sample.
 */
function assertHardConstraints(
  value: SampleValue,
  dimName: string,
  input: SamplerInput,
  origin: string,
): SampleValue {
  for (const c of hardConstraintsFor(dimName, input)) {
    if (!satisfiesHardConstraint(value, c)) {
      throw new InvalidPopulationError(
        `${origin} produced "${String(value)}" for "${dimName}", which violates a hard constraint — the population/rule/stratification definitions conflict.`,
      );
    }
  }
  return value;
}

function checkConstraintEffect(
  value: SampleValue,
  effect: { allowedValues?: string[]; min?: number; max?: number },
): boolean {
  if (effect.allowedValues && !effect.allowedValues.includes(String(value))) {
    return false;
  }
  if (typeof value === "number") {
    if (effect.min !== undefined && value < effect.min) return false;
    if (effect.max !== undefined && value > effect.max) return false;
  }
  return true;
}

function sampleDimension(
  dimName: string,
  sample: Sample,
  input: SamplerInput,
  rng: Rng,
  forcedValue: SampleValue | undefined,
): SampleValue {
  if (forcedValue !== undefined) {
    // A stratified marginal may pick which value a sample gets, but it must
    // still satisfy every dependency rule that fires — a conflict is a
    // definition error, never a silently skipped rule.
    for (const rule of input.rules) {
      if (rule.targetDimension !== dimName || !ruleFires(rule, sample)) {
        continue;
      }
      switch (rule.type) {
        case "implication":
          if (forcedValue !== (rule.effect.value as SampleValue)) {
            throw new InvalidPopulationError(
              `stratified targetDistribution forces "${String(forcedValue)}" for "${dimName}", but implication rule ${rule.id} requires "${String(rule.effect.value)}" — the definitions conflict.`,
            );
          }
          break;
        case "exclusion":
          if (
            (rule.effect.excludedValues ?? []).includes(String(forcedValue))
          ) {
            throw new InvalidPopulationError(
              `stratified targetDistribution forces "${String(forcedValue)}" for "${dimName}", but exclusion rule ${rule.id} forbids it — the definitions conflict.`,
            );
          }
          break;
        case "constraint":
          if (!checkConstraintEffect(forcedValue, rule.effect)) {
            throw new InvalidPopulationError(
              `stratified targetDistribution forces "${String(forcedValue)}" for "${dimName}", but constraint rule ${rule.id} rejects it — the definitions conflict.`,
            );
          }
          break;
        case "conditional":
        case "correlation":
          // Distribution-shaping rules are overridden by an explicit
          // stratified marginal for the same dimension by design: the
          // caller requested exact marginals for this dimension.
          break;
      }
    }
    return assertHardConstraints(
      forcedValue,
      dimName,
      input,
      "stratified targetDistribution",
    );
  }
  const useRules =
    input.strategy === "conditional" || input.strategy === "stratified";
  let dist = baseDistributionFor(dimName, input);
  const constraintEffects: {
    allowedValues?: string[];
    min?: number;
    max?: number;
  }[] = [];
  let correlationShift: { source: number; rule: DependencyRule } | null = null;

  if (useRules) {
    for (const rule of input.rules) {
      if (rule.targetDimension !== dimName || !ruleFires(rule, sample)) {
        continue;
      }
      switch (rule.type) {
        case "conditional": {
          // Hard constraints still apply to rule-supplied distributions.
          dist = rule.effect.distribution as Distribution;
          for (const c of hardConstraintsFor(dimName, input)) {
            dist = applyConstraintToDistribution(dist, c, dimName);
          }
          break;
        }
        case "implication":
          return assertHardConstraints(
            rule.effect.value as SampleValue,
            dimName,
            input,
            `implication rule ${rule.id}`,
          );
        case "exclusion":
          dist = excludeValues(
            dist,
            rule.effect.excludedValues ?? [],
            dimName,
          );
          break;
        case "constraint":
          constraintEffects.push(rule.effect);
          break;
        case "correlation": {
          const source = sample[rule.sourceDimension];
          if (typeof source === "number") {
            correlationShift = { source, rule };
          }
          break;
        }
      }
    }
  }

  for (let attempt = 0; attempt < MAX_REJECTION_TRIES; attempt++) {
    let value: SampleValue;
    if (isCategorical(dist)) {
      const drawn = drawCategorical(dist, rng);
      const dim = input.registry.get(dimName);
      value = dim?.dataType === "boolean" ? drawn === "true" : drawn;
    } else {
      value = drawNumeric(dist, rng);
      if (correlationShift) {
        const { source, rule } = correlationShift;
        const srcDist = input.population.distributions[rule.sourceDimension];
        if (srcDist && isNumeric(srcDist) && srcDist.max > srcDist.min) {
          const normalized =
            (source - srcDist.min) / (srcDist.max - srcDist.min);
          const target = dist.min + normalized * (dist.max - dist.min);
          const s = rule.strength ?? 0;
          const blended =
            s >= 0
              ? value + s * (target - value)
              : value + -s * (dist.max + dist.min - target - value);
          value = dist.integer
            ? Math.round(blended)
            : blended;
          value = Math.min(Math.max(value as number, dist.min), dist.max);
        }
      }
    }
    if (constraintEffects.every((e) => checkConstraintEffect(value, e))) {
      return value;
    }
  }
  throw new InvalidPopulationError(
    `Could not satisfy constraint rules for "${dimName}" after ${MAX_REJECTION_TRIES} tries — rules likely contradict the distribution.`,
  );
}

/** Largest-remainder allocation of sampleSize across target proportions. */
export function allocateStrata(
  proportions: Record<string, number>,
  sampleSize: number,
): Record<string, number> {
  const entries = Object.entries(proportions).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  for (const [v, p] of entries) {
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0) {
      throw new InvalidPopulationError(
        `targetDistribution proportion for "${v}" must be a non-negative finite number.`,
      );
    }
  }
  const total = entries.reduce((s, [, p]) => s + p, 0);
  if (total <= 0) {
    throw new InvalidPopulationError(
      "targetDistribution proportions must sum to a positive number.",
    );
  }
  const exact = entries.map(
    ([v, p]) => [v, (p / total) * sampleSize] as const,
  );
  const counts = new Map(exact.map(([v, e]) => [v, Math.floor(e)]));
  let remaining =
    sampleSize - [...counts.values()].reduce((s, c) => s + c, 0);
  const byRemainder = [...exact].sort(
    (a, b) => (b[1] - Math.floor(b[1])) - (a[1] - Math.floor(a[1])),
  );
  for (const [v] of byRemainder) {
    if (remaining <= 0) break;
    counts.set(v, (counts.get(v) ?? 0) + 1);
    remaining--;
  }
  return Object.fromEntries(counts);
}

function buildForcedValues(
  input: SamplerInput,
  rng: Rng,
): Map<string, SampleValue[]> {
  const forced = new Map<string, SampleValue[]>();
  if (input.strategy !== "stratified") return forced;
  const target = input.targetDistribution;
  if (!target || Object.keys(target).length === 0) {
    throw new InvalidPopulationError(
      "stratified strategy requires a targetDistribution.",
    );
  }
  for (const [dimName, proportions] of Object.entries(target)) {
    if (!input.population.dimensions.includes(dimName)) {
      throw new InvalidPopulationError(
        `targetDistribution references dimension "${dimName}" not in the population.`,
      );
    }
    const dim = input.registry.get(dimName);
    if (!dim || dim.dataType === "number" || dim.dataType === "array") {
      throw new InvalidPopulationError(
        `stratified targetDistribution only supports categorical dimensions ("${dimName}").`,
      );
    }
    // Stratum values must be legal for the dimension and the base weights.
    const baseDist = input.population.distributions[dimName];
    for (const value of Object.keys(proportions)) {
      if (
        dim.dataType === "enum" &&
        !dim.allowedValues?.includes(value)
      ) {
        throw new InvalidPopulationError(
          `targetDistribution value "${value}" is not allowed for enum dimension "${dimName}".`,
        );
      }
      if (
        dim.dataType === "boolean" &&
        value !== "true" &&
        value !== "false"
      ) {
        throw new InvalidPopulationError(
          `targetDistribution for boolean dimension "${dimName}" only allows "true"/"false".`,
        );
      }
      if (
        baseDist &&
        isCategorical(baseDist) &&
        !(value in baseDist.weights)
      ) {
        throw new InvalidPopulationError(
          `targetDistribution value "${value}" is not part of the base distribution of "${dimName}".`,
        );
      }
    }
    const counts = allocateStrata(proportions, input.sampleSize);
    const values: SampleValue[] = [];
    for (const [v, count] of Object.entries(counts).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )) {
      for (let i = 0; i < count; i++) {
        values.push(dim.dataType === "boolean" ? v === "true" : v);
      }
    }
    shuffle(values, rng);
    forced.set(dimName, values);
  }
  return forced;
}

export function runSampler(input: SamplerInput): SamplerOutput {
  if (input.sampleSize < 1 || !Number.isInteger(input.sampleSize)) {
    throw new InvalidPopulationError("sampleSize must be a positive integer.");
  }
  const order = topologicalDimensionOrder(
    input.population.dimensions,
    input.rules,
  );
  const strataRng = mulberry32(deriveSeed(input.seed, 0x5747));
  const forcedValues = buildForcedValues(input, strataRng);

  const samples: Sample[] = [];
  for (let i = 0; i < input.sampleSize; i++) {
    const rng = mulberry32(deriveSeed(input.seed, i + 1));
    const sample: Sample = {};
    for (const dimName of order) {
      const dim = input.registry.get(dimName);
      if (dim?.dataType === "array") continue; // not samplable in v1
      const forced = forcedValues.get(dimName)?.[i];
      sample[dimName] = sampleDimension(dimName, sample, input, rng, forced);
    }
    samples.push(sample);
  }

  const achieved: Record<string, Record<string, number>> = {};
  for (const dimName of order) {
    const counts: Record<string, number> = {};
    for (const s of samples) {
      const v = s[dimName];
      if (v === undefined) continue;
      const key =
        typeof v === "number" ? bucketNumeric(v, input, dimName) : String(v);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    if (Object.keys(counts).length > 0) achieved[dimName] = counts;
  }
  return { samples, dimensionOrder: order, achievedDistribution: achieved };
}

/** Bucket numeric values into 5 equal-width bins for the achieved report. */
function bucketNumeric(
  value: number,
  input: SamplerInput,
  dimName: string,
): string {
  const dist = input.population.distributions[dimName];
  if (!dist || !isNumeric(dist)) return String(value);
  const width = (dist.max - dist.min) / 5;
  const bin = Math.min(4, Math.floor((value - dist.min) / width));
  const lo = dist.min + bin * width;
  const hi = lo + width;
  return `[${dist.integer ? Math.round(lo) : lo.toFixed(2)}, ${dist.integer ? Math.round(hi) : hi.toFixed(2)})`;
}
