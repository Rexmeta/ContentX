import { Router } from "express";
import { customerAgentAttestationService } from "../domains/productionEvidence/customerAgentAttestationService";
import { humanGoldCalibrationService } from "../domains/productionEvidence/humanGoldCalibrationService";
import { standardRegressionCorpusService } from "../domains/productionEvidence/standardRegressionCorpusService";
import { customerPilotManager } from "../domains/productionEvidence/customerPilotManager";
import { qualityCertificateService } from "../domains/productionEvidence/qualityCertificateService";
import { evidencePackageV3Builder } from "../domains/productionEvidence/evidencePackageV3Builder";

const router = Router();

// Helper to check tenant isolation
function verifyTenant(reqOrgId: string | undefined, resourceOrgId: string): boolean {
  if (!reqOrgId) return true; // default permissive if header not set
  return reqOrgId === resourceOrgId;
}

// 1. P9 Status & Overview
router.get("/api/p9/status", (_req, res) => {
  res.json({
    p9Version: "1.0.0",
    proofHierarchy: {
      level1Infrastructure: "VALIDATED",
      level2ExternalTechnical: "VALIDATED",
      level25CommercialPilotSimulation: "VALIDATED_READY",
      level3ProductionEvidence: "IN_PROGRESS",
    },
    gates: {
      gate1CustomerAgentConnect: "READY",
      gate2HumanGoldCalibration: "READY",
      gate3StandardRegressionCorpus: "READY",
      gate4CustomerPilotCertificate: "READY",
    },
    canonicalRegressionCorpus: "R01-R08",
  });
});

// 2. Gate Status
router.get("/api/p9/gates", (_req, res) => {
  res.json({
    gate1: { name: "Real Customer Agent Connect", criteria: "preflight pass + verified attestation" },
    gate2: { name: "Human Gold Set Calibration", criteria: "Pearson r >= 0.90, Kappa >= 0.85, N >= 20" },
    gate3: { name: "Standard Regression Corpus", criteria: "accuracy >= 0.85, FPR <= 10%, R01~R08 evaluated" },
    gate4: { name: "Customer Pilot & Certificate", criteria: "closed loop pass + SHA256 verified package" },
  });
});

// 3. Register Customer Agent (Gate #1)
router.post("/api/p9/customer-agent", async (req, res) => {
  const { agent, ownershipType, attestation } = req.body || {};
  if (!agent || !agent.id || !ownershipType) {
    return res.status(400).json({ code: "INVALID_REQUEST", message: "agent object and ownershipType are required." });
  }

  const callerOrgId = (req.headers["x-organization-id"] as string) || agent.tenantId || "default";
  if (agent.tenantId && agent.tenantId !== callerOrgId) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Cross-tenant agent registration forbidden." });
  }

  try {
    const result = await customerAgentAttestationService.registerAndVerifyAgent({
      agent: { ...agent, tenantId: callerOrgId },
      ownershipType,
      attestation,
    });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Customer agent registration failed.";
    return res.status(422).json({ code: "AGENT_REGISTRATION_FAILED", message });
  }
});

// 4. Register Human Gold Set (Gate #2)
router.post("/api/p9/gold-set", (req, res) => {
  const { goldSetId, name, rubricVersion, annotations } = req.body || {};
  const callerOrgId = (req.headers["x-organization-id"] as string) || "default";

  if (!goldSetId || !annotations || annotations.length === 0) {
    return res.status(400).json({ code: "INVALID_GOLD_SET", message: "goldSetId and annotations are required." });
  }

  try {
    const goldSet = humanGoldCalibrationService.registerGoldSet({
      goldSetId,
      organizationId: callerOrgId,
      name: name ?? "Default Human Gold Set",
      rubricVersion: rubricVersion ?? "1.0.0",
      annotations,
    });
    return res.status(201).json(goldSet);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gold set creation failed.";
    return res.status(422).json({ code: "GOLD_SET_CREATION_FAILED", message });
  }
});

// 5. Run Calibration Analysis (Gate #2)
router.post("/api/p9/calibration/run", (req, res) => {
  const { goldSetId, spec, trajectories } = req.body || {};
  const callerOrgId = (req.headers["x-organization-id"] as string) || "default";

  const goldSet = humanGoldCalibrationService.getGoldSet(goldSetId);
  if (!goldSet) {
    return res.status(404).json({ code: "GOLD_SET_NOT_FOUND", message: `Gold set ${goldSetId} not found.` });
  }

  if (!verifyTenant(callerOrgId, goldSet.organizationId)) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Tenant access forbidden to this gold set." });
  }

  try {
    const result = humanGoldCalibrationService.calibrateEvaluator({
      goldSet,
      spec,
      trajectories: trajectories ?? [],
    });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calibration failed.";
    return res.status(422).json({ code: "CALIBRATION_FAILED", message });
  }
});

