import { describe, expect, it } from "vitest";
import { instantiateAssessmentTemplate } from "../templateInstantiator";
import { compileAssessmentScenarioPackage } from "../compiler";
import { validateAssessmentScenarioPackage } from "../validator";
import { AssessmentScenarioPackageV1Schema } from "../schema";

describe("templateInstantiator", () => {
  const templates = ["tmpl-ldr-01", "tmpl-ldr-02", "tmpl-com-01"];

  it.each(templates)(
    "successfully instantiates template %s and compiles into a valid AssessmentScenarioPackageV1",
    (templateId) => {
      const instantiated = instantiateAssessmentTemplate({
        templateId,
        companyContext: "반도체 패키징 생산기술팀",
        participantRole: "신임 파트장",
        situation: "주요 라인 수율 저하로 야근이 반복되는 상황",
      });

      expect(instantiated.template.id).toBe(templateId);
      expect(instantiated.title).toContain("반도체 패키징 생산기술팀");
      expect(instantiated.compilationInput.competencies.length).toBeGreaterThan(0);
      expect(instantiated.compilationInput.scenarios.length).toBe(1);

      // Compile through canonical compiler
      const compileResult = compileAssessmentScenarioPackage(instantiated.compilationInput);
      expect(compileResult.diagnostics).toEqual([]);
      expect(compileResult.package).toBeDefined();

      const pkg = compileResult.package!;
      expect(pkg.schemaVersion).toBe("1.0");
      expect(pkg.provenance.source).toBe("ContentX");
      expect(pkg.provenance.contentHash).toMatch(/^[a-f0-9]{64}$/);

      // Schema validation
      const parseResult = AssessmentScenarioPackageV1Schema.safeParse(pkg);
      expect(parseResult.success).toBe(true);

      // Semantic validation
      const validationResult = validateAssessmentScenarioPackage(pkg);
      expect(validationResult.diagnostics).toEqual([]);
      expect(validationResult.valid).toBe(true);

      // Verify scenario details
      const scenario = pkg.scenarios[0]!;
      expect(scenario.context.playerRole).toBe("신임 파트장");
      expect(scenario.context.situation).toContain("반도체 패키징 생산기술팀");
      expect(scenario.personas[0]!.isPrimary).toBe(true);
      expect(scenario.recommendedFlow.length).toBeGreaterThan(0);

      // Dimension weights sum to 1.0
      const totalWeight = scenario.evaluation.dimensions.reduce((sum, d) => sum + d.weight, 0);
      expect(Math.abs(totalWeight - 1.0)).toBeLessThan(1e-6);
    }
  );

  it("supports character name and role overrides", () => {
    const instantiated = instantiateAssessmentTemplate({
      templateId: "tmpl-ldr-01",
      companyContext: "AI 연구소",
      participantRole: "랩장",
      counterpartName: "홍길동",
      counterpartRole: "수석 연구원",
    });

    const scenario = instantiated.compilationInput.scenarios[0]!;
    expect(scenario.dramaticScenario.characters[0]!.name).toBe("홍길동");
    expect(scenario.dramaticScenario.characters[0]!.role).toBe("수석 연구원");

    const compileResult = compileAssessmentScenarioPackage(instantiated.compilationInput);
    expect(compileResult.diagnostics).toEqual([]);
    expect(compileResult.package?.scenarios[0]?.personas[0]?.name).toBe("홍길동");
    expect(compileResult.package?.scenarios[0]?.personas[0]?.isPrimary).toBe(true);

    const validation = validateAssessmentScenarioPackage(compileResult.package);
    expect(validation.valid).toBe(true);
  });

  it("throws a descriptive error when template is unknown", () => {
    expect(() =>
      instantiateAssessmentTemplate({
        templateId: "unknown-template",
        companyContext: "어떤 회사",
      })
    ).toThrow('Assessment template not found: "unknown-template".');
  });

  it("throws when companyContext is empty", () => {
    expect(() =>
      instantiateAssessmentTemplate({
        templateId: "tmpl-ldr-01",
        companyContext: "   ",
      })
    ).toThrow("companyContext is required");
  });
});

