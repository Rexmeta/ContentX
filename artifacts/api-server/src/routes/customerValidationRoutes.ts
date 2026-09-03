import { Router } from "express";
import { customerStagingAgentService } from "../domains/customerValidation/customerStagingAgentService";
import { serverAttestationVerificationService } from "../domains/customerValidation/serverAttestationVerificationService";
import { expandedGoldSetService } from "../domains/customerValidation/expandedGoldSetService";
import { calibrationDriftEngine } from "../domains/customerValidation/calibrationDriftEngine";
import { pilotRetestEngine } from "../domains/customerValidation/pilotRetestEngine";
import { evidencePackageV4Builder } from "../domains/customerValidation/evidencePackageV4Builder";
import { customerQualityCertificateService } from "../domains/customerValidation/customerQualityCertificateService";
import { p91MasterStateMachine } from "../domains/customerValidation/p91MasterStateMachine";

const router = Router();

function verifyTenant(reqOrgId: string | undefined, resourceOrgId: string): boolean {
  if (!reqOrgId) return true;
  return reqOrgId === resourceOrgId;
}

// 1. Onboard Customer Agent (with secretRef resolution)
router.post("/api/p9.1/agent/onboard", async (req, res) => {
  const profile = req.body;
  if (!profile || !profile.id || !profile.endpointUrl || !profile.authConfig?.secretRef) {
    return res.status(400).json({ code: "INVALID_AGENT_PROFILE", message: "Agent id, endpointUrl, and authConfig.secretRef are required." });
  }

  const callerOrgId = (req.headers["x-organization-id"] as string) || profile.tenantId || "default";
  if (profile.tenantId && profile.tenantId !== callerOrgId) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Cross-tenant agent onboarding forbidden." });
  }

  try {
    const result = await customerStagingAgentService.onboardAgent({ ...profile, tenantId: callerOrgId });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent onboarding failed.";
    return res.status(422).json({ code: "AGENT_ONBOARDING_FAILED", message });
  }
});

// 2. Server-side Attestation Verification
router.post("/api/p9.1/attestation/verify", (req, res) => {
  const { customerLegalName, ownershipType, operatorIdentity, contractReference, productionStatus, verificationMethod, evidenceRef } = req.body || {};
  const callerOrgId = (req.headers["x-organization-id"] as string) || "default";

  if (!customerLegalName || !ownershipType || !operatorIdentity) {
    return res.status(400).json({ code: "INVALID_ATTESTATION_INPUT", message: "customerLegalName, ownershipType, and operatorIdentity are required." });
  }

  try {
    const attestation = serverAttestationVerificationService.verifyAndRecordAttestation({
      organizationId: callerOrgId,
      customerLegalName,
      ownershipType,
      operatorIdentity,
      contractReference,
      productionStatus,
      verificationMethod: verificationMethod ?? "contract",
      evidenceRef,
    });
    return res.status(201).json(attestation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attestation verification failed.";
    return res.status(422).json({ code: "ATTESTATION_FAILED", message });
  }
});

// 3. Ingest Expanded Human Gold Set (N >= 50 for customer validation)
router.post("/api/p9.1/gold-set/ingest", (req, res) => {
  const { goldSetId, name, rubricVersion, annotations } = req.body || {};
  const callerOrgId = (req.headers["x-organization-id"] as string) || "default";

  if (!goldSetId || !annotations || annotations.length === 0) {
    return res.status(400).json({ code: "INVALID_GOLD_SET_INPUT", message: "goldSetId and annotations are required." });
  }

  try {
    const goldSet = expandedGoldSetService.registerGoldSet({
      goldSetId,
      organizationId: callerOrgId,
      name: name ?? "Expanded Human Gold Set",
      rubricVersion: rubricVersion ?? "1.0.0",
      annotations,
    });
    return res.status(201).json(goldSet);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gold set ingestion failed.";
    return res.status(422).json({ code: "GOLD_SET_INGESTION_FAILED", message });
  }
});

// 4. Calibration & Drift Evaluation
router.post("/api/p9.1/calibration/evaluate", (req, res) => {
  const { goldSetId, spec, trajectories, baselinePearsonR, baselineMAE } = req.body || {};
  const callerOrgId = (req.headers["x-organization-id"] as string) || "default";

  const goldSet = expandedGoldSetService.getGoldSet(goldSetId);
  if (!goldSet) {
    return res.status(404).json({ code: "GOLD_SET_NOT_FOUND", message: `Gold set ${goldSetId} not found.` });
  }

  if (!verifyTenant(callerOrgId, goldSet.organizationId)) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Cross-tenant gold set access forbidden." });
  }

  try {
    const evaluation = calibrationDriftEngine.evaluateDrift({
      spec,
      currentGoldSet: goldSet,
      trajectories: trajectories ?? [],
      baselinePearsonR,
      baselineMAE,
    });
    return res.json(evaluation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calibration drift evaluation failed.";
    return res.status(422).json({ code: "CALIBRATION_EVAL_FAILED", message });
  }
});

// 5. Retest Execution
router.post("/api/p9.1/pilot/retest", (req, res) => {
  const { pilotId, targetFailureId, targetMetricId, baselineFailureRate, spec, retestTraces } = req.body || {};

  if (!pilotId || !targetFailureId || !targetMetricId || !spec || !retestTraces) {
    return res.status(400).json({ code: "INVALID_RETEST_INPUT", message: "pilotId, targetFailureId, targetMetricId, spec, and retestTraces are required." });
  }

  try {
    const result = pilotRetestEngine.evaluateRetest({
      pilotId,
      targetFailureId,
      targetMetricId,
      baselineFailureRate: baselineFailureRate ?? 0.05,
      spec,
      retestTraces,
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retest evaluation failed.";
    return res.status(422).json({ code: "RETEST_FAILED", message });
  }
});

// 6. Master Validation Pipeline
router.post("/api/p9.1/pipeline/execute", async (req, res) => {
  const { validationMode, agentProfile, attestationInput, spec, goldSet, benchmarkTrajectories, retestTraces, regressionTraces, customerConfirmedFailures } = req.body || {};
  const callerOrgId = (req.headers["x-organization-id"] as string) || agentProfile?.tenantId || "default";

  if (!validationMode || !agentProfile || !attestationInput || !spec || !goldSet) {
    return res.status(400).json({ code: "INVALID_PIPELINE_INPUT", message: "Missing required pipeline parameters." });
  }

  try {
    const result = await p91MasterStateMachine.executePipeline({
      validationMode,
      agentProfile: { ...agentProfile, tenantId: callerOrgId },
      attestationInput,
      spec,
      goldSet,
      benchmarkTrajectories: benchmarkTrajectories ?? [],
      retestTraces: retestTraces ?? [],
      regressionTraces: regressionTraces ?? [],
      customerConfirmedFailures,
    });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Master pipeline execution failed.";
    return res.status(422).json({ code: "PIPELINE_EXECUTION_FAILED", message });
  }
});

// 7. Get Quality Certificate
router.get("/api/p9.1/certificate/:id", (req, res) => {
  const certId = typeof req.params.id === "string" ? req.params.id : req.params.id[0];
  const cert = customerQualityCertificateService.getCertificate(certId);
  if (!cert) {
    return res.status(404).json({ code: "CERTIFICATE_NOT_FOUND", message: `Certificate ${certId} not found.` });
  }

  const callerOrgId = (req.headers["x-organization-id"] as string) || "default";
  if (!verifyTenant(callerOrgId, cert.organizationId)) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Cross-tenant certificate access forbidden." });
  }

  return res.json(cert);
});

export default router;
