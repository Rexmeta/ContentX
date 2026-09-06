import { describe, expect, it } from "vitest";
import { listScenarioTemplates, getScenarioTemplate } from "../scenarioTemplateCatalog";

describe("scenarioTemplateCatalog", () => {
  it("provides exactly 3 core MVP templates with valid metadata", () => {
    const templates = listScenarioTemplates();
    expect(templates.length).toBe(3);

    const ids = templates.map((t) => t.id);
    expect(ids).toEqual(["tmpl-ldr-01", "tmpl-ldr-02", "tmpl-com-01"]);
  });

  it("ensures each template has valid evaluation dimensions whose weights sum to 1.0", () => {
    const templates = listScenarioTemplates();
    for (const template of templates) {
      expect(template.title.length).toBeGreaterThan(0);
      expect(template.dramatic.acts.length).toBeGreaterThanOrEqual(1);
      expect(template.dramatic.characters.length).toBeGreaterThanOrEqual(1);
      expect(template.competencies.length).toBeGreaterThanOrEqual(1);

      const totalWeight = template.evaluation.dimensions.reduce((sum, dim) => sum + dim.weight, 0);
      expect(Math.abs(totalWeight - 1.0)).toBeLessThan(1e-6);

      // Verify each dimension has criteria
      for (const dim of template.evaluation.dimensions) {
        expect(dim.criteria.length).toBeGreaterThanOrEqual(1);
      }

      // Verify turn limits
      expect(template.termination.minValidTurns).toBeLessThanOrEqual(template.termination.targetTurns);
      expect(template.termination.targetTurns).toBeLessThanOrEqual(template.termination.maxTurns);
    }
  });

  it("retrieves template by ID or returns undefined for unknown ID", () => {
    expect(getScenarioTemplate("tmpl-ldr-01")?.title).toBe("성과 부진 팀원 면담");
    expect(getScenarioTemplate("tmpl-ldr-02")?.title).toBe("부서 간 갈등 해결");
    expect(getScenarioTemplate("tmpl-com-01")?.title).toBe("어려운 피드백 전달");
    expect(getScenarioTemplate("non-existent")).toBeUndefined();
  });
});

