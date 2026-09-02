import { Router } from "express";
import {
  commercialValidationService,
  REFERENCE_BENCHMARK_ID,
} from "../domains/commercialValidation/service";

const router = Router();

router.get("/v1/reference-benchmark", (_req, res) => {
  res.json(commercialValidationService.getDefinition());
});

router.get("/v1/commercial-validation/runs", async (_req, res) => {
  res.json(await commercialValidationService.listRuns());
});

router.get("/v1/commercial-validation/runs/:id", async (req, res) => {
  const run = await commercialValidationService.getRun(req.params.id);
  if (!run) return res.status(404).json({ code: "VALIDATION_RUN_NOT_FOUND", message: "Commercial validation run not found." });
  res.json(run);
});

router.post("/v1/commercial-validation/runs", async (req, res) => {
  const { agentId, sampleSizePerCohort, repetitions, baseSeed, calibrationData } = req.body || {};
  if (typeof agentId !== "string" || !agentId.trim()) {
    return res.status(400).json({ code: "AGENT_ID_REQUIRED", message: "agentId is required." });
  }
  try {
    const run = await commercialValidationService.run({
      agentId,
      sampleSizePerCohort,
      repetitions,
      baseSeed,
      calibrationData,
    });
    return res.status(201).json(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Commercial validation failed.";
    return res.status(422).json({ code: "COMMERCIAL_VALIDATION_FAILED", message });
  }
});

router.post("/v1/commercial-validation/compare", async (req, res) => {
  const { baselineRunId, candidateRunId } = req.body || {};
  if (typeof baselineRunId !== "string" || typeof candidateRunId !== "string") {
    return res.status(400).json({ code: "COMPARISON_RUNS_REQUIRED", message: "baselineRunId and candidateRunId are required." });
  }
  try {
    return res.status(201).json(await commercialValidationService.compare({ baselineRunId, candidateRunId }));
  } catch (error) {
    return res.status(422).json({
      code: "COMMERCIAL_COMPARISON_FAILED",
      message: error instanceof Error ? error.message : "Commercial comparison failed.",
    });
  }
});

router.get("/v1/commercial-validation/packages/:id", async (req, res) => {
  const evidencePackage = await commercialValidationService.getPackage(req.params.id);
  if (!evidencePackage) return res.status(404).json({ code: "EVIDENCE_PACKAGE_NOT_FOUND", message: "Evidence package not found." });
  res.setHeader("Content-Disposition", `attachment; filename="${REFERENCE_BENCHMARK_ID}-${evidencePackage.id}.json"`);
  res.json(evidencePackage);
});

router.post("/v1/commercial-validation/packages/:id/verify", async (req, res) => {
  const verification = await commercialValidationService.verifyPackage(req.params.id);
  if (!verification) return res.status(404).json({ code: "EVIDENCE_PACKAGE_NOT_FOUND", message: "Evidence package not found." });
  res.json(verification);
});

export default router;