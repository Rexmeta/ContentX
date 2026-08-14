import { newId } from "../../shared/id";
import type {
  PopulationRow,
  DependencyRuleRow,
  SamplingRunRow,
} from "@workspace/db";
import * as dimensionService from "./dimensionService";
import type { Dimension } from "./dimensionModel";
import {
  InvalidPopulationError,
  type Distribution,
  type DependencyRule,
  type DependencyRuleType,
  type Population,
  type PopulationConstraint,
  type PopulationProvenance,
  type RuleCondition,
  type RuleEffect,
  type SamplingConfig,
  type SamplingRun,
  type SamplingStrategy,
  type TargetDistribution,
} from "./model";
import {
  validatePopulationDefinition,
  validateDependencyRuleDefinition,
  validateConstraint,
} from "./populationValidator";
import { runSampler, topologicalDimensionOrder } from "./sampler";
import * as repo from "./repository";
import * as characterService from "../character/service";
import { GROUP_CATEGORY_MAP } from "../character/attributeValidator";
import type { CharacterAttributes, AttributeMap } from "../character/model";

export { InvalidPopulationError };

/** Thrown when a referenced population/rule/run does not exist (→ 404). */
export class PopulationNotFoundError extends Error {}

// ---------- mapping ----------

export function toPopulation(row: PopulationRow): Population {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    schemaVersion: row.schemaVersion,
    dimensions: row.dimensions as string[],
    distributions: row.distributions as Record<string, Distribution>,
    constraints: (row.constraints as PopulationConstraint[] | null) ?? [],
    samplingConfig: (row.samplingConfig as SamplingConfig | null) ?? null,
    provenance: row.provenance as PopulationProvenance,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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

export function toSamplingRun(row: SamplingRunRow): SamplingRun {
  return {
    id: row.id,
    populationId: row.populationId,
    seed: row.seed,
    strategy: row.strategy as SamplingStrategy,
    sampleSize: row.sampleSize,
    constraints: (row.constraints as PopulationConstraint[] | null) ?? null,
    targetDistribution:
      (row.targetDistribution as TargetDistribution | null) ?? null,
    requestedDistribution: row.requestedDistribution as Record<
      string,
      unknown
    >,
    achievedDistribution: row.achievedDistribution as Record<
      string,
      Record<string, number>
    >,
    characterIds: row.characterIds as string[],
    populationVersion: row.populationVersion,
    schemaVersion: row.schemaVersion,
    dependencyGraphVersion: row.dependencyGraphVersion,
    createdAt: row.createdAt.toISOString(),
  };
}

async function registry(): Promise<Map<string, Dimension>> {
  const dims = await dimensionService.listDimensions();
  return new Map(dims.map((d) => [d.name, d]));
}

// ---------- populations ----------

export async function createPopulation(input: {
  name: string;
  domain: string;
  dimensions: string[];
  distributions: Record<string, Distribution>;
  constraints?: PopulationConstraint[];
  samplingConfig?: SamplingConfig | null;
  /** Origin provenance (e.g. import bridge); defaults to manual creation. */
  provenance?: PopulationProvenance;
}): Promise<Population> {
  validatePopulationDefinition(input, await registry());
  const row = await repo.insertPopulation({
    id: newId("population"),
    name: input.name.trim(),
    domain: input.domain.trim(),
    schemaVersion: "1",
    dimensions: input.dimensions,
    distributions: input.distributions,
    constraints: input.constraints ?? [],
    samplingConfig: input.samplingConfig ?? null,
    provenance: input.provenance ?? {
      operation: "create",
      createdAt: new Date().toISOString(),
      sourceType: "manual",
    },
    version: 1,
  });
  return toPopulation(row);
}

export async function listPopulations(): Promise<Population[]> {
  return (await repo.listPopulations()).map(toPopulation);
}

export async function getPopulation(id: string): Promise<Population | null> {
  const row = await repo.getPopulation(id);
  return row ? toPopulation(row) : null;
}

export async function deletePopulation(id: string): Promise<boolean> {
  return repo.deletePopulation(id);
}

// ---------- dependency rules ----------

export async function createDependencyRule(input: {
  populationId: string;
  sourceDimension: string;
  targetDimension: string;
  type: string;
  conditions: RuleCondition[];
  effect: RuleEffect;
  strength?: number | null;
  /** Origin provenance (e.g. import bridge); defaults to manual creation. */
  provenance?: PopulationProvenance;
}): Promise<DependencyRule> {
  const populationRow = await repo.getPopulation(input.populationId);
  if (!populationRow) {
    throw new PopulationNotFoundError(
      `Population "${input.populationId}" not found.`,
    );
  }
  const population = toPopulation(populationRow);
  validateDependencyRuleDefinition(
    input,
    population.dimensions,
    await registry(),
  );
  const candidate = {
    ...input,
    id: "candidate",
    type: input.type as DependencyRuleType,
    provenance: { operation: "create", createdAt: "" },
    version: 1,
    createdAt: "",
    updatedAt: "",
    strength: input.strength ?? null,
  } satisfies DependencyRule;

  // Cycle rejection happens INSIDE the transaction with the population row
  // locked, so concurrent rule creations cannot commit a cycle together.
  const row = await repo.insertRuleSerialized(
    {
      id: newId("dependency"),
      populationId: input.populationId,
      sourceDimension: input.sourceDimension,
      targetDimension: input.targetDimension,
      type: input.type,
      conditions: input.conditions,
      effect: input.effect,
      strength: input.strength ?? null,
      provenance: input.provenance ?? {
        operation: "create",
        createdAt: new Date().toISOString(),
        sourceType: "manual",
      },
      version: 1,
    },
    (existingRows) => {
      const existing = existingRows.map(toDependencyRule);
      topologicalDimensionOrder(population.dimensions, [
        ...existing,
        candidate,
      ]);
    },
  );
  return toDependencyRule(row);
}

export async function listDependencyRules(
  populationId: string,
): Promise<DependencyRule[]> {
  const population = await repo.getPopulation(populationId);
  if (!population) {
    throw new PopulationNotFoundError(
      `Population "${populationId}" not found.`,
    );
  }
  return (await repo.listRulesForPopulation(populationId)).map(
    toDependencyRule,
  );
}

export async function deleteDependencyRule(id: string): Promise<boolean> {
  return repo.deleteRule(id);
}

// ---------- sampling ----------

/** Map a dimension category to the character attribute group it belongs in. */
function groupForCategory(category: string): string | null {
  for (const [group, categories] of Object.entries(GROUP_CATEGORY_MAP)) {
    if (categories.includes(category)) return group;
  }
  return null;
}

function sampleToAttributes(
  sample: Record<string, string | number | boolean>,
  dims: Map<string, Dimension>,
): CharacterAttributes {
  const attributes: Record<string, AttributeMap> = {};
  for (const [dimName, value] of Object.entries(sample)) {
    const dim = dims.get(dimName);
    if (!dim) continue;
    const group = groupForCategory(dim.category);
    if (!group) continue;
    (attributes[group] ??= {})[dimName] = value;
  }
  return attributes as CharacterAttributes;
}

/**
 * The dependency graph version: deterministic digest of rule ids+versions,
 * so a run records exactly which rule set produced it.
 */
function dependencyGraphVersion(rules: DependencyRule[]): string {
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

export async function samplePopulation(input: {
  populationId: string;
  sampleSize: number;
  strategy: SamplingStrategy;
  seed: number;
  constraints?: PopulationConstraint[] | null;
  targetDistribution?: TargetDistribution | null;
}): Promise<{ run: SamplingRun; characterIds: string[] }> {
  const populationRow = await repo.getPopulation(input.populationId);
  if (!populationRow) {
    throw new PopulationNotFoundError(
      `Population "${input.populationId}" not found.`,
    );
  }
  const population = toPopulation(populationRow);
  const rules = (await repo.listRulesForPopulation(input.populationId)).map(
    toDependencyRule,
  );
  const dims = await registry();

  // Request-level constraints must reference population dimensions and be
  // type-valid — silent skipping of bad constraints is not acceptable.
  for (const c of input.constraints ?? []) {
    if (!population.dimensions.includes(c.dimension)) {
      throw new InvalidPopulationError(
        `Sampling constraint references dimension "${c.dimension}" not in the population.`,
      );
    }
    validateConstraint(c, dims, "constraints");
  }

  const result = runSampler({
    population,
    rules,
    registry: dims,
    sampleSize: input.sampleSize,
    strategy: input.strategy,
    seed: input.seed,
    constraints: input.constraints ?? null,
    targetDistribution: input.targetDistribution ?? null,
  });

  const depVersion = dependencyGraphVersion(rules);

  // The run id is allocated BEFORE building character rows so every sampled
  // character carries its SamplingRun reference (unbroken lineage:
  // snapshot → samplingRunId → populationId → import provenance).
  const samplingRunId = newId("samplingrun");

  // Build + fully validate ALL character rows before writing anything;
  // then commit characters + audit in one transaction (no orphans).
  const characterRows = [];
  for (let i = 0; i < result.samples.length; i++) {
    characterRows.push(
      await characterService.buildSampledCharacterRow({
        name: `${population.name} #${i + 1}`,
        attributes: sampleToAttributes(result.samples[i]!, dims),
        provenance: {
          operation: "sample",
          createdAt: new Date().toISOString(),
          sourceType: "population",
          populationId: population.id,
          samplingRunId,
          seed: input.seed,
          populationVersion: population.version,
          schemaVersion: population.schemaVersion,
          dependencyGraphVersion: depVersion,
          sampleIndex: i,
          strategy: input.strategy,
        },
      }),
    );
  }
  const characterIds = characterRows.map((r) => r.id);

  const run = await repo.insertSamplingRunWithCharacters(characterRows, {
    id: samplingRunId,
    populationId: population.id,
    seed: input.seed,
    strategy: input.strategy,
    sampleSize: input.sampleSize,
    constraints: input.constraints ?? null,
    targetDistribution: input.targetDistribution ?? null,
    requestedDistribution: {
      distributions: population.distributions,
      targetDistribution: input.targetDistribution ?? null,
    },
    achievedDistribution: result.achievedDistribution,
    characterIds,
    populationVersion: population.version,
    schemaVersion: population.schemaVersion,
    dependencyGraphVersion: depVersion,
  });
  return { run: toSamplingRun(run), characterIds };
}

export async function getSamplingRun(id: string): Promise<SamplingRun | null> {
  const row = await repo.getSamplingRun(id);
  return row ? toSamplingRun(row) : null;
}

export async function listSamplingRuns(
  populationId: string,
): Promise<SamplingRun[]> {
  const population = await repo.getPopulation(populationId);
  if (!population) {
    throw new PopulationNotFoundError(
      `Population "${populationId}" not found.`,
    );
  }
  return (await repo.listSamplingRuns(populationId)).map(toSamplingRun);
}
