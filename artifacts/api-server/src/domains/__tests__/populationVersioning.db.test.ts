/**
 * Real-database tests for population/dependency-rule version history and
 * sampling reproducibility (spec invariant 7):
 * - updates bump versions and preserve prior definitions in history
 * - a pinned (populationVersion, dependencyGraphVersion) pair resolves the
 *   exact historical definition even after further edits
 * - re-sampling with the same seed under the pinned versions reproduces
 *   identical attribute sequences after the live definition has changed
 *
 * Skipped when DATABASE_URL is not configured.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  populationVersionsTable,
  dependencyGraphVersionsTable,
} from "@workspace/db";
import * as populationService from "../population/service";
import * as characterService from "../character/service";
import * as dimensionService from "../population/dimensionService";
import type { Distribution } from "../population/model";

const hasDb = Boolean(process.env["DATABASE_URL"]);
const d = hasDb ? describe : describe.skip;

const createdPopulationIds: string[] = [];
const createdCharacterIds: string[] = [];

afterAll(async () => {
  for (const id of createdCharacterIds) {
    await characterService.deleteCharacter(id).catch(() => {});
  }
  for (const id of createdPopulationIds) {
    await populationService.deletePopulation(id).catch(() => {});
  }
});

const V1_DISTRIBUTIONS: Record<string, Distribution> = {
  occupation: {
    type: "categorical",
    weights: { engineer: 0.5, manager: 0.5 },
  },
  authority_level: {
    type: "categorical",
    weights: { low: 0.5, high: 0.5 },
  },
};

const V2_DISTRIBUTIONS: Record<string, Distribution> = {
  occupation: {
    type: "categorical",
    weights: { engineer: 0.1, manager: 0.9 },
  },
  authority_level: {
    type: "categorical",
    weights: { low: 0.2, high: 0.8 },
  },
};

d("population version history (real DB)", () => {
  beforeAll(async () => {
    await dimensionService.ensureSeedDimensions();
  });

  async function makePopulation() {
    const population = await populationService.createPopulation({
      name: `verhist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      domain: "test",
      dimensions: ["occupation", "authority_level"],
      distributions: V1_DISTRIBUTIONS,
    });
    createdPopulationIds.push(population.id);
    return population;
  }

  it("update bumps population version and preserves the old definition", async () => {
    const population = await makePopulation();
    expect(population.version).toBe(1);

    const updated = await populationService.updatePopulation(population.id, {
      distributions: V2_DISTRIBUTIONS,
    });
    expect(updated.version).toBe(2);

    const v1 = await populationService.getPopulationDefinitionAt({
      populationId: population.id,
      populationVersion: 1,
      dependencyGraphVersion: "empty",
    });
    expect(v1.population.version).toBe(1);
    expect(v1.population.distributions).toEqual(V1_DISTRIBUTIONS);

    const v2 = await populationService.getPopulationDefinitionAt({
      populationId: population.id,
      populationVersion: 2,
      dependencyGraphVersion: "empty",
    });
    expect(v2.population.distributions).toEqual(V2_DISTRIBUTIONS);
  });

  it("rule update bumps rule version and old graph digests stay resolvable", async () => {
    const population = await makePopulation();
    const rule = await populationService.createDependencyRule({
      populationId: population.id,
      sourceDimension: "occupation",
      targetDimension: "authority_level",
      type: "implication",
      conditions: [{ equals: "manager" }],
      effect: { value: "high" },
    });
    expect(rule.version).toBe(1);

    // Sample once so the run pins the current graph digest.
    const { run: run1, characterIds: ids1 } =
      await populationService.samplePopulation({
        populationId: population.id,
        sampleSize: 10,
        strategy: "conditional",
        seed: 42,
      });
    createdCharacterIds.push(...ids1);

    const updatedRule = await populationService.updateDependencyRule(rule.id, {
      effect: { value: "low" },
    });
    expect(updatedRule.version).toBe(2);

    // The OLD digest still resolves to the OLD rule definition.
    const old = await populationService.getPopulationDefinitionAt({
      populationId: population.id,
      populationVersion: run1.populationVersion,
      dependencyGraphVersion: run1.dependencyGraphVersion,
    });
    expect(old.rules).toHaveLength(1);
    expect(old.rules[0]!.version).toBe(1);
    expect(old.rules[0]!.effect).toEqual({ value: "high" });
  });

  it("rejects population updates that orphan existing rules", async () => {
    const population = await makePopulation();
    await populationService.createDependencyRule({
      populationId: population.id,
      sourceDimension: "occupation",
      targetDimension: "authority_level",
      type: "implication",
      conditions: [{ equals: "manager" }],
      effect: { value: "high" },
    });
    await expect(
      populationService.updatePopulation(population.id, {
        dimensions: ["occupation"],
        distributions: {
          occupation: V1_DISTRIBUTIONS["occupation"]!,
        },
      }),
    ).rejects.toThrow(/references dimension/);
  });

  it("legacy rows without snapshots are backfilled on first mutation", async () => {
    const population = await makePopulation();
    const rule = await populationService.createDependencyRule({
      populationId: population.id,
      sourceDimension: "occupation",
      targetDimension: "authority_level",
      type: "implication",
      conditions: [{ equals: "manager" }],
      effect: { value: "high" },
    });
    const { run: legacyRun, characterIds } =
      await populationService.samplePopulation({
        populationId: population.id,
        sampleSize: 10,
        strategy: "conditional",
        seed: 7,
      });
    createdCharacterIds.push(...characterIds);

    // Simulate a population/graph created BEFORE version history existed:
    // wipe all snapshot rows.
    await db
      .delete(populationVersionsTable)
      .where(eq(populationVersionsTable.populationId, population.id));
    await db
      .delete(dependencyGraphVersionsTable)
      .where(eq(dependencyGraphVersionsTable.populationId, population.id));

    // First mutations after the feature: must preserve the PRE-mutation
    // definition and graph before applying changes.
    await populationService.updatePopulation(population.id, {
      distributions: V2_DISTRIBUTIONS,
    });
    await populationService.updateDependencyRule(rule.id, {
      effect: { value: "low" },
    });

    // The legacy run's pins must still resolve to the original definitions.
    const old = await populationService.getPopulationDefinitionAt({
      populationId: population.id,
      populationVersion: legacyRun.populationVersion,
      dependencyGraphVersion: legacyRun.dependencyGraphVersion,
    });
    expect(old.population.version).toBe(legacyRun.populationVersion);
    expect(old.population.distributions).toEqual(V1_DISTRIBUTIONS);
    expect(old.rules).toHaveLength(1);
    expect(old.rules[0]!.effect).toEqual({ value: "high" });

    // And pinned re-sampling under those legacy pins reproduces the run.
    const { run: replay, characterIds: replayIds } =
      await populationService.samplePopulation({
        populationId: population.id,
        sampleSize: 10,
        strategy: "conditional",
        seed: 7,
        populationVersion: legacyRun.populationVersion,
        dependencyGraphVersion: legacyRun.dependencyGraphVersion,
      });
    createdCharacterIds.push(...replayIds);
    expect(replay.achievedDistribution).toEqual(
      legacyRun.achievedDistribution,
    );
  });

  it("concurrent population update vs rule creation never commits an orphaned rule", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const population = await makePopulation();

      // Race: shrink the dimension set while creating a rule that needs
      // the dimension being removed. Exactly one consistent outcome may
      // commit: either the update wins (rule creation fails) or the rule
      // wins (update fails the orphan check) — never both.
      const results = await Promise.allSettled([
        populationService.updatePopulation(population.id, {
          dimensions: ["occupation"],
          distributions: { occupation: V1_DISTRIBUTIONS["occupation"]! },
        }),
        populationService.createDependencyRule({
          populationId: population.id,
          sourceDimension: "occupation",
          targetDimension: "authority_level",
          type: "implication",
          conditions: [{ equals: "manager" }],
          effect: { value: "high" },
        }),
      ]);

      const final = await populationService.getPopulation(population.id);
      const rules = await populationService.listDependencyRules(population.id);
      for (const rule of rules) {
        expect(final!.dimensions).toContain(rule.sourceDimension);
        expect(final!.dimensions).toContain(rule.targetDimension);
      }
      // At least one side must have succeeded (no deadlock/double-failure
      // beyond legitimate validation rejection).
      expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    }
  });

  it("pinned re-sampling reproduces a past run after the definition changed", async () => {
    const population = await makePopulation();
    const rule = await populationService.createDependencyRule({
      populationId: population.id,
      sourceDimension: "occupation",
      targetDimension: "authority_level",
      type: "implication",
      conditions: [{ equals: "manager" }],
      effect: { value: "high" },
    });

    const { run: original, characterIds: origIds } =
      await populationService.samplePopulation({
        populationId: population.id,
        sampleSize: 20,
        strategy: "conditional",
        seed: 1234,
      });
    createdCharacterIds.push(...origIds);
    const originalChars = await Promise.all(
      origIds.map((id) => characterService.getCharacter(id)),
    );

    // Mutate BOTH the population and the rule set.
    await populationService.updatePopulation(population.id, {
      distributions: V2_DISTRIBUTIONS,
    });
    await populationService.updateDependencyRule(rule.id, {
      effect: { value: "low" },
    });

    // Unpinned sampling now uses the new definition (different pins).
    const { run: fresh, characterIds: freshIds } =
      await populationService.samplePopulation({
        populationId: population.id,
        sampleSize: 20,
        strategy: "conditional",
        seed: 1234,
      });
    createdCharacterIds.push(...freshIds);
    expect(fresh.populationVersion).not.toBe(original.populationVersion);
    expect(fresh.dependencyGraphVersion).not.toBe(
      original.dependencyGraphVersion,
    );

    // Pinned sampling reproduces the ORIGINAL run exactly.
    const { run: replay, characterIds: replayIds } =
      await populationService.samplePopulation({
        populationId: population.id,
        sampleSize: 20,
        strategy: "conditional",
        seed: 1234,
        populationVersion: original.populationVersion,
        dependencyGraphVersion: original.dependencyGraphVersion,
      });
    createdCharacterIds.push(...replayIds);
    expect(replay.populationVersion).toBe(original.populationVersion);
    expect(replay.dependencyGraphVersion).toBe(
      original.dependencyGraphVersion,
    );
    expect(replay.achievedDistribution).toEqual(
      original.achievedDistribution,
    );

    const replayChars = await Promise.all(
      replayIds.map((id) => characterService.getCharacter(id)),
    );
    expect(replayChars.map((c) => c?.attributes)).toEqual(
      originalChars.map((c) => c?.attributes),
    );
  });
});
