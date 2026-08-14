import type { DependencyRuleRow, PopulationRow } from "@workspace/db";
import type {
  DependencyRule,
  DependencyRuleType,
  PopulationProvenance,
  RuleCondition,
  RuleEffect,
} from "./model";

/**
 * Version-history helpers shared by the population service and repository.
 *
 * Reproducibility invariant: a SamplingRun pins populationVersion +
 * dependencyGraphVersion; these helpers produce (a) the deterministic graph
 * digest and (b) the immutable JSON snapshots stored in
 * population_versions / dependency_graph_versions so those pins can always
 * be resolved back to the exact definitions.
 */

/**
 * The dependency graph version: deterministic digest of rule ids+versions,
 * so a run records exactly which rule set produced it.
 */
export function dependencyGraphVersion(
  rules: Array<{ id: string; version: number }>,
): string {
  if (rules.length === 0) return "empty";
  const parts = rules
    .map((r) => `${r.id}:${r.version}`)
    .sort()
    .join(",");
  let h = 5381;
  for (let i = 0; i < parts.length; i++) {
    h = (Math.imul(h, 33) ^ parts.charCodeAt(i)) >>> 0;
  }
  return `${rules.length}-${h.toString(16)}`;
}

export function toDependencyRule(row: DependencyRuleRow): DependencyRule {
  return {
    id: row.id,
    populationId: row.populationId,
    sourceDimension: row.sourceDimension,
    targetDimension: row.targetDimension,
    type: row.type as DependencyRuleType,
    conditions: row.conditions as RuleCondition[],
    effect: row.effect as RuleEffect,
    strength: row.strength ?? null,
    provenance: row.provenance as PopulationProvenance,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Definition snapshot stored per population version (no id/timestamps). */
export interface PopulationDefinitionSnapshot {
  name: string;
  domain: string;
  schemaVersion: string;
  dimensions: string[];
  distributions: Record<string, unknown>;
  constraints: unknown[];
  samplingConfig: unknown | null;
  provenance: PopulationProvenance;
  [key: string]: unknown;
}

export function populationDefinitionSnapshot(
  row: PopulationRow,
): PopulationDefinitionSnapshot {
  return {
    name: row.name,
    domain: row.domain,
    schemaVersion: row.schemaVersion,
    dimensions: row.dimensions as string[],
    distributions: row.distributions as Record<string, unknown>,
    constraints: (row.constraints as unknown[] | null) ?? [],
    samplingConfig: row.samplingConfig ?? null,
    provenance: row.provenance as PopulationProvenance,
  };
}

/** Full rule-set snapshot stored per dependency graph version. */
export function graphRulesSnapshot(rows: DependencyRuleRow[]): DependencyRule[] {
  return rows.map(toDependencyRule);
}
