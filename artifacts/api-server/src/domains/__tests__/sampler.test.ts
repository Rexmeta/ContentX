import { describe, it, expect } from "vitest";
import { mulberry32, deriveSeed } from "../population/prng";
import {
  runSampler,
  topologicalDimensionOrder,
  allocateStrata,
} from "../population/sampler";
import {
  validatePopulationDefinition,
  validateDependencyRuleDefinition,
} from "../population/populationValidator";
import {
  InvalidPopulationError,
  type DependencyRule,
  type Population,
} from "../population/model";
import type { Dimension } from "../population/dimensionModel";

// ---------- fixtures ----------

const DIMS: Dimension[] = [
  { id: "d1", name: "occupation", category: "professional", dataType: "string", allowedValues: null, source: "seed", version: 1 },
  { id: "d2", name: "authority_level", category: "professional", dataType: "enum", allowedValues: ["very_low", "low", "medium", "high", "very_high"], source: "seed", version: 1 },
  { id: "d3", name: "age", category: "demographic", dataType: "number", allowedValues: null, source: "seed", version: 1 },
  { id: "d4", name: "years_experience", category: "professional", dataType: "number", allowedValues: null, source: "seed", version: 1 },
];
const registry = new Map(DIMS.map((d) => [d.name, d]));

function makePopulation(): Population {
  return {
    id: "population_test",
    name: "Test Cohort",
    domain: "sales",
    schemaVersion: "1",
    dimensions: ["occupation", "authority_level", "age", "years_experience"],
    distributions: {
      occupation: {
        type: "categorical",
        weights: { manager: 0.4, representative: 0.6 },
      },
      authority_level: {
        type: "categorical",
        weights: { low: 0.4, medium: 0.4, high: 0.2 },
      },
      age: { type: "uniform", min: 25, max: 55, integer: true },
      years_experience: { type: "uniform", min: 0, max: 30, integer: true },
    },
    constraints: [],
    samplingConfig: null,
    provenance: { operation: "create", createdAt: "" },
    version: 1,
    createdAt: "",
    updatedAt: "",
  };
}

