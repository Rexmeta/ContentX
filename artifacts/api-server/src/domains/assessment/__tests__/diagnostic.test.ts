import { describe, expect, it } from "vitest";
import { diagnosticSample } from "../diagnosticSample";
import { diagnosticHash, diagnosticSchema, exportDiagnostic, parseDiagnostic, projectParticipant } from "../diagnostic";
import { validateAssessmentScenarioPackage } from "../validator";
import { AssessmentScenarioPackageV1Schema } from "../schema";

const fixture = () => diagnosticSample("diagnostic-test", "test-author");
describe("diagnostic authoring and safe projections", () => {
  it("retains strict v1 separately and exports every diagnostic ID, condition and criterion connection", () => {
    const { package: pkg, diagnostic } = fixture();
    expect(validateAssessmentScenarioPackage(pkg).valid).toBe(true);
    expect(AssessmentScenarioPackageV1Schema.safeParse({ ...pkg, diagnostic }).success).toBe(false);
    const value = exportDiagnostic(pkg, diagnostic);
    expect(value.diagnostic).toEqual(diagnostic);
    expect(value.schemaVersion).toBe("contentx.diagnostic-export.v1");
    expect(value.runtimeResults).toBeNull();
    expect(value.receiverStatus).toBe("mapping_required_not_runtime_verified");
    expect(value.rules.join(" ")).toContain("no_observation_opportunity");
    expect(value.rules.join(" ")).toContain("not_observed");
    expect(value.rules.join(" ")).toContain("sufficient questioning opportunity");
    expect(value.diagnostic.scenarios[0]!.cues[1]!.fallbackCondition).toContain("6번째");
    expect(diagnosticHash(diagnostic)).toMatch(/^[a-f0-9]{64}$/);
  });
  it("allows short and long briefings and preparation times beyond pilot recommendations", () => {
    const { package: pkg, diagnostic } = fixture();
    diagnostic.scenarios[0]!.briefing.reason = "가".repeat(2000);
    diagnostic.scenarios[0]!.briefing.preparationSeconds = 300;
    expect(parseDiagnostic(diagnostic, pkg)).toEqual(diagnostic);
    diagnostic.scenarios[0]!.briefing.reason = "짧음";
    diagnostic.scenarios[0]!.briefing.preparationSeconds = 15;
    expect(parseDiagnostic(diagnostic, pkg)).toEqual(diagnostic);
  });
  it("rejects duplicate IDs, missing semantic intent, missing common trigger and dangling references", () => {
    const { diagnostic } = fixture();
    const mutate = (fn: (d: typeof diagnostic) => void) => { const d = structuredClone(diagnostic); fn(d); return diagnosticSchema.safeParse(d).success; };
    expect(mutate((d) => { d.scenarios[0]!.cues[0]!.id = d.scenarios[0]!.materials[0]!.id; })).toBe(false);
    expect(mutate((d) => { d.scenarios[0]!.cues[0]!.intent = ""; })).toBe(false);
    expect(mutate((d) => { d.scenarios[0]!.cues[1]!.condition = ""; })).toBe(false);
    expect(mutate((d) => { d.scenarios[0]!.cues[0]!.criterionIds = ["absent"]; })).toBe(false);
    expect(mutate((d) => { d.scenarios.push({ ...structuredClone(d.scenarios[0]!), scenarioKey: "another-scenario" }); })).toBe(false);
    const { package: pkg } = fixture();
    const bad = structuredClone(diagnostic); bad.scenarios[0]!.criteria[0]!.dimensionKey = "absent";
    expect(() => parseDiagnostic(bad, pkg)).toThrow("existing evaluation dimension");
    bad.scenarios[0]!.scenarioKey = "absent";
    expect(() => parseDiagnostic(bad, pkg)).toThrow("Unknown scenario");
  });
  it("requires accessible media equivalents and rectangular semantic tables", () => {
    const { diagnostic } = fixture();
    const material = diagnostic.scenarios[0]!.materials[0]!;
    material.table!.rows[0]!.pop();
    expect(diagnosticSchema.safeParse(diagnostic).success).toBe(false);
    material.type = "image"; material.assetId = "asset-one"; material.table = undefined;
    material.altText = "";
    expect(diagnosticSchema.safeParse(diagnostic).success).toBe(false);
    material.altText = "실적표"; material.text = "";
    expect(diagnosticSchema.safeParse(diagnostic).success).toBe(false);
    material.text = "9월 목표 1억원·실적 8천만원";
    expect(diagnosticSchema.safeParse(diagnostic).success).toBe(true);
    material.type = "video"; material.transcript = "";
    expect(diagnosticSchema.safeParse(diagnostic).success).toBe(false);
    material.transcript = "영상 대본";
    expect(diagnosticSchema.safeParse(diagnostic).success).toBe(true);
  });
  it("projects a nested allowlist even if private fields are injected into public source objects", () => {
    const { diagnostic } = fixture();
    const s = diagnostic.scenarios[0]!;
    Object.assign(s.briefing, { internalPrompt: "SECRET" });
    Object.assign(s.materials[0]!, { private: "SECRET" });
    Object.assign(s.materials[0]!.table!, { originalAuthoring: "SECRET" });
    const value = projectParticipant(diagnostic, "preparation");
    const json = JSON.stringify(value);
    for (const key of ["SECRET", "private", "hiddenCauses", "internalIntent", "modelAnswer", "cues", "criteria", "personas", "simulation", "originalAuthoring", "internalPrompt"]) expect(json).not.toContain(key);
    expect(json).not.toContain("주요 고객 두 곳");
    expect(json).not.toContain("결과만 보고");
    expect(value.scenarios[0]!.materials[0]!.table!.columns).toEqual(["월", "목표", "실적", "달성률"]);
  });
  it("filters preparation, conversation-only and non-reopenable material without leaking hidden IDs", () => {
    const { diagnostic } = fixture();
    const s = diagnostic.scenarios[0]!, base = s.materials[0]!;
    s.materials = [
      { ...base, id: "prep-only", displayAt: "preparation", reopenDuringConversation: false },
      { ...base, id: "reopen-prep", displayAt: "preparation", reopenDuringConversation: true },
      { ...base, id: "conversation-only", displayAt: "conversation", reopenDuringConversation: false },
      { ...base, id: "both-not-reopenable", displayAt: "both", reopenDuringConversation: false },
    ];
    expect(projectParticipant(diagnostic, "preparation").scenarios[0]!.materials.map((m) => m.id)).toEqual(["prep-only", "reopen-prep", "both-not-reopenable"]);
    expect(projectParticipant(diagnostic, "conversation").scenarios[0]!.materials.map((m) => m.id)).toEqual(["reopen-prep", "conversation-only"]);
  });
});
