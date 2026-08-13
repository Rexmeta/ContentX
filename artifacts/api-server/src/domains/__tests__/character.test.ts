import { describe, it, expect } from "vitest";
import {
  validateCharacterAttributes,
  validateDerivedClassifications,
  InvalidCharacterError,
} from "../character/attributeValidator";
import {
  validateDimensionDefinition,
  InvalidDimensionError,
  DIMENSION_CATEGORIES,
  type Dimension,
} from "../population/dimensionModel";
import { SEED_DIMENSIONS } from "../population/seedDimensions";

function index(): Map<string, Dimension> {
  return new Map(
    SEED_DIMENSIONS.map((s, i) => [
      s.name,
      {
        id: `dimension_test${i}`,
        name: s.name,
        category: s.category,
        dataType: s.dataType,
        allowedValues: s.allowedValues ?? null,
        source: "seed",
        version: 1,
        description: s.description,
      },
    ]),
  );
}

describe("seed dimension set", () => {
  it("has ~50+ valid dimensions covering all 9 categories", () => {
    expect(SEED_DIMENSIONS.length).toBeGreaterThanOrEqual(50);
    const categories = new Set(SEED_DIMENSIONS.map((d) => d.category));
    for (const c of DIMENSION_CATEGORIES) expect(categories.has(c)).toBe(true);
    const names = new Set(SEED_DIMENSIONS.map((d) => d.name));
    expect(names.size).toBe(SEED_DIMENSIONS.length);
    for (const d of SEED_DIMENSIONS) {
      expect(() => validateDimensionDefinition(d)).not.toThrow();
    }
  });
});

describe("dimension definition validation", () => {
  it("rejects enum without allowedValues", () => {
    expect(() =>
      validateDimensionDefinition({ name: "mood", category: "psychological", dataType: "enum" }),
    ).toThrow(InvalidDimensionError);
  });
  it("rejects allowedValues on non-enum types", () => {
    expect(() =>
      validateDimensionDefinition({
        name: "height",
        category: "demographic",
        dataType: "number",
        allowedValues: ["tall"],
      }),
    ).toThrow(InvalidDimensionError);
  });
  it("rejects non-snake_case names and unknown categories", () => {
    expect(() =>
      validateDimensionDefinition({ name: "Bad Name", category: "demographic", dataType: "string" }),
    ).toThrow(InvalidDimensionError);
    expect(() =>
      validateDimensionDefinition({ name: "ok_name", category: "astral", dataType: "string" }),
    ).toThrow(InvalidDimensionError);
  });
});

describe("character attribute validation (dimension-based)", () => {
  it("accepts valid dimension-keyed attributes", () => {
    expect(() =>
      validateCharacterAttributes(
        {
          identity: { age: 42, gender: "female" },
          professional: { occupation: "sales manager", authority_level: "high" },
          psychological: { risk_tolerance: "low", core_values: ["integrity"] },
          behavioral: { conflict_style: "collaborating" },
          goals: ["hit quarterly target"],
          constraints: ["cannot exceed budget"],
        },
        index(),
      ),
    ).not.toThrow();
  });

  it("rejects unknown attribute groups and unregistered dimensions", () => {
    expect(() =>
      validateCharacterAttributes({ magic: { spell: "fire" } } as never, index()),
    ).toThrow(InvalidCharacterError);
    expect(() =>
      validateCharacterAttributes({ identity: { star_sign: "leo" } }, index()),
    ).toThrow(/not a registered dimension/);
  });

  it("rejects dimensions placed in a group their category does not belong to", () => {
    // conflict_style is behavioral; identity only allows demographic/social.
    expect(() =>
      validateCharacterAttributes(
        { identity: { conflict_style: "collaborating" } },
        index(),
      ),
    ).toThrow(/does not belong in group/);
  });

  it("enforces dataType and allowedValues", () => {
    expect(() =>
      validateCharacterAttributes({ identity: { age: "old" } }, index()),
    ).toThrow(/finite number/);
    expect(() =>
      validateCharacterAttributes({ behavioral: { conflict_style: "yelling" } }, index()),
    ).toThrow(/is not one of/);
    expect(() =>
      validateCharacterAttributes({ psychological: { core_values: ["ok", ""] } }, index()),
    ).toThrow(/non-empty strings/);
  });

  it("rejects MBTI as a core attribute but allows it as derived classification", () => {
    expect(() =>
      validateCharacterAttributes({ psychological: { mbti: "INTJ" } }, index()),
    ).toThrow(/derivedClassifications/);
    expect(() =>
      validateDerivedClassifications({ mbti: "INTJ" }),
    ).not.toThrow();
    expect(() => validateDerivedClassifications({ mbti: " " })).toThrow(
      InvalidCharacterError,
    );
  });

  it("rejects invalid goals/constraints lists", () => {
    expect(() =>
      validateCharacterAttributes({ goals: ["", "valid"] }, index()),
    ).toThrow(InvalidCharacterError);
  });
});
