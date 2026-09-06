import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateAssessmentPackageVersionBody,
  CreateAssessmentPackageVersionResponse,
  GetAssessmentParams,
  GetAssessmentResponse,
  GetAssessmentPackageVersionParams,
  GetAssessmentPackageVersionResponse,
  ListAssessmentsResponse,
  ListAssessmentPackagePublicationHistoryResponse,
  PublishAssessmentPackageVersionToRoleplayXBody,
  PublishAssessmentPackageVersionToRoleplayXResponse,
  ValidateAssessmentPackageVersionResponse,
} from "@workspace/api-zod";
import * as assessmentRepository from "../domains/assessment/repository";
import * as scenarioRepository from "../domains/scenario/repository";
import { compileAssessmentScenarioPackage } from "../domains/assessment/compiler";
import { validateAssessmentScenarioPackage } from "../domains/assessment/validator";
import { createHttpAssessmentPublishingService } from "../domains/assessment/httpComposition";
import type { AssessmentScenarioConfiguration } from "../domains/assessment/model";
import type { DramaticScenario } from "../domains/scenario/model";
import { newId } from "../shared/id";
import { z } from "zod";
import {
  listScenarioTemplates,
  getScenarioTemplate,
} from "../domains/assessment/scenarioTemplateCatalog";
import { instantiateAssessmentTemplate } from "../domains/assessment/templateInstantiator";

const router: IRouter = Router();

function assessmentParams(value: unknown) {
  return GetAssessmentParams.safeParse(value);
}

