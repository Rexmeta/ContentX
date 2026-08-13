import { describe, it, expect } from "vitest";
import { amplifyIdea } from "../ai/mockAmplifier";
import { mockClassifier, ClassificationError } from "../scenario/classifier";
import {
  SEED_CATEGORIES,
  CATEGORY_AXES,
  type Classification,
} from "../scenario/taxonomy";

describe("scenario classification", () => {
  it("mock classifier returns a valid classification from existing categories", async () => {
    const scenario = amplifyIdea("동네 빵집과 프랜차이즈의 갈등");
    const c = await mockClassifier(scenario, SEED_CATEGORIES);
    expect(SEED_CATEGORIES.domain).toContain(c.domain);
    expect(SEED_CATEGORIES.conflictType).toContain(c.conflictType);
    expect(SEED_CATEGORIES.tone).toContain(c.tone);
    expect(c.tags.length).toBeGreaterThan(0);
    expect(c.classifiedBy).toBeTruthy();
  });

  it("seed taxonomy covers all three axes with non-empty category lists", () => {
    for (const axis of CATEGORY_AXES) {
      expect(SEED_CATEGORIES[axis].length).toBeGreaterThan(0);
      // No duplicate names within an axis
      expect(new Set(SEED_CATEGORIES[axis]).size).toBe(
        SEED_CATEGORIES[axis].length,
      );
    }
  });

  it("similarity rule: shared domain or conflictType clusters scenarios", () => {
    const base: Classification = {
      domain: "직장",
      conflictType: "배신",
      tone: "긴장감",
      tags: [],
    };
    const sameDomain: Classification = { ...base, conflictType: "경쟁" };
    const sameConflict: Classification = { ...base, domain: "가족" };
    const unrelated: Classification = {
      domain: "의료",
      conflictType: "생존",
      tone: "비극적",
      tags: [],
    };
    const isSimilar = (c: Classification) =>
      c.domain === base.domain || c.conflictType === base.conflictType;
    expect(isSimilar(sameDomain)).toBe(true);
    expect(isSimilar(sameConflict)).toBe(true);
    expect(isSimilar(unrelated)).toBe(false);
  });

  it("ClassificationError is a distinct error type", () => {
    const err = new ClassificationError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("boom");
  });
});