function makeRule(partial: Partial<DependencyRule>): DependencyRule {
  return {
    id: "dependency_test",
    populationId: "population_test",
    sourceDimension: "occupation",
    targetDimension: "authority_level",
    type: "conditional",
    conditions: [{ equals: "manager" }],
    effect: {
      distribution: {
        type: "categorical",
        weights: { high: 0.72, medium: 0.2, low: 0.08 },
      },
    },
    strength: null,
    provenance: { operation: "create", createdAt: "" },
    version: 1,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

// ---------- PRNG ----------

describe("seeded PRNG", () => {
  it("is deterministic and seed-sensitive", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const seqA = [a(), a(), a()];
    expect(seqA).toEqual([b(), b(), b()]);
    expect(seqA).not.toEqual([c(), c(), c()]);
    expect(deriveSeed(1, 2)).toBe(deriveSeed(1, 2));
    expect(deriveSeed(1, 2)).not.toBe(deriveSeed(1, 3));
  });
});

// ---------- topological order ----------

describe("dependency graph ordering", () => {
  it("orders sources before targets and throws on cycles", () => {
    const order = topologicalDimensionOrder(
      ["authority_level", "occupation", "age", "years_experience"],
      [makeRule({})],
    );
    expect(order.indexOf("occupation")).toBeLessThan(
      order.indexOf("authority_level"),
    );
    expect(() =>
      topologicalDimensionOrder(
        ["occupation", "authority_level"],
        [
          makeRule({}),
          makeRule({
            id: "r2",
            sourceDimension: "authority_level",
            targetDimension: "occupation",
          }),
        ],
      ),
    ).toThrow(/cycle/);
  });
});

// ---------- determinism ----------

describe("sampler determinism", () => {
  it("same seed + same definition → identical samples; different seed differs", () => {
    const base = {
      population: makePopulation(),
      rules: [makeRule({})],
      registry,
      sampleSize: 20,
      strategy: "conditional" as const,
      seed: 12345,
    };
    const run1 = runSampler(base);
    const run2 = runSampler({ ...base, population: makePopulation() });
    expect(run1.samples).toEqual(run2.samples);
    const run3 = runSampler({ ...base, seed: 54321 });
    expect(run1.samples).not.toEqual(run3.samples);
  });
});

// ---------- rule application ----------

describe("dependency rule application", () => {
  it("conditional rules skew the target distribution", () => {
    const withRules = runSampler({
      population: makePopulation(),
      rules: [makeRule({})],
      registry,
      sampleSize: 300,
      strategy: "conditional",
      seed: 7,
    });
    let managersHigh = 0;
    let managers = 0;
    for (const s of withRules.samples) {
      if (s["occupation"] === "manager") {
        managers++;
        if (s["authority_level"] === "high") managersHigh++;
      }
    }
    expect(managers).toBeGreaterThan(50);
    // Base high prob is 0.2; conditional bumps it to 0.72.
    expect(managersHigh / managers).toBeGreaterThan(0.55);
  });

  it("implication forces the value; exclusion removes values", () => {
    const implication = makeRule({
      type: "implication",
      effect: { value: "very_high" },
    });
    const out = runSampler({
      population: makePopulation(),
      rules: [implication],
      registry,
      sampleSize: 50,
      strategy: "conditional",
      seed: 3,
    });
    for (const s of out.samples) {
      if (s["occupation"] === "manager") {
        expect(s["authority_level"]).toBe("very_high");
      }
    }

    const exclusion = makeRule({
      type: "exclusion",
      effect: { excludedValues: ["low"] },
    });
    const out2 = runSampler({
      population: makePopulation(),
      rules: [exclusion],
      registry,
      sampleSize: 100,
      strategy: "conditional",
      seed: 3,
    });
    for (const s of out2.samples) {
      if (s["occupation"] === "manager") {
        expect(s["authority_level"]).not.toBe("low");
      }
    }
  });

  it("weighted strategy ignores rules; random ignores weights", () => {
    const implication = makeRule({
      type: "implication",
      effect: { value: "very_high" },
    });
    const weighted = runSampler({
      population: makePopulation(),
      rules: [implication],
      registry,
      sampleSize: 100,
      strategy: "weighted",
      seed: 9,
    });
    expect(
      weighted.samples.some(
        (s) =>
          s["occupation"] === "manager" &&
          s["authority_level"] !== "very_high",
      ),
    ).toBe(true);

    // random: very_high has weight 0 in the base weights map, so weighted
    // never draws it, but random (uniform over listed values) can't include
    // unlisted values either — instead check rough uniformity of listed ones.
    const random = runSampler({
      population: makePopulation(),
      rules: [],
      registry,
      sampleSize: 600,
      strategy: "random",
      seed: 11,
    });
    const counts: Record<string, number> = {};
    for (const s of random.samples) {
      const v = String(s["authority_level"]);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    // uniform over {low, medium, high} → each ≈200
    for (const v of ["low", "medium", "high"]) {
      expect(counts[v]).toBeGreaterThan(140);
    }
  });
});

// ---------- stratified ----------

describe("stratified strategy", () => {
  it("largest-remainder allocation is exact", () => {
    expect(allocateStrata({ a: 0.5, b: 0.3, c: 0.2 }, 10)).toEqual({
      a: 5,
      b: 3,
      c: 2,
    });
    const counts = allocateStrata({ a: 1 / 3, b: 1 / 3, c: 1 / 3 }, 10);
    expect(counts["a"]! + counts["b"]! + counts["c"]!).toBe(10);
  });

  it("achieves requested marginals exactly", () => {
    const out = runSampler({
      population: makePopulation(),
      rules: [],
      registry,
      sampleSize: 10,
      strategy: "stratified",
      seed: 21,
      targetDistribution: {
        occupation: { manager: 0.7, representative: 0.3 },
      },
    });
    const managers = out.samples.filter(
      (s) => s["occupation"] === "manager",
    ).length;
    expect(managers).toBe(7);
  });

  it("rejects strata values outside the base distribution and negative proportions", () => {
    expect(() =>
      runSampler({
        population: makePopulation(),
        rules: [],
        registry,
        sampleSize: 5,
        strategy: "stratified",
        seed: 1,
        targetDistribution: { occupation: { astronaut: 1 } },
      }),
    ).toThrow(/not part of the base distribution/);
    expect(() => allocateStrata({ a: -0.5, b: 1.5 }, 10)).toThrow(
      InvalidPopulationError,
    );
  });

  it("rejects forced strata values that violate hard constraints", () => {
    const pop = makePopulation();
    pop.constraints = [
      { dimension: "occupation", allowedValues: ["representative"] },
    ];
    expect(() =>
      runSampler({
        population: pop,
        rules: [],
        registry,
        sampleSize: 4,
        strategy: "stratified",
        seed: 2,
        targetDistribution: {
          occupation: { manager: 0.5, representative: 0.5 },
        },
      }),
    ).toThrow(/violates a hard constraint/);
  });

  it("forced strata still enforce implication/exclusion/constraint rules", () => {
    const implication = makeRule({
      sourceDimension: "occupation",
      targetDimension: "authority_level",
      type: "implication",
      conditions: [{ equals: "manager" }],
      effect: { value: "very_high" },
    });
    // Stratifying authority_level to values conflicting with the implication → error
    expect(() =>
      runSampler({
        population: makePopulation(),
        rules: [implication],
        registry,
        sampleSize: 10,
        strategy: "stratified",
        seed: 4,
        targetDistribution: { authority_level: { low: 0.5, medium: 0.5 } },
      }),
    ).toThrow(/implication rule .* requires/);

    const exclusion = makeRule({
      type: "exclusion",
      effect: { excludedValues: ["low"] },
    });
    expect(() =>
      runSampler({
        population: makePopulation(),
        rules: [exclusion],
        registry,
        sampleSize: 10,
        strategy: "stratified",
        seed: 4,
        targetDistribution: { authority_level: { low: 1 } },
      }),
    ).toThrow(/exclusion rule .* forbids/);
  });

  it("requires a targetDistribution", () => {
    expect(() =>
      runSampler({
        population: makePopulation(),
        rules: [],
        registry,
        sampleSize: 5,
        strategy: "stratified",
        seed: 1,
      }),
    ).toThrow(InvalidPopulationError);
  });
});

// ---------- validation ----------

describe("population/rule validation", () => {
  it("rejects weights not summing to 1 and unregistered dimensions", () => {
    const pop = makePopulation();
    expect(() =>
      validatePopulationDefinition(
        {
          ...pop,
          distributions: {
            ...pop.distributions,
            authority_level: {
              type: "categorical",
              weights: { low: 0.5, high: 0.6 },
            },
          },
        },
        registry,
      ),
    ).toThrow(/sum to 1/);
    expect(() =>
      validatePopulationDefinition(
        { ...pop, dimensions: [...pop.dimensions, "star_sign"] },
        registry,
      ),
    ).toThrow(/not registered/);
    expect(() =>
      validatePopulationDefinition(
        { ...pop, distributions: { occupation: pop.distributions["occupation"]! } },
        registry,
      ),
    ).toThrow(/has no distribution/);
  });

  it("rejects categorical distributions without weights and bad constraints", () => {
    const pop = makePopulation();
    expect(() =>
      validatePopulationDefinition(
        {
          ...pop,
          distributions: {
            ...pop.distributions,
            occupation: { type: "categorical" } as never,
          },
        },
        registry,
      ),
    ).toThrow(/requires weights/);
    expect(() =>
      validatePopulationDefinition(
        {
          ...pop,
          constraints: [{ dimension: "age", allowedValues: ["old"] }],
        },
        registry,
      ),
    ).toThrow(/use min\/max/);
    expect(() =>
      validatePopulationDefinition(
        {
          ...pop,
          constraints: [
            { dimension: "authority_level", allowedValues: ["supreme"] },
          ],
        },
        registry,
      ),
    ).toThrow(/not an allowed value/);
  });

  it("implication conflicting with a hard constraint fails loudly", () => {
    const pop = makePopulation();
    pop.constraints = [
      { dimension: "authority_level", allowedValues: ["low", "medium"] },
    ];
    const implication = makeRule({
      type: "implication",
      effect: { value: "very_high" },
    });
    expect(() =>
      runSampler({
        population: pop,
        rules: [implication],
        registry,
        sampleSize: 30,
        strategy: "conditional",
        seed: 5,
      }),
    ).toThrow(/violates a hard constraint/);
  });

  it("conditional rule distributions still respect hard constraints", () => {
    const pop = makePopulation();
    pop.constraints = [
      { dimension: "authority_level", allowedValues: ["medium", "high"] },
    ];
    const out = runSampler({
      population: pop,
      rules: [makeRule({})],
      registry,
      sampleSize: 100,
      strategy: "conditional",
      seed: 6,
    });
    for (const s of out.samples) {
      expect(["medium", "high"]).toContain(s["authority_level"]);
    }
  });

  it("rejects invalid rule effects and enum values", () => {
    const dims = makePopulation().dimensions;
    expect(() =>
      validateDependencyRuleDefinition(
        {
          sourceDimension: "occupation",
          targetDimension: "authority_level",
          type: "implication",
          conditions: [{ equals: "manager" }],
          effect: { value: "supreme" },
        },
        dims,
        registry,
      ),
    ).toThrow(/not allowed/);
    expect(() =>
      validateDependencyRuleDefinition(
        {
          sourceDimension: "occupation",
          targetDimension: "occupation",
          type: "conditional",
          conditions: [{ equals: "x" }],
          effect: {},
        },
        dims,
        registry,
      ),
    ).toThrow(/must differ/);
    expect(() =>
      validateDependencyRuleDefinition(
        {
          sourceDimension: "occupation",
          targetDimension: "authority_level",
          type: "correlation",
          conditions: [{ equals: "manager" }],
          effect: {},
          strength: 0.5,
        },
        dims,
        registry,
      ),
    ).toThrow(/number dimensions/);
  });

  it("rejects type-invalid conditions that could never fire", () => {
    const dims = makePopulation().dimensions;
    const base = {
      sourceDimension: "age",
      targetDimension: "authority_level",
      type: "conditional",
      effect: {
        distribution: { type: "categorical", weights: { low: 1 } },
      },
    } as const;
    // implication values must match the target dimension type
    expect(() =>
      validateDependencyRuleDefinition(
        {
          sourceDimension: "occupation",
          targetDimension: "years_experience",
          type: "implication",
          conditions: [{ equals: "manager" }],
          effect: { value: "ten" },
        },
        dims,
        registry,
      ),
    ).toThrow(/finite number/);
    // string equals on a number source
    expect(() =>
      validateDependencyRuleDefinition(
        { ...base, conditions: [{ equals: "40" }] },
        dims,
        registry,
      ),
    ).toThrow(/must be a number/);
    // "in" on a number source
    expect(() =>
      validateDependencyRuleDefinition(
        { ...base, conditions: [{ in: ["40"] }] },
        dims,
        registry,
      ),
    ).toThrow(/not supported/);
    // unordered / non-finite numeric bounds
    expect(() =>
      validateDependencyRuleDefinition(
        { ...base, conditions: [{ min: 50, max: 30 }] },
        dims,
        registry,
      ),
    ).toThrow(/min <= max/);
    expect(() =>
      validateDependencyRuleDefinition(
        { ...base, conditions: [{ min: Number.NaN }] },
        dims,
        registry,
      ),
    ).toThrow(/finite/);
    // equal numeric bounds on a hard constraint are rejected (matches sampler)
    expect(() =>
      validatePopulationDefinition(
        {
          ...makePopulation(),
          constraints: [{ dimension: "age", min: 40, max: 40 }],
        },
        registry,
      ),
    ).toThrow(/min < max/);
  });

  it("correlation between numeric dimensions pulls target toward source", () => {
    const rule = makeRule({
      sourceDimension: "age",
      targetDimension: "years_experience",
      type: "correlation",
      conditions: [{ min: 25 }],
      effect: {},
      strength: 0.9,
    });
    const out = runSampler({
      population: makePopulation(),
      rules: [rule],
      registry,
      sampleSize: 200,
      strategy: "conditional",
      seed: 17,
    });
    // Older half should on average have more experience than younger half.
    const older = out.samples.filter((s) => (s["age"] as number) >= 45);
    const younger = out.samples.filter((s) => (s["age"] as number) <= 35);
    const avg = (xs: typeof older) =>
      xs.reduce((sum, s) => sum + (s["years_experience"] as number), 0) /
      xs.length;
    expect(avg(older)).toBeGreaterThan(avg(younger) + 3);
  });
});