// 6. Get Regression Corpus Definition (Gate #3)
router.get("/api/p9/regression/corpus", (_req, res) => {
  res.json({
    version: "1.0.0",
    categories: ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08"],
    corpus: standardRegressionCorpusService.getCanonicalCorpus(),
  });
});

// 7. Run Regression Corpus Evaluation (Gate #3)
router.post("/api/p9/regression/run", (req, res) => {
  const { spec, traces } = req.body || {};
  if (!spec || !traces) {
    return res.status(400).json({ code: "INVALID_REGRESSION_INPUT", message: "spec and traces are required." });
  }

  try {
    const result = standardRegressionCorpusService.evaluateCorpus({ spec, traces });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Regression corpus evaluation failed.";
    return res.status(422).json({ code: "REGRESSION_EVALUATION_FAILED", message });
  }
});

// 8. Create Customer Pilot (Gate #4)
router.post("/api/p9/pilot", (req, res) => {
  const { agentId, environment, benchmarkVersion, rubricVersion, evaluatorVersion, contextHash, baselineRunId } = req.body || {};
  const callerOrgId = (req.headers["x-organization-id"] as string) || "default";

  if (!agentId || !contextHash) {
    return res.status(400).json({ code: "INVALID_PILOT_INPUT", message: "agentId and contextHash are required." });
  }

  try {
    const pilot = customerPilotManager.createPilot({
      organizationId: callerOrgId,
      agentId,
      environment: environment ?? "staging",
      benchmarkVersion: benchmarkVersion ?? "1.0.0",
      rubricVersion: rubricVersion ?? "1.0.0",
      evaluatorVersion: evaluatorVersion ?? "2.0.0-multi-layer",
      contextHash,
      baselineRunId: baselineRunId ?? "run_base_001",
    });
    return res.status(201).json(pilot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Customer pilot creation failed.";
    return res.status(422).json({ code: "PILOT_CREATION_FAILED", message });
  }
});

// 9. Get Pilot Details (Gate #4)
router.get("/api/p9/pilot/:id", (req, res) => {
  const pilot = customerPilotManager.getPilot(req.params.id);
  if (!pilot) {
    return res.status(404).json({ code: "PILOT_NOT_FOUND", message: `Pilot ${req.params.id} not found.` });
  }

  const callerOrgId = (req.headers["x-organization-id"] as string) || "default";
  if (!verifyTenant(callerOrgId, pilot.organizationId)) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Cross-tenant pilot access forbidden." });
  }

  res.json(pilot);
});

// 10. Issue Quality Certificate
router.post("/api/p9/certificate", (req, res) => {
  const {
    agentId,
    agentVersion,
    benchmarkId,
    benchmarkVersion,
    populationVersion,
    rubricVersion,
    evaluatorVersion,
    calibrationStatus,
    contextHash,
    gateDecision,
    evidencePackageId,
    evidenceRootHash,
    limitations,
  } = req.body || {};

  const callerOrgId = (req.headers["x-organization-id"] as string) || "default";
  if (!agentId || !agentVersion || !gateDecision || !evidencePackageId) {
    return res.status(400).json({ code: "INVALID_CERTIFICATE_INPUT", message: "agentId, agentVersion, gateDecision, and evidencePackageId are required." });
  }

  try {
    const cert = qualityCertificateService.issueCertificate({
      agentId,
      agentVersion,
      organizationId: callerOrgId,
      benchmarkId: benchmarkId ?? "bench_v1",
      benchmarkVersion: benchmarkVersion ?? "1.0.0",
      populationVersion: populationVersion ?? "pop_v1",
      rubricVersion: rubricVersion ?? "1.0.0",
      evaluatorVersion: evaluatorVersion ?? "2.0.0-multi-layer",
      calibrationStatus: calibrationStatus ?? "PROVISIONAL",
      contextHash: contextHash ?? "ctx_hash_v1",
      gateDecision,
      evidencePackageId,
      evidenceRootHash: evidenceRootHash ?? "pending",
      limitations,
    });
    return res.status(201).json(cert);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Certificate issuance failed.";
    return res.status(422).json({ code: "CERTIFICATE_ISSUANCE_FAILED", message });
  }
});

// 11. Get Quality Certificate
router.get("/api/p9/certificate/:id", (req, res) => {
  const cert = qualityCertificateService.getCertificate(req.params.id);
  if (!cert) {
    return res.status(404).json({ code: "CERTIFICATE_NOT_FOUND", message: `Certificate ${req.params.id} not found.` });
  }

  const callerOrgId = (req.headers["x-organization-id"] as string) || "default";
  if (!verifyTenant(callerOrgId, cert.organizationId)) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Cross-tenant certificate access forbidden." });
  }

  res.json(cert);
});

export default router;
