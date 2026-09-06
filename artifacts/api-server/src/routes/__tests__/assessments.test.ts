import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AssessmentPackageRow,
  AssessmentPackageVersionRow,
  AssessmentPublicationRow,
} from "@workspace/db";

vi.mock("../../domains/assessment/repository", () => ({
  listAssessmentPackageReadModels: vi.fn(),
  getAssessmentPackageReadModel: vi.fn(),
  createAssessmentPackage: vi.fn(),
  createAssessmentPackageVersion: vi.fn(),
}));

vi.mock("../../domains/scenario/repository", () => ({
  insertScenario: vi.fn(),
}));

vi.mock("../../domains/assessment/scenarioGenerator", () => ({
  AssessmentScenarioGenerationError: class AssessmentScenarioGenerationError extends Error {
    kind: "provider" | "validation";
    issues?: string[];
    constructor(kind: "provider" | "validation", message: string, issues?: string[]) {
      super(message); this.kind = kind; this.issues = issues;
    }
  },
  generateAssessmentScenario: vi.fn(async (input: any) => ({
    dramaticScenario: input.dramaticScenario,
    configuration: input.configuration,
  })),
}));

import * as assessmentRepository from "../../domains/assessment/repository";
import * as scenarioRepository from "../../domains/scenario/repository";
import { generateAssessmentScenario, AssessmentScenarioGenerationError } from "../../domains/assessment/scenarioGenerator";
import assessmentsRouter from "../assessments";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-02T00:00:00.000Z");

const assessmentPackage: AssessmentPackageRow = {
  id: "assessment-1",
  packageKey: "customer-support",
  title: "Customer support assessment",
  description: "Evaluate support conversations.",
  sourceType: "scenario-library",
  sourceId: "scenario-1",
  status: "draft",
  currentVersion: 1,
  createdAt,
  updatedAt,
};

const version: AssessmentPackageVersionRow = {
  id: "assessment-version-1",
  packageId: assessmentPackage.id,
  version: 1,
  // Deliberately present in storage: this is not an API read-model field.
  packageJson: { internal: "immutable RoleplayX payload" },
  contentHash: "a".repeat(64),
  validationReport: { valid: true, diagnostics: [] },
  createdBy: "author-1",
  createdAt,
};

const publication: AssessmentPublicationRow = {
  id: "publication-1",
  packageId: assessmentPackage.id,
  packageVersion: 1,
  target: "roleplayx",
  targetUrl: null,
  targetOrganizationId: "organization-1",
  targetCategoryId: "category-1",
  idempotencyKey: "key-1",
  requestId: null,
  attempt: 1,
  status: "succeeded",
  response: { importId: "remote-1" },
  errorCode: null,
  errorMessage: null,
  leaseOwnerToken: null,
  leaseExpiresAt: null,
  createdAt,
  completedAt: createdAt,
  publishedAt: createdAt,
  publishedBy: null,
};

const app = express();
app.use(express.json());
app.use("/api", assessmentsRouter);

const listAssessmentPackageReadModels = vi.mocked(
  assessmentRepository.listAssessmentPackageReadModels,
);
const getAssessmentPackageReadModel = vi.mocked(
  assessmentRepository.getAssessmentPackageReadModel,
);

