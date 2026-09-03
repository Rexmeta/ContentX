import { createHash } from "crypto";
import { canonicalJsonStringify } from "@workspace/simulation-contract";
import type {
  EvidencePackageV4,
  ValidationMode,
  P91Outcome,
  ProofLevel,
  CustomerStagingAgentProfile,
  ServerVerifiedCustomerAttestation,
  ExpandedHumanGoldSet,
  CalibrationDriftReport,
  PilotRetestResult,
  SegregatedTelemetryReport,
  QualityCertificate,
  DeploymentGateResult,
  ConfusionMatrix,
} from "@workspace/simulation-contract";

export interface BuildEvidencePackageV4Input {
  packageId?: string;
  validationMode: ValidationMode;
  outcome: P91Outcome;
  proofLevel: ProofLevel;
  agent: CustomerStagingAgentProfile;
  attestation: ServerVerifiedCustomerAttestation;
  preflightReport: Record<string, unknown>;
  benchmarkDefinition: Record<string, unknown>;
  populationSnapshot: Record<string, unknown>;
  goldSet: ExpandedHumanGoldSet;
  calibrationReport: Record<string, unknown>;
  calibrationDrift: CalibrationDriftReport;
  pilotBenchmarkResults: Record<string, unknown>;
  failureDiscovery: Record<string, unknown>;
  adaptiveStress: Record<string, unknown>;
  customerFailureReview: Record<string, unknown>;
  hardenedAgentProfile: Record<string, unknown>;
  pilotRetestResults: PilotRetestResult;
  canonicalRegressionCorpus: Record<string, unknown>;
  confusionMatrix: ConfusionMatrix;
  regressionComparison: Record<string, unknown>;
  deploymentGateDecision: DeploymentGateResult;
  segregatedTelemetry: SegregatedTelemetryReport;
  qualityCertificate: QualityCertificate;
  provenanceChain: Record<string, unknown>;
}

export class EvidencePackageV4Builder {
  /**
   * Compiles the 22-sub-artifact Evidence Package v4 and generates SHA-256 content integrity manifest.
   */
  buildPackage(input: BuildEvidencePackageV4Input): EvidencePackageV4 {
    const packageId = input.packageId ?? `evid_v4_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const generatedAt = new Date().toISOString();

    const artifacts: Record<string, unknown> = {
      "01_customer-profile.json": input.agent,
      "02_server-attestation.json": input.attestation,
      "03_preflight-report.json": input.preflightReport,
      "04_benchmark-definition.json": input.benchmarkDefinition,
      "05_population-snapshot.json": input.populationSnapshot,
      "06_expanded-human-gold-set.json": input.goldSet,
      "07_calibration-report.json": input.calibrationReport,
      "08_calibration-drift.json": input.calibrationDrift,
      "09_pilot-benchmark-results.json": input.pilotBenchmarkResults,
      "10_failure-discovery.json": input.failureDiscovery,
      "11_adaptive-stress.json": input.adaptiveStress,
      "12_customer-failure-review.json": input.customerFailureReview,
      "13_hardened-candidate-profile.json": input.hardenedAgentProfile,
      "14_pilot-retest-results.json": input.pilotRetestResults,
      "15_canonical-regression-corpus.json": input.canonicalRegressionCorpus,
      "16_confusion-matrix.json": input.confusionMatrix,
      "17_regression-comparison.json": input.regressionComparison,
      "18_deployment-gate-decision.json": input.deploymentGateDecision,
      "19_segregated-telemetry.json": input.segregatedTelemetry,
      "20_quality-certificate.json": input.qualityCertificate,
      "21_15-stage-provenance-chain.json": input.provenanceChain,
    };

    // Calculate individual SHA256 hashes
    const sha256Sums: Record<string, string> = {};
    for (const [key, content] of Object.entries(artifacts)) {
      const canonical = canonicalJsonStringify(content);
      const hash = createHash("sha256").update(canonical).digest("hex");
      sha256Sums[key] = hash;
    }
    artifacts["22_SHA256SUMS"] = sha256Sums;

    // Calculate root package checksum
    const rootCanonical = canonicalJsonStringify(sha256Sums);
    const rootChecksum = createHash("sha256").update(rootCanonical).digest("hex");

    return {
      packageId,
      manifest: {
        schemaVersion: "contentx.evidence.v4",
        packageId,
        generatedAt,
        validationMode: input.validationMode,
        outcome: input.outcome,
        proofLevel: input.proofLevel,
        lineageChain: {
          customerLegalName: input.attestation.customerLegalName,
          agentId: input.agent.id,
          agentVersion: input.agent.version,
          organizationId: input.agent.tenantId,
          specId: "spec_p91_v1",
          goldSetId: input.goldSet.goldSetId,
          calibrationStatus: input.goldSet.distinctTrajectoryCount >= 50 ? "CALIBRATED" : "PROVISIONAL",
          retestPassed: input.pilotRetestResults.passed,
          gateDecision: input.deploymentGateDecision.decision,
          certificateId: input.qualityCertificate.certificateId,
        },
        rootChecksum,
      },
      artifacts,
      sha256Sums,
    };
  }

  /**
   * Cryptographically verifies Evidence Package v4 content integrity manifest
   */
  verifyPackageV4(pkg: EvidencePackageV4): {
    valid: boolean;
    rootMatch: boolean;
    fileMismatches: string[];
    calculatedRootChecksum: string;
  } {
    const fileMismatches: string[] = [];
    const recordedSums = pkg.sha256Sums;

    for (const [fileName, expectedHash] of Object.entries(recordedSums)) {
      const content = pkg.artifacts[fileName];
      if (!content) {
        fileMismatches.push(fileName);
        continue;
      }
      const canonical = canonicalJsonStringify(content);
      const computedHash = createHash("sha256").update(canonical).digest("hex");
      if (computedHash !== expectedHash) {
        fileMismatches.push(fileName);
      }
    }

    const rootCanonical = canonicalJsonStringify(recordedSums);
    const calculatedRoot = createHash("sha256").update(rootCanonical).digest("hex");
    const rootMatch = calculatedRoot === pkg.manifest.rootChecksum;

    return {
      valid: rootMatch && fileMismatches.length === 0,
      rootMatch,
      fileMismatches,
      calculatedRootChecksum: calculatedRoot,
    };
  }
}

export const evidencePackageV4Builder = new EvidencePackageV4Builder();
