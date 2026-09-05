import { describe, expect, it } from "vitest";
import { compileAssessmentScenarioPackage, assessmentElementKey } from "../compiler";
import { calculateAssessmentPackageHash, canonicalizeJson } from "../hash";
import { AssessmentScenarioPackageV1Schema } from "../schema";
import { validateAssessmentScenarioPackage } from "../validator";
import type { AssessmentCompilationInput } from "../model";

function input(): AssessmentCompilationInput {
  return {
    packageKey: "customer-conversation", version: "1", publishedAt: "2026-01-01T00:00:00.000Z",
    sourcePackageId: "pkg-1", author: "author-1",
    metadata: { title: "Customer conversation", description: "Practice package", locale: "en-US", tags: ["support"] },
    competencies: [{ key: "empathy", name: "Empathy" }],
    scenarios: [{
      dramaticScenario: {
        title: "Delayed shipment", logline: "A difficult call", synopsis: "A customer calls about a delayed shipment.",
        theme: "Trust", stakes: "The customer may cancel.", twist: "The item was misplaced.",
        acts: [{ name: "Open", summary: "Understand the concern.", beats: ["Greet the customer"] }],
        characters: [{ name: "Customer", role: "customer", motivation: "Needs the item urgently" }],
      },
      configuration: {
        scenarioKey: "delayed-shipment", locale: "en-US", categoryKey: "support", competencyKeys: ["empathy"],
        difficulty: "beginner", estimatedTime: 10, objectiveType: "conversation", timeline: "During the support call",
        playerRole: "Support representative", objectives: ["Understand the concern"], successCriteria: ["Acknowledge the impact"],
        primaryPersonaKey: assessmentElementKey("Customer", 0), personaSwitchMode: "disabled",
        difficultyProfile: { level: "beginner" }, evaluation: { dimensions: [{ key: "empathy", label: "Empathy", weight: 1, criteria: ["Acknowledges the concern"] }] },
        termination: { conditions: ["Customer has been helped"], maxTurns: 12 }, simulation: { mode: "roleplay" },
        analytics: { eventTypes: ["turn"], trackPersonaSwitches: false }, targetDurationMinutes: 10, targetTurns: 10, minValidTurns: 2,
      },
    }],
  };
}

describe("assessment package compiler", () => {
  it("maps a scenario deterministically and produces a strict package", () => {
    const result = compileAssessmentScenarioPackage(input());
    expect(result.diagnostics).toEqual([]);
    expect(result.package).toBeDefined();
    expect(AssessmentScenarioPackageV1Schema.safeParse(result.package).success).toBe(true);
    expect(result.package!.scenarios[0]!.context.situation).toBe("A customer calls about a delayed shipment.");
    expect(result.package!.scenarios[0]!.personas[0]!.isPrimary).toBe(true);
    expect(result.package!.scenarios[0]!.recommendedFlow).toEqual(["open-1"]);
    expect(compileAssessmentScenarioPackage(input()).package).toEqual(result.package);
  });

  it("returns a structured diagnostic instead of inventing missing configuration", () => {
    const source = input();
    delete source.scenarios[0]!.configuration.playerRole;
    const result = compileAssessmentScenarioPackage(source);
    expect(result.package).toBeUndefined();
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "MISSING_PLAYER_ROLE", severity: "error" }));
  });

  it("validates semantic persona, flow and evaluation references", () => {
    const result = compileAssessmentScenarioPackage(input()).package!;
    result.scenarios[0]!.evaluation.dimensions[0]!.weight = 0.4;
    result.scenarios[0]!.recommendedFlow = ["missing"];
    result.scenarios[0]!.personas[0]!.isPrimary = false;
    const validation = validateAssessmentScenarioPackage(result);
    expect(validation.valid).toBe(false);
    expect(validation.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
      "INVALID_EVALUATION_WEIGHT", "INVALID_FLOW", "INVALID_PRIMARY_PERSONA",
    ]));
  });
});

describe("assessment package hashing", () => {
  it("sorts object keys recursively, excludes supplied hash, and changes for content", () => {
    expect(canonicalizeJson({ z: { b: 1, a: 2 }, a: [2, 1] })).toBe('{"a":[2,1],"z":{"a":2,"b":1}}');
    const packageValue = compileAssessmentScenarioPackage(input()).package!;
    const sameWithUntrustedHash = { ...packageValue, provenance: { ...packageValue.provenance, contentHash: "f".repeat(64) } };
    expect(calculateAssessmentPackageHash(packageValue)).toBe(calculateAssessmentPackageHash(sameWithUntrustedHash));
    const changed = { ...packageValue, metadata: { ...packageValue.metadata, title: "Changed" } };
    expect(calculateAssessmentPackageHash(packageValue)).not.toBe(calculateAssessmentPackageHash(changed));
  });
});