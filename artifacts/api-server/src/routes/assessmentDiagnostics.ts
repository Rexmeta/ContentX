import { Router, type IRouter } from "express";
import {
  GetAssessmentParticipantPreviewQueryParams, GetAssessmentParticipantPreviewResponse,
  ExportAssessmentDiagnosticResponse, GetAssessmentDiagnosticResponse,
  RequestAssessmentMediaUploadBody, RequestAssessmentMediaUploadResponse,
} from "@workspace/api-zod";
import * as repository from "../domains/assessment/repository";
import { assessmentActor, requireAssessmentAuthor } from "../domains/assessment/access";
import { diagnosticHash, parseDiagnostic, projectParticipant, exportDiagnostic } from "../domains/assessment/diagnostic";
import { diagnosticSample } from "../domains/assessment/diagnosticSample";
import { getAssessmentMedia, mediaStorage, requestMediaUpload, validateDiagnosticMedia } from "../domains/assessment/media";
import { AssessmentScenarioPackageV1Schema } from "../domains/assessment/schema";
import { newId } from "../shared/id";

const router: IRouter = Router();
async function readSource(id: string, version: number) {
  const row = await repository.getAssessmentPackageVersion(id, version);
  if (!row?.diagnosticJson) return null;
  if (diagnosticHash(row.diagnosticJson) !== row.diagnosticHash) throw new Error("Diagnostic snapshot integrity check failed");
  const pkg = AssessmentScenarioPackageV1Schema.parse(row.packageJson);
  return { row, pkg, source: parseDiagnostic(row.diagnosticJson, pkg) };
}
router.post("/v1/assessments/diagnostic-sample", requireAssessmentAuthor, async (req, res): Promise<void> => {
  const id = newId("assessment"), actor = assessmentActor(req)!;
  const sample = diagnosticSample(id, actor);
  await repository.createAssessmentPackage({
    id, packageKey: id, title: sample.package.metadata.title, description: sample.package.metadata.description,
    sourceType: "diagnostic-sample", sourceId: id, diagnosticOwnerId: actor,
  });
  const row = await repository.createAssessmentPackageVersion({
    id: newId("assessmentversion"), packageId: id, version: 1, packageJson: sample.package, diagnosticJson: sample.diagnostic,
    contentHash: sample.package.provenance.contentHash, validationReport: { valid: true, diagnostics: [] }, createdBy: actor,
  });
  res.status(201).json({ assessmentId: id, version: row.version, title: sample.package.metadata.title, packageKey: id, contentHash: row.contentHash, status: "draft" });
});
router.get("/v1/assessments/:id/versions/:version/diagnostic", requireAssessmentAuthor, async (req, res): Promise<void> => {
  const value = await readSource(String(req.params.id), Number(req.params.version));
  if (!value) { res.status(404).json({ error: "Diagnostic source not found" }); return; }
  res.set("Cache-Control", "private, no-store").json(GetAssessmentDiagnosticResponse.parse(value.source));
});
router.post("/v1/assessments/:id/versions/:version/diagnostic", requireAssessmentAuthor, async (req, res): Promise<void> => {
  try {
    const actor = assessmentActor(req)!;
    const base = await repository.getAssessmentPackageVersion(String(req.params.id), Number(req.params.version));
    if (!base) { res.status(404).json({ error: "Assessment version not found" }); return; }
    const source = parseDiagnostic(req.body, AssessmentScenarioPackageV1Schema.parse(base.packageJson));
    await validateDiagnosticMedia(source, actor);
    const row = await repository.createDiagnosticSuccessor(String(req.params.id), Number(req.params.version), source, actor);
    res.status(201).json({ id: row.id, packageId: row.packageId, version: row.version, contentHash: row.contentHash, validation: row.validationReport, createdAt: row.createdAt });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Diagnostic validation failed" }); }
});
router.get("/v1/assessments/:id/versions/:version/diagnostic-export", requireAssessmentAuthor, async (req, res): Promise<void> => {
  const value = await readSource(String(req.params.id), Number(req.params.version));
  if (!value) { res.status(404).json({ error: "Diagnostic source not found" }); return; }
  res.set("Cache-Control", "private, no-store").json(ExportAssessmentDiagnosticResponse.parse(exportDiagnostic(value.pkg, value.source)));
});
router.get("/v1/assessments/:id/versions/:version/participant", async (req, res): Promise<void> => {
  const query = GetAssessmentParticipantPreviewQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "phase must be preparation or conversation" }); return; }
  const value = await readSource(String(req.params.id), Number(req.params.version));
  if (!value) { res.status(404).json({ error: "Participant preview unavailable; legacy author packages are never used as a fallback" }); return; }
  res.set("Cache-Control", "no-store").json(GetAssessmentParticipantPreviewResponse.parse(projectParticipant(value.source, query.data.phase)));
});
router.post("/v1/assessment-media/uploads", requireAssessmentAuthor, async (req, res): Promise<void> => {
  const body = RequestAssessmentMediaUploadBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Only PNG, JPEG, WebP, MP4 and WebM are supported" }); return; }
  res.set("Cache-Control", "private, no-store").json(RequestAssessmentMediaUploadResponse.parse(await requestMediaUpload(assessmentActor(req)!, body.data.contentType)));
});
router.get("/v1/assessments/:id/versions/:version/media/:assetId", async (req, res): Promise<void> => {
  const query = GetAssessmentParticipantPreviewQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "phase is required" }); return; }
  const value = await readSource(String(req.params.id), Number(req.params.version));
  const visible = value && projectParticipant(value.source, query.data.phase).scenarios.flatMap((s) => s.materials).some((m) => m.assetId === req.params.assetId);
  if (!visible) { res.status(404).end(); return; }
  const media = await getAssessmentMedia(String(req.params.assetId));
  if (!media) { res.status(404).end(); return; }
  const file = await mediaStorage.getObjectEntityFile(media.objectPath);
  res.set({ "Content-Type": media.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  file.createReadStream().on("error", () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); }).pipe(res);
});
export default router;
