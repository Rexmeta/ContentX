/**
 * Population domain model — cohort definition over registered dimensions.
 *
 * Architectural decision #4: statistical DependencyRules are completely
 * separate from SemanticRelationships. DependencyRules describe how
 * dimension values co-vary inside a population; they never appear in the
 * canonical content graph.
 */

// ---------- Distributions ----------

/** Discrete distribution over string values (enum/string/boolean dims). */
export interface CategoricalDistribution {
  type: "categorical";
  /** value → probability. Must sum to ~1. */
  weights: Record<string, number>;
}

/** Continuous/integer numeric distribution. */
export interface NumericDistribution {
  type: "uniform" | "normal";
  min: number;
  max: number;
  /** normal only */
  mean?: number;
  /** normal only */
  stddev?: number;
  /** Round samples to integers (e.g. age). */
  integer?: boolean;
}

export type Distribution = CategoricalDistribution | NumericDistribution;

// ---------- Population ----------

export interface PopulationConstraint {
  dimension: string;
  allowedValues?: string[];
  min?: number;
  max?: number;
}

export interface SamplingConfig {
  defaultStrategy?: SamplingStrategy;
  defaultSampleSize?: number;
}

export interface PopulationProvenance {
  operation: string;
  createdAt: string;
  sourceType?: string | null;
}

export interface Population {
  id: string;
  name: string;
  domain: string;
  schemaVersion: string;
  dimensions: string[];
  distributions: Record<string, Distribution>;
  constraints?: PopulationConstraint[];
  samplingConfig?: SamplingConfig | null;
  provenance: PopulationProvenance;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ---------- DependencyRule ----------

export const DEPENDENCY_RULE_TYPES = [
  "conditional",
  "constraint",
  "exclusion",
  "implication",
  "correlation",
] as const;
export type DependencyRuleType = (typeof DEPENDENCY_RULE_TYPES)[number];

/** Condition on the SOURCE dimension value. Rule fires if ANY matches. */
export interface RuleCondition {
  equals?: string | number | boolean;
  in?: string[];
  min?: number;
  max?: number;
}

/** Effect payload; shape depends on rule type. */
export interface RuleEffect {
  /** conditional: distribution the target is drawn from when rule fires. */
  distribution?: Distribution;
  /** implication: fixed target value when rule fires. */
  value?: string | number | boolean;
  /** exclusion: target values forbidden when rule fires. */
  excludedValues?: string[];
  /** constraint: target must satisfy when rule fires. */
  allowedValues?: string[];
  min?: number;
  max?: number;
}

export interface DependencyRule {
  id: string;
  populationId: string;
  sourceDimension: string;
  targetDimension: string;
  type: DependencyRuleType;
  conditions: RuleCondition[];
  effect: RuleEffect;
  strength?: number | null;
  provenance: PopulationProvenance;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ---------- Sampling ----------

export const SAMPLING_STRATEGIES = [
  "random",
  "weighted",
  "conditional",
  "stratified",
] as const;
export type SamplingStrategy = (typeof SAMPLING_STRATEGIES)[number];

/** dimension → (value → proportion); used by the stratified strategy. */
export type TargetDistribution = Record<string, Record<string, number>>;

export interface SamplingRun {
  id: string;
  populationId: string;
  seed: number;
  strategy: SamplingStrategy;
  sampleSize: number;
  constraints?: PopulationConstraint[] | null;
  targetDistribution?: TargetDistribution | null;
  requestedDistribution: Record<string, unknown>;
  achievedDistribution: Record<string, Record<string, number>>;
  characterIds: string[];
  populationVersion: number;
  schemaVersion: string;
  dependencyGraphVersion: string;
  createdAt: string;
}

/** Thrown for invalid population/rule/sampling definitions (→ 400). */
export class InvalidPopulationError extends Error {}
