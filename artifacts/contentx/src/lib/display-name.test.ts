import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_DISPLAY_LENGTH,
  formatDisplayName,
  isNameShortened,
} from "./display-name";

describe("formatDisplayName", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(formatDisplayName(null)).toBe("");
    expect(formatDisplayName(undefined)).toBe("");
    expect(formatDisplayName("")).toBe("");
  });

  describe("machine slugs", () => {
    it("collapses <word>-<timestamp>-<hash> to word·hash", () => {
      expect(formatDisplayName("vslice-1786683678021-py92x4")).toBe("vslice·py92x4");
    });

    it("shortens a slug embedded in a longer name", () => {
      expect(formatDisplayName("Negotiators vslice-1786683678021-py92x4 #10")).toBe(
        "Negotiators vslice·py92x4 #10",
      );
    });

    it("shortens multiple slugs in one name", () => {
      expect(
        formatDisplayName("a-1786683678021-abc vs b-1786683678022-def", 100),
      ).toBe("a·abc vs b·def");
    });

    it("is idempotent", () => {
      const once = formatDisplayName("Negotiators vslice-1786683678021-py92x4 #10");
      expect(formatDisplayName(once)).toBe(once);
    });
  });

  describe("UUIDs", () => {
    it("abbreviates a full UUID to its first 8 chars", () => {
      expect(formatDisplayName("Agent 123e4567-e89b-12d3-a456-426614174000")).toBe(
        "Agent 123e4567",
      );
    });

    it("handles uppercase UUIDs", () => {
      expect(formatDisplayName("Run 123E4567-E89B-12D3-A456-426614174000")).toBe(
        "Run 123E4567",
      );
    });
  });

  describe("human-authored names stay unchanged", () => {
    const humanNames = [
      "Mary-Jane Watson",
      "Jean-Claude Van Damme 3",
      "O'Brien",
      "김철수",
      "Agent 007",
      "Team Alpha-2",
      "Cohort 2026 Batch-01",
      // hyphen + digits, but not a 10+ digit timestamp
      "plan-2026-draft",
      "sprint-42-review",
      // short middle number: not a machine slug
      "abc-123456789-def",
    ];
    for (const name of humanNames) {
      it(`leaves "${name}" unchanged`, () => {
        expect(formatDisplayName(name)).toBe(name);
        expect(isNameShortened(name)).toBe(false);
      });
    }
  });

  describe("boundary cases for slug detection", () => {
    it("does shorten when middle segment is exactly 10 digits", () => {
      expect(formatDisplayName("job-1234567890-abc")).toBe("job·abc");
    });

    it("does not shorten when hash part is shorter than 3 chars", () => {
      expect(formatDisplayName("job-1234567890-ab")).toBe("job-1234567890-ab");
    });

    it("collapses whitespace and trims", () => {
      expect(formatDisplayName("  Alice   Bob  ")).toBe("Alice Bob");
    });
  });

  describe("maxLength ellipsis", () => {
    it("ellipsizes names longer than the default max", () => {
      const long = "A".repeat(50);
      const out = formatDisplayName(long);
      expect(out.length).toBeLessThanOrEqual(DEFAULT_MAX_DISPLAY_LENGTH);
      expect(out.endsWith("…")).toBe(true);
      expect(out).toBe("A".repeat(DEFAULT_MAX_DISPLAY_LENGTH - 1) + "…");
    });

    it("respects a custom maxLength", () => {
      expect(formatDisplayName("abcdefghij", 5)).toBe("abcd…");
    });

    it("does not ellipsize names at exactly maxLength", () => {
      const exact = "A".repeat(DEFAULT_MAX_DISPLAY_LENGTH);
      expect(formatDisplayName(exact)).toBe(exact);
    });

    it("trims trailing whitespace before adding the ellipsis", () => {
      const out = formatDisplayName("ABCD EFGH", 6);
      expect(out).toBe("ABCD…");
    });
  });
});

describe("isNameShortened", () => {
  it("is false for null/undefined/empty", () => {
    expect(isNameShortened(null)).toBe(false);
    expect(isNameShortened(undefined)).toBe(false);
    expect(isNameShortened("")).toBe(false);
  });

  it("is true when a machine slug was collapsed", () => {
    expect(isNameShortened("vslice-1786683678021-py92x4")).toBe(true);
  });

  it("is true when the name was ellipsized", () => {
    expect(isNameShortened("A".repeat(50))).toBe(true);
  });

  it("is true with a custom maxLength that forces truncation", () => {
    expect(isNameShortened("abcdefghij", 5)).toBe(true);
  });

  it("is false for a short human name", () => {
    expect(isNameShortened("Alice")).toBe(false);
  });
});
