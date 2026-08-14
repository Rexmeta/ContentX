/**
 * Pure derivation tests for the MatrAIx import → Population bridge:
 * dataset → canonical graph (existing importer) → BridgePopulationPlan.
 */
import { describe, it, expect } from "vitest";
import { mapMatraixToCanonical } from "../import/matraixImporter";
import { matraixDatasetSchema } from "../import/matraixModel";
import {
  deriveBridgePlans,
  ImportBridgeError,
} from "../import/populationBridge";

function graphFor(dataset: unknown) {
  const parsed = matraixDatasetSchema.parse(dataset);
  return mapMatraixToCanonical(parsed, () => "2026-08-14T00:00:00.000Z")
    .payload;
}

const baseDataset = {
  schemaVersion: "matraix/1.0",
  source: { uri: "matraix://exports/bridge-unit", title: "Bridge unit" },
  populations: [
    {
      id: "pop.negotiators",
      name: "Negotiators",
      dimensions: [
        { id: "dim.age", name: "vs_age", category: "demographic", dataType: "number" },
        {
          id: "dim.occ",
          name: "vs_occupation",
          category: "professional",
          dataType: "enum",
          allowedValues: ["shop_owner", "marketing_manager", "engineer"],
        },
        {
          id: "dim.risk",
          name: "vs_risk_tolerance",
          category: "psychological",
          dataType: "enum",
          allowedValues: ["low", "medium", "high"],
        },
      ],
    },
  ],
  personas: [
    {
      id: "p.a",
      name: "Kim Jiyoung",
      populationId: "pop.negotiators",
      attributes: { vs_age: 38, vs_occupation: "marketing_manager", vs_risk_tolerance: "low" },
    },
    {
      id: "p.b",
      name: "Park Minsu",
      populationId: "pop.negotiators",
      attributes: { vs_age: 45, vs_occupation: "shop_owner", vs_risk_tolerance: "medium" },
    },
    {
      id: "p.c",
      name: "Lee Seojun",
      populationId: "pop.negotiators",
      attributes: { vs_age: 31, vs_occupation: "engineer", vs_risk_tolerance: "low" },
    },
    {
      id: "p.d",
      name: "Choi Haeun",
      populationId: "pop.negotiators",
      attributes: { vs_age: 42, vs_occupation: "shop_owner", vs_risk_tolerance: "medium" },
    },
  ],
};

describe("deriveBridgePlans", () => {
  it("derives dimensions, distributions, and provenance references from an import graph", () => {
    const plans = deriveBridgePlans(graphFor(baseDataset));
    expect(plans).toHaveLength(1);
    const plan = plans[0]!;

    expect(plan.matraixId).toBe("pop.negotiators");
    expect(plan.name).toBe("Negotiators");
    expect(plan.memberCount).toBe(4);
    expect(plan.dimensions.map((d) => d.name)).toEqual([
      "vs_age",
      "vs_occupation",
      "vs_risk_tolerance",
    ]);

    // Numeric dimension → uniform over the observed range, integer flagged.
    expect(plan.distributions["vs_age"]).toEqual({
      type: "uniform",
      min: 31,
      max: 45,
      integer: true,
    });

    // Categorical dimension → normalized frequency weights.
    expect(plan.distributions["vs_occupation"]).toEqual({
      type: "categorical",
      weights: {
        engineer: 0.25,
        marketing_manager: 0.25,
        shop_owner: 0.5,
      },
    });
    const risk = plan.distributions["vs_risk_tolerance"];
    expect(risk).toEqual({
      type: "categorical",
      weights: { low: 0.5, medium: 0.5 },
    });
  });

  it("derives implication dependency rules from functional co-occurrence", () => {
    const plan = deriveBridgePlans(graphFor(baseDataset))[0]!;
    // occupation → risk_tolerance is functional (each occupation maps to
    // one risk level); the reverse is not (low ← {marketing_manager,
    // engineer}). Exactly one direction must be derived.
    expect(plan.rules).toEqual([
      {
        sourceDimension: "vs_occupation",
        targetDimension: "vs_risk_tolerance",
        type: "implication",
        conditions: [{ equals: "engineer" }],
        effect: { value: "low" },
      },
      {
        sourceDimension: "vs_occupation",
        targetDimension: "vs_risk_tolerance",
        type: "implication",
        conditions: [{ equals: "marketing_manager" }],
        effect: { value: "low" },
      },
      {
        sourceDimension: "vs_occupation",
        targetDimension: "vs_risk_tolerance",
        type: "implication",
        conditions: [{ equals: "shop_owner" }],
        effect: { value: "medium" },
      },
    ]);
  });

  it("pads a degenerate numeric range so the distribution stays valid", () => {
    const dataset = structuredClone(baseDataset);
    for (const p of dataset.personas) p.attributes.vs_age = 40;
    const plan = deriveBridgePlans(graphFor(dataset))[0]!;
    expect(plan.distributions["vs_age"]).toEqual({
      type: "uniform",
      min: 39,
      max: 41,
      integer: true,
    });
  });

  it("derives enum allowedValues from observed member values when undeclared", () => {
    const dataset = structuredClone(baseDataset);
    const dims = dataset.populations[0]!.dimensions as {
      name: string;
      allowedValues?: unknown;
    }[];
    delete dims.find((d) => d.name === "vs_risk_tolerance")!.allowedValues;
    const plan = deriveBridgePlans(graphFor(dataset))[0]!;
    const dim = plan.dimensions.find((d) => d.name === "vs_risk_tolerance")!;
    expect(dim.allowedValues).toEqual(["low", "medium"]);
  });

  it("fails loudly when the graph has no MatrAIx populations", () => {
    expect(() =>
      deriveBridgePlans({ entities: [], relationships: [] }),
    ).toThrow(ImportBridgeError);
  });

  it("fails loudly when a population has no member personas", () => {
    const dataset = structuredClone(baseDataset);
    for (const p of dataset.personas) delete (p as { populationId?: string }).populationId;
    expect(() => deriveBridgePlans(graphFor(dataset))).toThrow(
      /no member personas/,
    );
  });

  it("fails loudly when a member value is outside declared enum values", () => {
    const dataset = structuredClone(baseDataset);
    dataset.personas[0]!.attributes.vs_occupation = "astronaut";
    expect(() => deriveBridgePlans(graphFor(dataset))).toThrow(
      /not in its allowed values/,
    );
  });

  it("fails loudly when a numeric dimension has no observed values", () => {
    const dataset = structuredClone(baseDataset);
    for (const p of dataset.personas) delete (p.attributes as { vs_age?: number }).vs_age;
    expect(() => deriveBridgePlans(graphFor(dataset))).toThrow(
      ImportBridgeError,
    );
  });
});