describe("assessment read routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists package summaries without the internal immutable payload", async () => {
    listAssessmentPackageReadModels.mockResolvedValue([
      {
        assessmentPackage,
        scenarioCount: 2,
        competencyCount: 1,
        latestTarget: null,
        versions: [],
        publicationHistory: [],
      },
    ]);

    const response = await request(app).get("/api/v1/assessments").expect(200);

    expect(response.body).toEqual([
      {
        id: "assessment-1",
        packageKey: "customer-support",
        title: "Customer support assessment",
        description: "Evaluate support conversations.",
        sourceType: "scenario-library",
        sourceId: "scenario-1",
        status: "draft",
        currentVersion: 1,
        scenarioCount: 2,
        competencyCount: 1,
        latestTarget: null,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    ]);
    expect(response.body[0]).not.toHaveProperty("packageJson");
  });

  it("returns package detail aggregated from versions and publication history", async () => {
    getAssessmentPackageReadModel.mockResolvedValue({
      assessmentPackage,
      scenarioCount: 2,
      competencyCount: 1,
      latestTarget: {
        target: "roleplayx",
        organizationId: "organization-1",
        category: "category-1",
        status: "succeeded",
      },
      versions: [
        {
          id: version.id,
          packageId: version.packageId,
          version: version.version,
          contentHash: version.contentHash,
          validation: version.validationReport,
          status: "published",
          latestTarget: {
            target: "roleplayx",
            organizationId: "organization-1",
            category: "category-1",
            status: "succeeded",
          },
          createdBy: version.createdBy,
          createdAt: version.createdAt,
        },
      ],
      publicationHistory: [publication],
    });

    const response = await request(app).get("/api/v1/assessments/assessment-1").expect(200);

    expect(response.body.versions).toEqual([
      {
        id: "assessment-version-1",
        packageId: "assessment-1",
        version: 1,
        contentHash: "a".repeat(64),
        validation: { valid: true, diagnostics: [] },
        status: "published",
        latestTarget: {
          target: "roleplayx",
          organizationId: "organization-1",
          category: "category-1",
          status: "succeeded",
        },
        createdBy: "author-1",
        createdAt: createdAt.toISOString(),
      },
    ]);
    expect(response.body.publicationHistory).toHaveLength(1);
    expect(response.body.publicationHistory[0]).toMatchObject({
      id: "publication-1",
      packageVersion: 1,
      status: "succeeded",
      response: { importId: "remote-1" },
    });
    expect(JSON.stringify(response.body)).not.toContain("immutable RoleplayX payload");
  });

  it("returns 404 when the package does not exist", async () => {
    getAssessmentPackageReadModel.mockResolvedValue(undefined);

    await request(app)
      .get("/api/v1/assessments/missing")
      .expect(404)
      .expect({ error: "Assessment package not found." });
  });

  it("lists scenario templates", async () => {
    const response = await request(app).get("/api/v1/assessments/templates").expect(200);
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(3);
    expect(response.body[0].id).toBe("tmpl-ldr-01");
    expect(getAssessmentPackageReadModel).not.toHaveBeenCalled();
  });

  it("retrieves a single template by id", async () => {
    const response = await request(app).get("/api/v1/assessments/templates/tmpl-ldr-01").expect(200);
    expect(response.body.id).toBe("tmpl-ldr-01");
    expect(response.body.title).toBe("성과 부진 팀원 면담");
  });

  it("returns 404 for unknown template id", async () => {
    await request(app)
      .get("/api/v1/assessments/templates/unknown-template")
      .expect(404)
      .expect({ error: 'Assessment template "unknown-template" not found.' });
  });

  it("creates a draft assessment from template", async () => {
    const insertScenario = vi.mocked(scenarioRepository.insertScenario);
    const createAssessmentPackage = vi.mocked(assessmentRepository.createAssessmentPackage);
    const createAssessmentPackageVersion = vi.mocked(assessmentRepository.createAssessmentPackageVersion);
    vi.mocked(generateAssessmentScenario).mockImplementationOnce(async (input: any) => {
      const characters = [
        { name: "AI Counterpart", role: "품질보증 책임자", motivation: "검증 가능한 안전 조건을 요구한다." },
        { name: "Operations Lead", role: "운영 책임자", motivation: "고객 영향의 즉시 축소를 요구한다." },
      ];
      return {
        dramaticScenario: {
          ...input.dramaticScenario,
          title: `AI 심화 시나리오 [${input.compilationInput.metadata.title}]`,
          characters,
        },
        configuration: {
          ...input.configuration,
          primaryPersonaKey: "ai-counterpart-1",
          personaProfiles: characters.map((character) => ({
            ...character,
            background: character.motivation,
            traits: ["단호함", "책임감", "협상 가능"],
            initialDialogue: "안전 조건이 확인되기 전에는 동의할 수 없습니다.",
            behaviorGuidelines: ["근거를 요구한다.", "조건부로 협상한다.", "쉬운 양보를 피한다."],
          })),
        },
      };
    });

    insertScenario.mockResolvedValue({} as any);
    createAssessmentPackage.mockResolvedValue({} as any);
    createAssessmentPackageVersion.mockResolvedValue({
      id: "version-1",
      packageId: "assessment-1",
      version: 1,
      packageJson: {},
      contentHash: "c".repeat(64),
      validationReport: { valid: true, diagnostics: [] },
      createdBy: "ContentX HR Studio",
      createdAt,
    } as any);

    const response = await request(app)
      .post("/api/v1/assessments/from-template")
      .send({
        templateId: "tmpl-ldr-01",
        companyContext: "반도체 생산기술팀",
        participantRole: "신임 파트장",
        counterpartOrganization: "품질보증팀",
        counterpartStance: "재발 방지 대책이 먼저 확정되어야 한다",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      version: 1,
      status: "draft",
      contentHash: "c".repeat(64),
    });
    expect(response.body.assessmentId).toBeDefined();
    expect(response.body.title).toContain("반도체 생산기술팀");

    expect(insertScenario).toHaveBeenCalledTimes(1);
    expect(createAssessmentPackage).toHaveBeenCalledTimes(1);
    expect(createAssessmentPackageVersion).toHaveBeenCalledTimes(1);
    expect(insertScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario: expect.objectContaining({
          characters: expect.arrayContaining([
            expect.objectContaining({ name: "AI Counterpart" }),
          ]),
        }),
      }),
    );
    expect(createAssessmentPackageVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        packageJson: expect.objectContaining({
          scenarios: [
            expect.objectContaining({
              personas: expect.arrayContaining([
                expect.objectContaining({ name: "AI Counterpart", isPrimary: true }),
              ]),
            }),
          ],
        }),
      }),
    );
  });

  it("does not persist when generated output fails the quality gate", async () => {
    vi.mocked(generateAssessmentScenario).mockRejectedValueOnce(
      new AssessmentScenarioGenerationError("validation", "AI output did not meet the required assessment quality contract.", ["synopsis: too short"]),
    );

    const response = await request(app)
      .post("/api/v1/assessments/from-template")
      .send({ templateId: "tmpl-ldr-01", companyContext: "반도체 생산기술팀" })
      .expect(422);

    expect(response.body).toMatchObject({ error: "AI output did not meet the required assessment quality contract.", diagnostics: ["synopsis: too short"] });
    expect(scenarioRepository.insertScenario).not.toHaveBeenCalled();
    expect(assessmentRepository.createAssessmentPackage).not.toHaveBeenCalled();
    expect(assessmentRepository.createAssessmentPackageVersion).not.toHaveBeenCalled();
  });
});