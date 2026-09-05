import { describe, expect, it, vi } from "vitest";
import { RoleplayXClientError } from "../roleplayxClient";
import { createAssessmentPublishingService, type AssessmentPublishingDependencies } from "../service";
import { compileAssessmentScenarioPackage, assessmentElementKey } from "../compiler";
import type { AssessmentCompilationInput } from "../model";

const input = { packageId: "pkg", version: 1, organizationId: "org", category: "hiring" };

function dependencies(): AssessmentPublishingDependencies {
  return {
    loadVersion: vi.fn().mockResolvedValue({ ...input, payload: { packageVersion: 1 }, hash: "hash", status: "draft" }),
    findSuccessfulPublication: vi.fn().mockResolvedValue(undefined),
    beginPublication: vi.fn().mockResolvedValue("acquired"),
    recordAttempt: vi.fn().mockResolvedValue(undefined),
    markPublished: vi.fn().mockResolvedValue(undefined),
    validateLocal: vi.fn().mockResolvedValue([]),
    roleplayX: {
      validate: vi.fn().mockResolvedValue({ valid: true }),
      import: vi.fn().mockResolvedValue({ accepted: true, importId: "remote-1" }),
      validatePackage: vi.fn().mockResolvedValue({ valid: true }),
      importPackage: vi.fn().mockResolvedValue({ accepted: true, importId: "remote-1" }),
    },
  };
}

function compilerInput(): AssessmentCompilationInput {
  return {
    packageKey: "compiler-to-roleplayx", version: "1", publishedAt: "2026-01-01T00:00:00.000Z",
    sourcePackageId: "source-package", author: "assessment-test",
    metadata: { title: "Compiler integration", description: "Compiled before publishing", locale: "en-US", tags: ["test"] },
    competencies: [{ key: "empathy", name: "Empathy" }],
    scenarios: [{
      dramaticScenario: {
        title: "Customer call", logline: "A support conversation", synopsis: "A customer needs help.",
        theme: "Trust", stakes: "The customer may leave.", twist: "The order is delayed.",
        acts: [{ name: "Open", summary: "Understand the concern.", beats: ["Greet the customer"] }],
        characters: [{ name: "Customer", role: "customer", motivation: "Needs an answer" }],
      },
      configuration: {
        scenarioKey: "customer-call", locale: "en-US", categoryKey: "support", competencyKeys: ["empathy"],
        difficulty: "beginner", estimatedTime: 10, objectiveType: "conversation", timeline: "During the call",
        playerRole: "Support representative", objectives: ["Understand the concern"], successCriteria: ["Acknowledge the impact"],
        primaryPersonaKey: assessmentElementKey("Customer", 0), personaSwitchMode: "disabled",
        difficultyProfile: { level: "beginner" },
        evaluation: { dimensions: [{ key: "empathy", label: "Empathy", weight: 1, criteria: ["Acknowledges concern"] }] },
        termination: { conditions: ["Customer has been helped"], maxTurns: 12 }, simulation: { mode: "roleplay" },
        analytics: { eventTypes: ["turn"], trackPersonaSwitches: false },
        targetDurationMinutes: 10, targetTurns: 10, minValidTurns: 2,
      },
    }],
  };
}

