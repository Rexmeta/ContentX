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
import {
  dependencyGraphVersion,
  toDependencyRule,
  type PopulationDefinitionSnapshot,
} from "./versioning";
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

/**
 * Versioned population update: version increments and the new definition
 * is snapshotted into history; existing rules must remain valid against
 * the updated dimension set (otherwise the graph would silently break).
 */
export async function updatePopulation(
  id: string,
  input: {
    name?: string;
    domain?: string;
    dimensions?: string[];
    distributions?: Record<string, Distribution>;
    constraints?: PopulationConstraint[];
    samplingConfig?: SamplingConfig | null;
  },
): Promise<Population> {
  const existing = await repo.getPopulation(id);
  if (!existing) {
    throw new PopulationNotFoundError(`Population "${id}" not found.`);
  }
  const dims = await registry();

  // The patch is built and validated FROM THE LOCKED current row inside the
  // transaction, so concurrent updates cannot validate against stale state.
  const updated = await repo.updatePopulationSerialized(
    id,
    (currentRow, ruleRows) => {
      const current = toPopulation(currentRow);
      const next = {
        name: input.name ?? current.name,
        domain: input.domain ?? current.domain,
        dimensions: input.dimensions ?? current.dimensions,
        distributions: input.distributions ?? current.distributions,
        constraints: input.constraints ?? current.constraints ?? [],
        samplingConfig:
          input.samplingConfig === undefined
            ? (current.samplingConfig ?? null)
            : input.samplingConfig,
      };
      validatePopulationDefinition(next, dims);
      // Every existing rule must still reference dimensions of the new set.
      for (const r of ruleRows) {
        for (const dim of [r.sourceDimension, r.targetDimension]) {
          if (!next.dimensions.includes(dim)) {
            throw new InvalidPopulationError(
              `Cannot update population: dependency rule "${r.id}" references dimension "${dim}" which is not in the updated dimension set. Delete or update the rule first.`,
            );
          }
        }
      }
      return {
        name: next.name.trim(),
        domain: next.domain.trim(),
        dimensions: next.dimensions,
        distributions: next.distributions,
        constraints: next.constraints,
        samplingConfig: next.samplingConfig,
        provenance: {
          ...current.provenance,
          operation: "update",
          updatedAt: new Date().toISOString(),
        },
      };
    },
  );
  if (!updated) {
    throw new PopulationNotFoundError(`Population "${id}" not found.`);
  }
  return toPopulation(updated);
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
  const dims = await registry();
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

  // Dimension validation AND cycle rejection happen INSIDE the transaction
  // with the population row locked, so a concurrent population update or
  // rule creation cannot invalidate this rule between check and commit.
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
    (lockedPopulationRow, existingRows) => {
      const population = toPopulation(lockedPopulationRow);
      validateDependencyRuleDefinition(input, population.dimensions, dims);
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

/**
 * Versioned rule update: version increments, the cycle check re-runs with
 * the updated rule substituted, and the resulting graph digest is
 * snapshotted so it stays resolvable.
 */
export async function updateDependencyRule(
  id: string,
  input: {
    sourceDimension?: string;
    targetDimension?: string;
    type?: string;
    conditions?: RuleCondition[];
    effect?: RuleEffect;
    strength?: number | null;
  },
): Promise<DependencyRule> {
  const existingRow = await repo.getRule(id);
  if (!existingRow) {
    throw new PopulationNotFoundError(`Dependency rule "${id}" not found.`);
  }
  const dims = await registry();

  // Patch is built + validated from the LOCKED population row and current
  // rule row inside the transaction (no stale pre-transaction state).
  const updated = await repo.updateRuleSerialized(
    id,
    (lockedPopulationRow, currentRow, otherRows) => {
      const population = toPopulation(lockedPopulationRow);
      const current = toDependencyRule(currentRow);
      const next = {
        populationId: current.populationId,
        sourceDimension: input.sourceDimension ?? current.sourceDimension,
        targetDimension: input.targetDimension ?? current.targetDimension,
        type: input.type ?? current.type,
        conditions: input.conditions ?? current.conditions,
        effect: input.effect ?? current.effect,
        strength:
          input.strength === undefined ? current.strength : input.strength,
      };
      validateDependencyRuleDefinition(next, population.dimensions, dims);
      const candidate: DependencyRule = {
        ...current,
        ...next,
        type: next.type as DependencyRuleType,
        strength: next.strength ?? null,
      };
      topologicalDimensionOrder(population.dimensions, [
        ...otherRows.map(toDependencyRule),
        candidate,
      ]);
      return {
        sourceDimension: next.sourceDimension,
        targetDimension: next.targetDimension,
        type: next.type,
        conditions: next.conditions,
        effect: next.effect,
        strength: next.strength ?? null,
        provenance: {
          ...current.provenance,
          operation: "update",
          updatedAt: new Date().toISOString(),
        },
      };
    },
  );
  if (!updated) {
    throw new PopulationNotFoundError(`Dependency rule "${id}" not found.`);
  }
  return toDependencyRule(updated);
}
export async function deleteDependencyRule(id: string): Promise<boolean> {
  return repo.deleteRule(id);
}

/**
 * Resolve the exact population definition + rule set behind a pinned
 * (populationVersion, dependencyGraphVersion) pair, e.g. from a past
 * SamplingRun — the reproducibility invariant made concrete.
 */
export async function getPopulationDefinitionAt(input: {
  populationId: string;
  populationVersion: number;
  dependencyGraphVersion: string;
}): Promise<{ population: Population; rules: DependencyRule[] }> {
  const liveRow = await repo.getPopulation(input.populationId);
  if (!liveRow) {
    throw new PopulationNotFoundError(
      `Population "${input.populationId}" not found.`,
    );
  }
  const live = toPopulation(liveRow);

  let population: Population;
  if (live.version === input.populationVersion) {
    population = live;
  } else {
    const versionRow = await repo.getPopulationVersion(
      input.populationId,
      input.populationVersion,
    );
    if (!versionRow) {
      throw new PopulationNotFoundError(
        `No stored definition for population "${input.populationId}" version ${input.populationVersion}.`,
      );
    }
    const def = versionRow.definition as PopulationDefinitionSnapshot;
    population = {
      id: live.id,
      name: def.name,
      domain: def.domain,
      schemaVersion: def.schemaVersion,
      dimensions: def.dimensions,
      distributions: def.distributions as Record<string, Distribution>,
      constraints: (def.constraints as PopulationConstraint[]) ?? [],
      samplingConfig: (def.samplingConfig as SamplingConfig | null) ?? null,
      provenance: def.provenance,
      version: versionRow.version,
      createdAt: versionRow.createdAt.toISOString(),
      updatedAt: versionRow.createdAt.toISOString(),
    };
  }

  let rules: DependencyRule[];
  if (input.dependencyGraphVersion === "empty") {
    rules = [];
  } else {
    const liveRules = (
      await repo.listRulesForPopulation(input.populationId)
    ).map(toDependencyRule);
    if (dependencyGraphVersion(liveRules) === input.dependencyGraphVersion) {
      rules = liveRules;
    } else {
      const graphRow = await repo.getGraphVersion(
        input.populationId,
        input.dependencyGraphVersion,
      );
      if (!graphRow) {
        throw new PopulationNotFoundError(
          `No stored rule set for population "${input.populationId}" dependency graph version "${input.dependencyGraphVersion}".`,
        );
      }
      rules = graphRow.rules as DependencyRule[];
    }
  }
  return { population, rules };
}
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
export async function samplePopulation(input: {
  populationId: string;
  sampleSize: number;
  strategy: SamplingStrategy;
  seed: number;
  constraints?: PopulationConstraint[] | null;
  targetDistribution?: TargetDistribution | null;
  /** Pin to a historical definition (reproduce a past run). */
  populationVersion?: number | null;
  dependencyGraphVersion?: string | null;
}): Promise<{ run: SamplingRun; characterIds: string[] }> {
  const populationRow = await repo.getPopulation(input.populationId);
  if (!populationRow) {
    throw new PopulationNotFoundError(
      `Population "${input.populationId}" not found.`,
    );
  }
  const live = toPopulation(populationRow);
  const liveRules = (
    await repo.listRulesForPopulation(input.populationId)
  ).map(toDependencyRule);

  // Optional version pins: resolve the historical definition instead of the
  // live one, so the same seed reproduces the original run byte-for-byte.
  let population = live;
  let rules = liveRules;
  if (input.populationVersion != null || input.dependencyGraphVersion != null) {
    const resolved = await getPopulationDefinitionAt({
      populationId: input.populationId,
      populationVersion: input.populationVersion ?? live.version,
      dependencyGraphVersion:
        input.dependencyGraphVersion ?? dependencyGraphVersion(liveRules),
    });
    population = resolved.population;
    rules = resolved.rules;
  }
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
