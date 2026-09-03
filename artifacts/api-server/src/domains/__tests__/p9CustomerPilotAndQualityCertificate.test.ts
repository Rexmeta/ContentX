import { describe, it, expect } from "vitest";
import { customerPilotManager } from "../productionEvidence/customerPilotManager";
import { qualityCertificateService } from "../productionEvidence/qualityCertificateService";
import { evidencePackageV3Builder } from "../productionEvidence/evidencePackageV3Builder";
import { compileCustomerServiceReferenceBenchmark } from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import type {
  ExternalAgentRegistration,
  CustomerAgentAttestation,
  P9Gate1Result,
  ComprehensiveBenchmarkReport,
  CalibrationResult,
  ConfusionMatrix,
  DeploymentGateResult,
} from "@workspace/simulation-contract";

describe("P9 Gate #4: Customer Pilot, Quality Certificate & Evidence V3 Suite", () => {
  const spec = compileCustomerServiceReferenceBenchmark();

  const dummyAgent: ExternalAgentRegistration = {
    id: "agent_client_apexpay_cs",
    name: "ApexPay Production Pilot Agent",
    version: "2.1.0",
    tenantId: "org_pilot_client_2026",
    protocol: "http",
    configurationHash: "cfg_hash_apexpay_210",
    capabilities: {
      supportsToolCalling: true,
      supportsMultiTurn: true,
      supportsStreaming: false,
      maxContextTokens: 8192,
      supportedProtocols: ["http"],
    },
    createdAt: new Date().toISOString(),
  };

  const dummyAttestation: CustomerAgentAttestation = {
    customerAgentId: dummyAgent.id,
    organizationId: "org_pilot_client_2026",
    customerName: "Apex Financial Pilot",
    attestationType: "contract_verified",
    declaredBy: "enterprise_solution_architect",
    declaredAt: new Date().toISOString(),
    productionStatus: "staging",
    independenceStatus: "verified",
  };

  const dummyGate1Result: P9Gate1Result = {
    status: "PASS",
    agentId: dummyAgent.id,
    ownershipType: "third_party_customer",
    checks: [],
    independenceStatus: "verified",
    evidenceId: "evid_gate1_test",
    contextHash: "ctx_hash_gate1_test",
    timestamp: new Date().toISOString(),
  };

  const dummyCalibration: CalibrationResult = {
    calibrationRunId: "calib_test_01",
    goldSetId: "gold_set_cs_benchmark_2026",
    evaluatorVersion: "2.0.0-multi-layer",
    rubricVersion: "1.0.0",
    sampleSize: 20,
    expertCount: 3,
    pearsonR: 0.94,
    cohensKappa: 0.89,
    mae: 2.1,
    bias: 0.4,
    calibrationStatus: "CALIBRATED",
    criteriaMet: true,
    calculatedAt: new Date().toISOString(),
    limitations: [],
  };

  const dummyConfusionMatrix: ConfusionMatrix = {
    TP: 10,
    TN: 10,
    FP: 0,
    FN: 0,
    precision: 1.0,
    recall: 1.0,
    falsePositiveRate: 0.0,
    falseNegativeRate: 0.0,
    accuracy: 1.0,
    totalEvaluated: 20,
  };

  const dummyGateDecision: DeploymentGateResult = {
    decision: "APPROVED",
    jobId: "job_pilot_01",
    reportId: "rep_pilot_01",
    agentId: dummyAgent.id,
    candidateVersionId: "2.1.0",
    reason: "Candidate 2.1.0 passed all regression criteria across all cohorts.",
  };

  it("1. manages complete Customer Pilot lifecycle and failure review feedback loop", () => {
    const pilot = customerPilotManager.createPilot({
      organizationId: "org_pilot_client_2026",
      agentId: dummyAgent.id,
      environment: "staging",
      benchmarkVersion: "1.0.0",
      rubricVersion: "1.0.0",
      evaluatorVersion: "2.0.0-multi-layer",
      contextHash: "ctx_hash_pilot_01",
      baselineRunId: "run_base_001",
    });

    expect(pilot.status).toBe("running");
    expect(pilot.customerReviewStatus).toBe("pending");

    // Add confirmed failure review from client QA lead
    const updatedPilot = customerPilotManager.addFailureReview(pilot.pilotId, {
      failureId: "failure_001",
      customerDecision: "confirmed",
      severity: "critical",
      customerComment: "Verified this was a genuine policy breach under legalistic customer pressure.",
      reviewedAt: new Date().toISOString(),
      reviewerId: "usr_client_qa_director",
    });

    expect(updatedPilot.reviews.length).toBe(1);
    expect(updatedPilot.customerReviewStatus).toBe("accepted");

    const completed = customerPilotManager.completePilot(pilot.pilotId, "evid_v3_package_01");
    expect(completed.status).toBe("completed");
    expect(completed.evidenceId).toBe("evid_v3_package_01");
  });

  it("2. generates and validates formal AI Agent Quality Certificate", () => {
    const cert = qualityCertificateService.issueCertificate({
      agentId: dummyAgent.id,
      agentVersion: "2.1.0",
      organizationId: "org_pilot_client_2026",
      benchmarkId: "customer_service_refund_v1",
      benchmarkVersion: "1.0.0",
      populationVersion: "pop_v3",
      rubricVersion: "1.0.0",
      evaluatorVersion: "2.0.0-multi-layer",
      calibrationStatus: "CALIBRATED",
      contextHash: "ctx_hash_pilot_01",
      gateDecision: "APPROVED",
      evidencePackageId: "evid_v3_package_01",
      evidenceRootHash: "root_sha256_hash_test_123",
    });

    expect(cert.certificateStatus).toBe("ISSUED");
    expect(cert.calibrationStatus).toBe("CALIBRATED");
    expect(cert.limitations.length).toBeGreaterThanOrEqual(3);
    expect(cert.limitations.some((l) => l.includes("CALIBRATED against Human Gold Standard"))).toBe(true);

    // Test Revocation
    const revoked = qualityCertificateService.revokeCertificate(cert.certificateId, "Agent configuration hash changed");
    expect(revoked.certificateStatus).toBe("REVOKED");
    expect(revoked.limitations.some((l) => l.includes("REVOKED"))).toBe(true);
  });

  it("3. builds Evidence Package V3 with 20 sub-artifacts and validates cryptographic integrity", () => {
    const cert = qualityCertificateService.issueCertificate({
      agentId: dummyAgent.id,
      agentVersion: "2.1.0",
      organizationId: "org_pilot_client_2026",
      benchmarkId: "customer_service_refund_v1",
      benchmarkVersion: "1.0.0",
      populationVersion: "pop_v3",
      rubricVersion: "1.0.0",
      evaluatorVersion: "2.0.0-multi-layer",
      calibrationStatus: "CALIBRATED",
      contextHash: "ctx_hash_pilot_01",
      gateDecision: "APPROVED",
      evidencePackageId: "evid_v3_package_01",
      evidenceRootHash: "root_sha256_hash_test_123",
    });

    const pilot = customerPilotManager.createPilot({
      organizationId: "org_pilot_client_2026",
      agentId: dummyAgent.id,
      environment: "staging",
      benchmarkVersion: "1.0.0",
      rubricVersion: "1.0.0",
      evaluatorVersion: "2.0.0-multi-layer",
      contextHash: "ctx_hash_pilot_01",
      baselineRunId: "run_base_001",
    });

    const pkg = evidencePackageV3Builder.buildPackage({
      agent: dummyAgent,
      attestation: dummyAttestation,
      gate1Result: dummyGate1Result,
      baseSpec: spec,
      populationSnapshot: { actors: spec.actors },
      baselineReport: {} as ComprehensiveBenchmarkReport,
      goldSetSummary: { goldSetId: "gold_set_cs_benchmark_2026" },
      calibrationReport: dummyCalibration,
      regressionCorpusSummary: { totalCases: 20 },
      confusionMatrix: dummyConfusionMatrix,
      failurePatterns: [],
      adaptiveStressResult: {
        stressRunId: "stress_01",
        targetAgentId: dummyAgent.id,
        sourceFailurePattern: {} as any,
        targetedCohort: {} as any,
        baselineFailureRate: 0.05,
        stressFailureRate: 0.35,
        amplificationFactor: 7.0,
        beforeAfterEvidence: [],
        createdAt: new Date().toISOString(),
      },
      regressionComparison: { delta: 3.5 },
      gateDecision: dummyGateDecision,
      customerPilot: pilot,
      customerFeedback: { status: "confirmed" },
      qualityCertificate: cert,
      lineageManifest: { agentId: dummyAgent.id },
      contextHash: "ctx_hash_pilot_01",
    });

    expect(pkg.manifest.schemaVersion).toBe("contentx.evidence.v3");
    expect(pkg.manifest.rootChecksum).toHaveLength(64);

    // Verify all 20 artifacts exist in files
    const fileKeys = Object.keys(pkg.files);
    expect(fileKeys.length).toBe(20);
    expect(fileKeys).toContain("01_agent-profile.json");
    expect(fileKeys).toContain("07_human-gold-set-summary.json");
    expect(fileKeys).toContain("10_confusion-matrix.json");
    expect(fileKeys).toContain("17_quality-certificate.json");
    expect(fileKeys).toContain("20_SHA256SUMS");

    // Test cryptographic verification
    const verification = evidencePackageV3Builder.verifyPackage(pkg);
    expect(verification.valid).toBe(true);
    expect(verification.rootMatch).toBe(true);
    expect(verification.fileMismatches).toHaveLength(0);
  });

  it("4. detects tampering in any Evidence Package V3 sub-artifact", () => {
    const cert = qualityCertificateService.issueCertificate({
      agentId: dummyAgent.id,
      agentVersion: "2.1.0",
      organizationId: "org_pilot_client_2026",
      benchmarkId: "customer_service_refund_v1",
      benchmarkVersion: "1.0.0",
      populationVersion: "pop_v3",
      rubricVersion: "1.0.0",
      evaluatorVersion: "2.0.0-multi-layer",
      calibrationStatus: "CALIBRATED",
      contextHash: "ctx_hash_pilot_01",
      gateDecision: "APPROVED",
      evidencePackageId: "evid_v3_package_01",
      evidenceRootHash: "root_sha256_hash_test_123",
    });

    const pilot = customerPilotManager.createPilot({
      organizationId: "org_pilot_client_2026",
      agentId: dummyAgent.id,
      environment: "staging",
      benchmarkVersion: "1.0.0",
      rubricVersion: "1.0.0",
      evaluatorVersion: "2.0.0-multi-layer",
      contextHash: "ctx_hash_pilot_01",
      baselineRunId: "run_base_001",
    });

    const pkg = evidencePackageV3Builder.buildPackage({
      agent: dummyAgent,
      attestation: dummyAttestation,
      gate1Result: dummyGate1Result,
      baseSpec: spec,
      populationSnapshot: { actors: spec.actors },
      baselineReport: {} as ComprehensiveBenchmarkReport,
      goldSetSummary: { goldSetId: "gold_set_cs_benchmark_2026" },
      calibrationReport: dummyCalibration,
      regressionCorpusSummary: { totalCases: 20 },
      confusionMatrix: dummyConfusionMatrix,
      failurePatterns: [],
      adaptiveStressResult: {
        stressRunId: "stress_01",
        targetAgentId: dummyAgent.id,
        sourceFailurePattern: {} as any,
        targetedCohort: {} as any,
        baselineFailureRate: 0.05,
        stressFailureRate: 0.35,
        amplificationFactor: 7.0,
        beforeAfterEvidence: [],
        createdAt: new Date().toISOString(),
      },
      regressionComparison: { delta: 3.5 },
      gateDecision: dummyGateDecision,
      customerPilot: pilot,
      customerFeedback: { status: "confirmed" },
      qualityCertificate: cert,
      lineageManifest: { agentId: dummyAgent.id },
      contextHash: "ctx_hash_pilot_01",
    });

    // Tamper with quality certificate in package
    pkg.files["17_quality-certificate.json"] = {
      ...pkg.files["17_quality-certificate.json"],
      gateDecision: "BLOCKED", // Malicious modification
    };

    const tamperedVerification = evidencePackageV3Builder.verifyPackage(pkg);
    expect(tamperedVerification.valid).toBe(false);
    expect(tamperedVerification.fileMismatches).toContain("17_quality-certificate.json");
  });
});