describe("assessment publishing service", () => {
  it("publishes a compiler-produced package through mocked RoleplayX and records success", async () => {
    const compiled = compileAssessmentScenarioPackage(compilerInput());
    expect(compiled.diagnostics).toEqual([]);
    const payload = compiled.package!;
    const deps = dependencies();
    (deps.loadVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...input,
      payload,
      hash: payload.provenance.contentHash,
      status: "draft",
    });

    const result = await createAssessmentPublishingService(deps).publish(input);

    expect(result).toMatchObject({ status: "published", reused: false });
    expect(deps.roleplayX.validate).toHaveBeenCalledWith(payload, result.idempotencyKey);
    expect(deps.roleplayX.import).toHaveBeenCalledWith(payload, result.idempotencyKey);
    expect(deps.recordAttempt).toHaveBeenCalledWith(expect.objectContaining({
      stage: "remote_validation", outcome: "succeeded",
    }));
    expect(deps.recordAttempt).toHaveBeenCalledWith(expect.objectContaining({
      stage: "import", outcome: "succeeded", remoteResponse: { accepted: true, importId: "remote-1" },
    }));
  });

  it("validates locally, remotely, imports, records stages, then publishes", async () => {
    const deps = dependencies();
    const result = await createAssessmentPublishingService(deps).publish(input);

    expect(result).toMatchObject({ status: "published", reused: false });
    expect(deps.roleplayX.validate).toHaveBeenCalledBefore(deps.roleplayX.import as ReturnType<typeof vi.fn>);
    expect(deps.markPublished).toHaveBeenCalledWith(input);
    expect(deps.recordAttempt).toHaveBeenCalledWith(expect.objectContaining({ stage: "remote_validation", outcome: "started" }));
    expect(deps.recordAttempt).toHaveBeenCalledWith(expect.objectContaining({ stage: "import", outcome: "succeeded" }));
  });

  it("does not make remote calls or publish when local validation fails", async () => {
    const deps = dependencies();
    (deps.validateLocal as ReturnType<typeof vi.fn>).mockResolvedValue([{ path: "/name", code: "required", severity: "error", message: "required" }]);

    await expect(createAssessmentPublishingService(deps).publish(input)).resolves.toMatchObject({ status: "failed", errorCategory: "validation" });
    expect(deps.roleplayX.validate).not.toHaveBeenCalled();
    expect(deps.markPublished).not.toHaveBeenCalled();
  });

  it("never imports or publishes after remote validation rejects", async () => {
    const deps = dependencies();
    (deps.roleplayX.validate as ReturnType<typeof vi.fn>).mockResolvedValue({ valid: false, errors: ["invalid persona"] });

    await expect(createAssessmentPublishingService(deps).publish(input)).resolves.toMatchObject({ status: "failed" });
    expect(deps.roleplayX.import).not.toHaveBeenCalled();
    expect(deps.markPublished).not.toHaveBeenCalled();
  });

  it("reuses an existing successful target publication", async () => {
    const deps = dependencies();
    (deps.findSuccessfulPublication as ReturnType<typeof vi.fn>).mockResolvedValue({ ...input, idempotencyKey: "old", stage: "import", outcome: "succeeded" });

    await expect(createAssessmentPublishingService(deps).publish(input)).resolves.toMatchObject({ status: "published", reused: true });
    expect(deps.loadVersion).not.toHaveBeenCalled();
    expect(deps.roleplayX.import).not.toHaveBeenCalled();
  });

  it("does not call RoleplayX when the same target is already in progress", async () => {
    const deps = dependencies();
    (deps.beginPublication as ReturnType<typeof vi.fn>).mockResolvedValue(
      "in_progress",
    );

    await expect(
      createAssessmentPublishingService(deps).publish(input),
    ).resolves.toMatchObject({ status: "failed", errorCategory: "conflict" });
    expect(deps.roleplayX.validate).not.toHaveBeenCalled();
    expect(deps.roleplayX.import).not.toHaveBeenCalled();
  });

  it("records remote categories and leaves package unpublished on an import error", async () => {
    const deps = dependencies();
    (deps.roleplayX.import as ReturnType<typeof vi.fn>).mockRejectedValue(new RoleplayXClientError("timeout", "slow"));

    await expect(createAssessmentPublishingService(deps).publish(input)).resolves.toMatchObject({ status: "failed", errorCategory: "timeout" });
    expect(deps.markPublished).not.toHaveBeenCalled();
    expect(deps.recordAttempt).toHaveBeenCalledWith(expect.objectContaining({ stage: "import", outcome: "failed", errorCategory: "timeout" }));
  });
});