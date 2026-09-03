import { describe, it, expect } from "vitest";
import { evidencePackageV4Builder } from "../customerValidation/evidencePackageV4Builder";

describe("P9.1 Evidence Package v4 & Cryptographic Tamper Detection", () => {
  const dummyAgent: any = { id: "agent_zenith", name: "Zenith Assistant", version: "1.0.0", tenantId: "org_zenith" };
  const dummyAttestation: any = { attestationId: "attest_01", customerLegalName: "Zenith Inc.", ownershipType: "third_party_customer", independenceStatus: "verified" };
  const dummyGoldSet: any = { goldSetId: "gold_n50", distinctTrajectoryCount: 50, expertCount: 3, multiRaterCoverage: 0.95, consensusCoverage: 0.95 };
  const dummyDrift: any = { driftReportId: "drift_01", driftStatus: "STABLE", currentPearsonR: 0.92, deltaPearsonR: 0.02 };
  const dummyRetest: any = { retestId: "retest_01", passed: true, targetRecurrenceRate: 0.0, retestFailureRate: 0.0 };
  const dummyGate: any = { decision: "APPROVED", explanation: "Approved" };
  const dummyTelemetry: any = { platformTelemetry: {}, agentTelemetry: {}, evaluatorQuality: {}, customerBusinessValue: {} };
  const dummyCert: any = { certificateId: "cert_01", certificateType: "customer_quality_certificate" };

  it("builds Evidence Package v4 containing 22 sub-artifacts and passes cryptographic validation", () => {
    const pkg = evidencePackageV4Builder.buildPackage({
      validationMode: "customer_validation",
      outcome: "CUSTOMER_VALIDATED",
      proofLevel: "customer_validation",
      agent: dummyAgent,
      attestation: dummyAttestation,
      preflightReport: { passed: true },
      benchmarkDefinition: { specId: "spec_01" },
      populationSnapshot: { actors: [] },
      goldSet: dummyGoldSet,
      calibrationReport: { status: "CALIBRATED" },
      calibrationDrift: dummyDrift,
      pilotBenchmarkResults: { runs: 100 },
      failureDiscovery: { failures: [] },
      adaptiveStress: { amplification: 6.2 },
      customerFailureReview: { confirmed: 1 },
      hardenedAgentProfile: { version: "1.1.0" },
      pilotRetestResults: dummyRetest,
      canonicalRegressionCorpus: { count: 20 },
      confusionMatrix: { TP: 10, TN: 10, FP: 0, FN: 0, precision: 1.0, recall: 1.0, falsePositiveRate: 0.0, falseNegativeRate: 0.0, accuracy: 1.0, totalEvaluated: 20 },
      regressionComparison: { delta: 0 },
      deploymentGateDecision: dummyGate,
      segregatedTelemetry: dummyTelemetry,
      qualityCertificate: dummyCert,
      provenanceChain: { length: 15 },
    });

    expect(pkg.manifest.schemaVersion).toBe("contentx.evidence.v4");
    expect(Object.keys(pkg.artifacts).length).toBe(22);
    expect(pkg.artifacts["22_SHA256SUMS"]).toBeDefined();

    const verification = evidencePackageV4Builder.verifyPackageV4(pkg);
    expect(verification.valid).toBe(true);
    expect(verification.rootMatch).toBe(true);
    expect(verification.fileMismatches.length).toBe(0);
  });

  it("detects tampering when any sub-artifact is altered after packaging", () => {
    const pkg = evidencePackageV4Builder.buildPackage({
      validationMode: "customer_validation",
      outcome: "CUSTOMER_VALIDATED",
      proofLevel: "customer_validation",
      agent: dummyAgent,
      attestation: dummyAttestation,
      preflightReport: { passed: true },
      benchmarkDefinition: { specId: "spec_01" },
      populationSnapshot: { actors: [] },
      goldSet: dummyGoldSet,
      calibrationReport: { status: "CALIBRATED" },
      calibrationDrift: dummyDrift,
      pilotBenchmarkResults: { runs: 100 },
      failureDiscovery: { failures: [] },
      adaptiveStress: { amplification: 6.2 },
      customerFailureReview: { confirmed: 1 },
      hardenedAgentProfile: { version: "1.1.0" },
      pilotRetestResults: dummyRetest,
      canonicalRegressionCorpus: { count: 20 },
      confusionMatrix: { TP: 10, TN: 10, FP: 0, FN: 0, precision: 1.0, recall: 1.0, falsePositiveRate: 0.0, falseNegativeRate: 0.0, accuracy: 1.0, totalEvaluated: 20 },
      regressionComparison: { delta: 0 },
      deploymentGateDecision: dummyGate,
      segregatedTelemetry: dummyTelemetry,
      qualityCertificate: dummyCert,
      provenanceChain: { length: 15 },
    });

    // Tamper with failure discovery artifact
    pkg.artifacts["10_failure-discovery.json"] = { tampered: true };

    const verification = evidencePackageV4Builder.verifyPackageV4(pkg);
    expect(verification.valid).toBe(false);
    expect(verification.fileMismatches).toContain("10_failure-discovery.json");
  });
});
