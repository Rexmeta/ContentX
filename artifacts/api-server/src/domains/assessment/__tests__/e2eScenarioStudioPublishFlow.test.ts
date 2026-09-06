import { describe, expect, it, vi, beforeEach } from "vitest";
import { getScenarioTemplate } from "../scenarioTemplateCatalog";
import { instantiateAssessmentTemplate } from "../templateInstantiator";
import { compileAssessmentScenarioPackage } from "../compiler";
import { validateAssessmentScenarioPackage } from "../validator";
import { createRoleplayXClient } from "../roleplayxClient";
import { AssessmentScenarioPackageV1Schema } from "../schema";

describe("E2E Business Flow: Assessment Scenario Studio to RoleplayX Publish", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("completes the full business lifecycle: Template selection -> Company context -> Draft compilation -> Semantic validation -> RoleplayX publish", async () => {
    // 1. Step 1: HR selects "성과 부진 팀원 면담" (tmpl-ldr-01)
    const template = getScenarioTemplate("tmpl-ldr-01");
    expect(template).toBeDefined();
    expect(template!.title).toBe("성과 부진 팀원 면담");
    expect(template!.category).toBe("leadership");

    // 2. Step 2: HR inputs company context & participant role
    const companyContext = "반도체 패키징 생산기술팀";
    const participantRole = "신임 파트장";
    const situation = "양산 수율 저하로 야근이 반복되며 담당 팀원의 업무 몰입도가 급격히 떨어진 상황";

    const instantiated = instantiateAssessmentTemplate({
      templateId: template!.id,
      companyContext,
      participantRole,
      situation,
    });

    expect(instantiated.title).toContain("반도체 패키징 생산기술팀");
    expect(instantiated.dramaticScenario.characters[0]!.name).toBe("이민혁");
    expect(instantiated.dramaticScenario.synopsis).toContain(companyContext);
    expect(instantiated.configuration.playerRole).toBe(participantRole);

    // 3. Step 3: Compilation into canonical AssessmentScenarioPackageV1
    const compileResult = compileAssessmentScenarioPackage(instantiated.compilationInput);
    expect(compileResult.diagnostics).toEqual([]);
    expect(compileResult.package).toBeDefined();

    const pkg = compileResult.package!;
    expect(pkg.schemaVersion).toBe("1.0");
    expect(pkg.provenance.source).toBe("ContentX");
    expect(pkg.provenance.contentHash).toMatch(/^[a-f0-9]{64}$/);

    // 4. Step 4: Schema validation & Semantic validation
    const schemaValidation = AssessmentScenarioPackageV1Schema.safeParse(pkg);
    expect(schemaValidation.success).toBe(true);

    const semanticValidation = validateAssessmentScenarioPackage(pkg);
    expect(semanticValidation.valid).toBe(true);
    expect(semanticValidation.diagnostics).toEqual([]);

    // Verify evaluation rubrics are valid and weights total 1.0
    const scenario = pkg.scenarios[0]!;
    const totalWeight = scenario.evaluation.dimensions.reduce((sum, d) => sum + d.weight, 0);
    expect(Math.abs(totalWeight - 1.0)).toBeLessThan(1e-6);
    expect(scenario.evaluation.dimensions.length).toBe(4);

    // 5. Step 5: RoleplayX Validation & Direct Publish
    const client = createRoleplayXClient({
      baseUrl: "https://roleplayx.example.com",
      apiKey: "test-service-token",
    });

    // Mock RoleplayX remote endpoints
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          valid: true,
          accepted: true,
          diagnostics: [],
          schemaVersion: "1.0",
          scenarioCount: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          importId: "rpx-pkg-12345",
          accepted: true,
          scenarioCount: 1,
          roleplayXUrl: "https://roleplayx.example.com/assessments/rpx-pkg-12345",
        }),
      });

    // Step 5a: Target pre-validation
    const preflight = await client.validatePackage(pkg as unknown as Record<string, unknown>, "idemp-validate-001");
    expect(preflight.valid).toBe(true);

    // Step 5b: Remote import into RoleplayX runtime
    const importResult = await client.importPackage(pkg as unknown as Record<string, unknown>, "idemp-import-001");
    expect(importResult.importId).toBe("rpx-pkg-12345");
    expect(importResult.accepted).toBe(true);

    // Verify remote request payload preserves strict schemaVersion: "1.0"
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const importRequestBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(importRequestBody.schemaVersion).toBe("1.0");
    expect(importRequestBody.provenance.contentHash).toBe(pkg.provenance.contentHash);
    expect(fetchMock.mock.calls[1][1].headers["idempotency-key"]).toBe("idemp-import-001");
  });
});
