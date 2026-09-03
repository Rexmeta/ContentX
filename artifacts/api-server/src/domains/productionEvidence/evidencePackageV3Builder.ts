import { createHash } from "crypto";
import { canonicalJsonStringify } from "@workspace/simulation-contract";
import type {
  ExternalAgentRegistration,
  CustomerAgentAttestation,
  P9Gate1Result,
  SimulationSpec,
  ComprehensiveBenchmarkReport,
  HumanGoldSet,
  CalibrationResult,
  ConfusionMatrix,
  HiddenFailurePattern,
  AdaptiveStressResult,
  DeploymentGateResult,
  CustomerPilot,
  QualityCertificate,
} from "@workspace/simulation-contract";

export interface BuildEvidencePackageV3Input {
  packageId?: string;
  agent: ExternalAgentRegistration;
  attestation: CustomerAgentAttestation;
  gate1Result: P9Gate1Result;
  baseSpec: SimulationSpec;
  populationSnapshot: Record<string, unknown>;
  baselineReport: ComprehensiveBenchmarkReport;
  goldSetSummary: Record<string, unknown>;
  calibrationReport: CalibrationResult;
  regressionCorpusSummary: Record<string, unknown>;
  confusionMatrix: ConfusionMatrix;
  failurePatterns: HiddenFailurePattern[];
  adaptiveStressResult: AdaptiveStressResult;
  regressionComparison: Record<string, unknown>;
  gateDecision: DeploymentGateResult;
  customerPilot: CustomerPilot;
  customerFeedback: Record<string, unknown>;
  qualityCertificate: QualityCertificate;
  lineageManifest: Record<string, unknown>;
  contextHash: string;
}

export interface ImmutableEvidencePackageV3 {
  packageId: string;
  manifest: {
    schemaVersion: "contentx.evidence.v3";
    packageId: string;
    generatedAt: string;
    lineageChain: {
      agentId: string;
      agentVersion: string;
      organizationId: string;
      specId: string;
      calibrationStatus: string;
      confusionMatrixAccuracy: number;
      gateDecision: string;
      certificateId: string;
    };
    rootChecksum: string;
  };
  files: {
    "01_agent-profile.json": Record<string, unknown>;
    "02_customer-attestation.json": Record<string, unknown>;
    "03_preflight-report.json": Record<string, unknown>;
    "04_benchmark-definition.json": Record<string, unknown>;
    "05_population-snapshot.json": Record<string, unknown>;
    "06_baseline-results.json": Record<string, unknown>;
    "07_human-gold-set-summary.json": Record<string, unknown>;
    "08_calibration-report.json": Record<string, unknown>;
    "09_regression-corpus.json": Record<string, unknown>;
    "10_confusion-matrix.json": Record<string, unknown>;
    "11_failure-discovery.json": Record<string, unknown>;
    "12_adaptive-stress.json": Record<string, unknown>;
    "13_regression-comparison.json": Record<string, unknown>;
    "14_gate-decision.json": Record<string, unknown>;
    "15_customer-pilot.json": Record<string, unknown>;
    "16_customer-feedback.json": Record<string, unknown>;
    "17_quality-certificate.json": Record<string, unknown>;
    "18_lineage-manifest.json": Record<string, unknown>;
    "19_context-hash.json": Record<string, unknown>;
    "20_SHA256SUMS": Record<string, string>;
  };
}

export class EvidencePackageV3Builder {
  /**
   * Builds an immutable, cryptographically verifiable 20-artifact Evidence Package V3
   */
  buildPackage(input: BuildEvidencePackageV3Input): ImmutableEvidencePackageV3 {
    const packageId = input.packageId ?? `evid_v3_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const generatedAt = new Date().toISOString();

    const files: ImmutableEvidencePackageV3["files"] = {
      "01_agent-profile.json": input.agent as unknown as Record<string, unknown>,
      "02_customer-attestation.json": input.attestation as unknown as Record<string, unknown>,
      "03_preflight-report.json": input.gate1Result as unknown as Record<string, unknown>,
      "04_benchmark-definition.json": {
        specId: input.baseSpec.id,
        name: input.baseSpec.name,
        environment: input.baseSpec.environment,
      },
      "05_population-snapshot.json": input.populationSnapshot,
      "06_baseline-results.json": input.baselineReport as unknown as Record<string, unknown>,
      "07_human-gold-set-summary.json": input.goldSetSummary,
      "08_calibration-report.json": input.calibrationReport as unknown as Record<string, unknown>,
      "09_regression-corpus.json": input.regressionCorpusSummary,
      "10_confusion-matrix.json": input.confusionMatrix as unknown as Record<string, unknown>,
      "11_failure-discovery.json": {
        discoveredFailures: input.failurePatterns,
      },
      "12_adaptive-stress.json": input.adaptiveStressResult as unknown as Record<string, unknown>,
      "13_regression-comparison.json": input.regressionComparison,
      "14_gate-decision.json": input.gateDecision as unknown as Record<string, unknown>,
      "15_customer-pilot.json": input.customerPilot as unknown as Record<string, unknown>,
      "16_customer-feedback.json": input.customerFeedback,
      "17_quality-certificate.json": input.qualityCertificate as unknown as Record<string, unknown>,
      "18_lineage-manifest.json": input.lineageManifest,
      "19_context-hash.json": {
        contextHash: input.contextHash,
      },
      "20_SHA256SUMS": {},
    };

    // Calculate individual SHA256 hashes
    const sha256Sums: Record<string, string> = {};
    for (const [filePath, content] of Object.entries(files)) {
      if (filePath === "20_SHA256SUMS") continue;
      const canonical = canonicalJsonStringify(content);
      const hash = createHash("sha256").update(canonical).digest("hex");
      sha256Sums[filePath] = hash;
    }
    files["20_SHA256SUMS"] = sha256Sums;

    // Calculate Root Package Checksum
    const rootCanonical = canonicalJsonStringify(sha256Sums);
    const rootChecksum = createHash("sha256").update(rootCanonical).digest("hex");

    return {
      packageId,
      manifest: {
        schemaVersion: "contentx.evidence.v3",
        packageId,
        generatedAt,
        lineageChain: {
          agentId: input.agent.id,
          agentVersion: input.agent.version,
          organizationId: input.agent.tenantId || "default",
          specId: input.baseSpec.id,
          calibrationStatus: input.calibrationReport.calibrationStatus,
          confusionMatrixAccuracy: input.confusionMatrix.accuracy,
          gateDecision: input.gateDecision.decision,
          certificateId: input.qualityCertificate.certificateId,
        },
        rootChecksum,
      },
      files,
    };
  }

  /**
   * Cryptographically verifies Evidence Package V3 integrity
   */
  verifyPackage(pkg: ImmutableEvidencePackageV3): {
    valid: boolean;
    rootMatch: boolean;
    fileMismatches: string[];
    calculatedRootChecksum: string;
  } {
    const fileMismatches: string[] = [];
    const recordedSums = pkg.files["20_SHA256SUMS"];

    for (const [filePath, expectedHash] of Object.entries(recordedSums)) {
      const content = pkg.files[filePath as keyof typeof pkg.files];
      if (!content) {
        fileMismatches.push(filePath);
        continue;
      }
      const canonical = canonicalJsonStringify(content);
      const computedHash = createHash("sha256").update(canonical).digest("hex");
      if (computedHash !== expectedHash) {
        fileMismatches.push(filePath);
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

export const evidencePackageV3Builder = new EvidencePackageV3Builder();