function assessmentRecord(
  row: Awaited<ReturnType<typeof assessmentRepository.getAssessmentPackage>>,
  summary: Pick<
    assessmentRepository.AssessmentPackageReadModel,
    "scenarioCount" | "competencyCount" | "latestTarget"
  >,
) {
  if (!row) throw new Error("Assessment package record is required.");
  return {
    id: row.id,
    packageKey: row.packageKey,
    title: row.title,
    description: row.description,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    status: row.status,
    currentVersion: row.currentVersion,
    scenarioCount: summary.scenarioCount,
    competencyCount: summary.competencyCount,
    latestTarget: summary.latestTarget,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function versionParams(value: unknown) {
  const raw = value as { id?: unknown; packageId?: unknown; version?: unknown };
  const parsed = GetAssessmentPackageVersionParams.safeParse({
    id: raw.id ?? raw.packageId,
    version: raw.version,
  });
  if (!parsed.success) return parsed;
  return { success: true as const, data: { packageId: parsed.data.id, version: parsed.data.version } };
}

function versionRecord(row: Awaited<ReturnType<typeof assessmentRepository.createAssessmentPackageVersion>>) {
  return {
    id: row.id,
    packageId: row.packageId,
    version: row.version,
    contentHash: row.contentHash,
    validation: row.validationReport,
    createdAt: row.createdAt,
  };
}

function versionSummary(
  row: assessmentRepository.AssessmentPackageVersionReadSummary,
) {
  return {
    id: row.id,
    packageId: row.packageId,
    version: row.version,
    contentHash: row.contentHash,
    validation: row.validation,
    status: row.status,
    latestTarget: row.latestTarget,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

async function listAssessments(_req: Request, res: Response): Promise<void> {
  const packages = await assessmentRepository.listAssessmentPackageReadModels();
  res.json(
    ListAssessmentsResponse.parse(
      packages.map((readModel) => assessmentRecord(readModel.assessmentPackage, readModel)),
    ),
  );
}

async function getAssessment(req: Request, res: Response): Promise<void> {
  const parsed = assessmentParams(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const readModel = await assessmentRepository.getAssessmentPackageReadModel(parsed.data.id);
  if (!readModel) {
    res.status(404).json({ error: "Assessment package not found." });
    return;
  }
  res.json(
    GetAssessmentResponse.parse({
      ...assessmentRecord(readModel.assessmentPackage, readModel),
      versions: readModel.versions.map(versionSummary),
      publicationHistory: readModel.publicationHistory.map(publicationRecord),
    }),
  );
}

async function createVersion(req: Request, res: Response, packageId: string): Promise<void> {
  const parsed = CreateAssessmentPackageVersionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = { ...parsed.data, packageId };
  if (new Set(input.scenarios.map((scenario) => scenario.scenarioId)).size !== input.scenarios.length) {
    res.status(400).json({ error: "scenarioId values must be unique." });
    return;
  }
  const sourceRows = await Promise.all(input.scenarios.map((scenario) => scenarioRepository.getScenario(scenario.scenarioId)));
  const missing = input.scenarios.filter((_, index) => !sourceRows[index]).map((scenario) => scenario.scenarioId);
  if (missing.length) {
    res.status(404).json({ error: `Saved scenarios not found: ${missing.join(", ")}` });
    return;
  }
  const compiled = compileAssessmentScenarioPackage({
    packageKey: input.packageKey,
    version: String(input.version),
    publishedAt: input.publishedAt.toISOString(),
    sourcePackageId: input.packageId,
    author: input.author,
    metadata: input.metadata,
    competencies: input.competencies,
    scenarios: input.scenarios.map((configuration, index) => {
      const { scenarioId: _scenarioId, ...config } = configuration;
      return {
        dramaticScenario: sourceRows[index]!.scenario as DramaticScenario,
        configuration: config as AssessmentScenarioConfiguration,
      };
    }),
  });
  if (!compiled.package) {
    res.status(400).json({ error: JSON.stringify({ diagnostics: compiled.diagnostics }) });
    return;
  }

  try {
    const existing = await assessmentRepository.getAssessmentPackage(input.packageId);
    if (existing && existing.packageKey !== input.packageKey) {
      res.status(409).json({ error: "packageId is already bound to a different packageKey." });
      return;
    }
    if (!existing) {
      await assessmentRepository.createAssessmentPackage({
        id: input.packageId,
        packageKey: input.packageKey,
        title: input.metadata.title,
        description: input.metadata.description,
        sourceType: "scenario-library",
        sourceId: input.scenarios.map((item) => item.scenarioId).sort().join(","),
      });
    }
    const row = await assessmentRepository.createAssessmentPackageVersion({
      id: newId("assessmentversion"),
      packageId: input.packageId,
      version: input.version,
      packageJson: compiled.package,
      contentHash: compiled.package.provenance.contentHash,
      validationReport: { valid: true, diagnostics: compiled.diagnostics },
      createdBy: input.author,
    });
    res.status(201).json(CreateAssessmentPackageVersionResponse.parse(versionRecord(row)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create immutable assessment package version.";
    res.status(409).json({ error: message });
  }
}

async function validateVersion(req: Request, res: Response): Promise<void> {
  const parsed = versionParams(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const row = await assessmentRepository.getAssessmentPackageVersion(parsed.data.packageId, parsed.data.version);
  if (!row) {
    res.status(404).json({ error: "Assessment package version not found." });
    return;
  }
  res.json(ValidateAssessmentPackageVersionResponse.parse(validateAssessmentScenarioPackage(row.packageJson)));
}

async function getVersionPackage(req: Request, res: Response): Promise<void> {
  const parsed = versionParams(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const row = await assessmentRepository.getAssessmentPackageVersion(parsed.data.packageId, parsed.data.version);
  if (!row) {
    res.status(404).json({ error: "Assessment package version not found." });
    return;
  }
  res.json(GetAssessmentPackageVersionResponse.parse(row.packageJson));
}

async function publishVersion(req: Request, res: Response): Promise<void> {
  const route = versionParams(req.params);
  const body = PublishAssessmentPackageVersionToRoleplayXBody.safeParse(req.body);
  if (!route.success) {
    res.status(400).json({ error: route.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const version = await assessmentRepository.getAssessmentPackageVersion(route.data.packageId, route.data.version);
  if (!version) {
    res.status(404).json({ error: "Assessment package version not found." });
    return;
  }
  try {
    const result = await createHttpAssessmentPublishingService().publish({
      packageId: route.data.packageId,
      version: route.data.version,
      organizationId: body.data.organizationId,
      category: body.data.category,
    });
    const status =
      result.status !== "failed"
        ? 200
        : result.errorCategory === "validation"
          ? 400
          : result.errorCategory === "auth"
            ? 401
            : result.errorCategory === "permission"
              ? 403
              : result.errorCategory === "conflict"
                ? 409
                : 502;
    res.status(status).json(PublishAssessmentPackageVersionToRoleplayXResponse.parse(result));
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "RoleplayX publishing is unavailable." });
  }
}

function publicationRecord(item: Awaited<ReturnType<typeof assessmentRepository.listPublicationHistory>>[number]) {
  return {
    id: item.id, packageId: item.packageId, packageVersion: item.packageVersion, target: item.target,
    organizationId: item.targetOrganizationId, category: item.targetCategoryId, idempotencyKey: item.idempotencyKey,
    attempt: item.attempt, status: item.status, response: item.response ?? undefined,
    errorCode: item.errorCode, errorMessage: item.errorMessage, createdAt: item.createdAt,
    completedAt: item.completedAt, publishedAt: item.publishedAt,
  };
}

async function listVersionPublications(req: Request, res: Response): Promise<void> {
  const parsed = versionParams(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const version = await assessmentRepository.getAssessmentPackageVersion(parsed.data.packageId, parsed.data.version);
  if (!version) {
    res.status(404).json({ error: "Assessment package version not found." });
    return;
  }
  const history = await assessmentRepository.listPublicationHistory(parsed.data.packageId, parsed.data.version);
  res.json(ListAssessmentPackagePublicationHistoryResponse.parse(history.map(publicationRecord)));
}

async function listPackagePublications(req: Request, res: Response): Promise<void> {
  const packageId = req.params.id;
  if (typeof packageId !== "string" || !packageId) {
    res.status(400).json({ error: "Assessment id is required." });
    return;
  }
  const assessmentPackage = await assessmentRepository.getAssessmentPackage(packageId);
  if (!assessmentPackage) {
    res.status(404).json({ error: "Assessment package not found." });
    return;
  }
  const history = await assessmentRepository.listAssessmentPackagePublicationHistory(packageId);
  res.json(ListAssessmentPackagePublicationHistoryResponse.parse(history.map(publicationRecord)));
}

const FromTemplateBodySchema = z.object({
  templateId: z.string().trim().min(1),
  companyContext: z.string().trim().min(1),
  participantRole: z.string().trim().optional(),
  situation: z.string().trim().optional(),
  counterpartName: z.string().trim().optional(),
  counterpartRole: z.string().trim().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  passingScore: z.number().min(0).max(100).optional(),
});

async function listTemplates(_req: Request, res: Response): Promise<void> {
  res.json(listScenarioTemplates());
}

async function getTemplate(req: Request, res: Response): Promise<void> {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  const template = getScenarioTemplate(id);
  if (!template) {
    res.status(404).json({ error: `Assessment template "${id}" not found.` });
    return;
  }
  res.json(template);
}

async function createFromTemplate(req: Request, res: Response): Promise<void> {
  const parsed = FromTemplateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    templateId,
    companyContext,
    participantRole,
    situation,
    counterpartName,
    counterpartRole,
    difficulty,
    passingScore,
  } = parsed.data;

  try {
    const scenarioId = newId("scenario");
    const packageId = newId("assessment");

    const instantiated = instantiateAssessmentTemplate({
      templateId,
      companyContext,
      participantRole,
      situation,
      counterpartName,
      counterpartRole,
      difficulty,
      passingScore,
      packageId,
    });

    const compiled = compileAssessmentScenarioPackage(instantiated.compilationInput);
    if (!compiled.package) {
      res.status(400).json({ error: "Failed to compile assessment template.", diagnostics: compiled.diagnostics });
      return;
    }

    await scenarioRepository.insertScenario({
      id: scenarioId,
      title: instantiated.title,
      idea: `Assessment Template: ${instantiated.template.title}`,
      scenario: instantiated.dramaticScenario,
      classification: null,
      lineage: null,
    });

    await assessmentRepository.createAssessmentPackage({
      id: packageId,
      packageKey: compiled.package.packageKey,
      title: instantiated.title,
      description: instantiated.description,
      sourceType: "scenario-template",
      sourceId: scenarioId,
    });

    const row = await assessmentRepository.createAssessmentPackageVersion({
      id: newId("assessmentversion"),
      packageId,
      version: 1,
      packageJson: compiled.package,
      contentHash: compiled.package.provenance.contentHash,
      validationReport: { valid: true, diagnostics: compiled.diagnostics },
      createdBy: "ContentX HR Studio",
    });

    res.status(201).json({
      assessmentId: packageId,
      version: 1,
      status: "draft",
      title: instantiated.title,
      packageKey: compiled.package.packageKey,
      contentHash: row.contentHash,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to instantiate assessment from template.";
    res.status(500).json({ error: message });
  }
}

router.get("/v1/assessments/templates", listTemplates);
router.get("/v1/assessments/templates/:id", getTemplate);
router.post("/v1/assessments/from-template", createFromTemplate);
router.get("/v1/assessments", listAssessments);
router.get("/v1/assessments/:id", getAssessment);
router.post("/v1/assessments/:id/versions", (req, res) => createVersion(req, res, req.params.id));
router.post("/v1/assessments/:id/versions/:version/validate", validateVersion);
router.get("/v1/assessments/:id/versions/:version/package", getVersionPackage);
router.post("/v1/assessments/:id/versions/:version/publish", publishVersion);
router.get("/v1/assessments/:id/publishes", listPackagePublications);

// Deprecated aliases retained for existing assessment-package clients.
router.post("/v1/assessment-packages/versions", async (req, res) => {
  const parsed = CreateAssessmentPackageVersionBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.packageId) {
    res.status(400).json({ error: parsed.success ? "packageId is required." : parsed.error.message });
    return;
  }
  await createVersion(req, res, parsed.data.packageId);
});
router.post("/v1/assessment-packages/:packageId/versions/:version/validate", validateVersion);
router.get("/v1/assessment-packages/:packageId/versions/:version", getVersionPackage);
router.post("/v1/assessment-packages/:packageId/versions/:version/publish/roleplayx", publishVersion);
router.get("/v1/assessment-packages/:packageId/versions/:version/publications", listVersionPublications);

export default router;