import { createHash } from "crypto";
import { canonicalJsonStringify } from "@workspace/simulation-contract";
import type {
  SimulationSpec,
  ComprehensiveBenchmarkReport,
  DeploymentGateResult,
  HiddenFailurePattern,
  AdaptiveStressResult,
  ExternalAgentRegistration,
} from "@workspace/simulation-contract";

export interface BuildEvidencePackageInput {
  packageId?: string;
  agent: ExternalAgentRegistration;
  candidateVersion: string;
  baseSpec: SimulationSpec;
  benchmarkId: string;
  benchmarkVersion: string;
  populationVersion: string;
  evaluationContextHash: string;
  calibrationStatus: "CALIBRATED" | "PROVISIONAL";
  baselineReport: ComprehensiveBenchmarkReport;
  candidateReport: ComprehensiveBenchmarkReport;
  failurePatterns: HiddenFailurePattern[];
  adaptiveStressResult: AdaptiveStressResult;
  gateResult: DeploymentGateResult;
  evidenceTraceIds: string[];
}

export interface ImmutableEvidencePackage {
  packageId: string;
  manifest: {
    schemaVersion: "contentx.evidence.v2";
    packageId: string;
    generatedAt: string;
    lineageChain: {
      agentId: string;
      agentVersion: string;
      specId: string;
      benchmarkId: string;
      benchmarkVersion: string;
      populationVersion: string;
      evaluationContextHash: string;
      calibrationStatus: "CALIBRATED" | "PROVISIONAL";
      failurePatternCount: number;
      stressRunId: string;
      gateDecision: "APPROVED" | "BLOCKED" | "WARNING";
    };
    rootChecksum: string;
  };
  files: {
    "agent/registration.json": Record<string, unknown>;
    "agent/version.json": Record<string, unknown>;
    "benchmark/benchmark.json": Record<string, unknown>;
    "benchmark/simulation-spec.json": Record<string, unknown>;
    "benchmark/population-snapshot.json": Record<string, unknown>;
    "evaluation/rubric.json": Record<string, unknown>;
    "evaluation/evaluator.json": Record<string, unknown>;
    "evaluation/context-hash.json": Record<string, unknown>;
    "evaluation/calibration.json": Record<string, unknown>;
    "comparison/baseline.json": Record<string, unknown>;
    "comparison/candidate.json": Record<string, unknown>;
    "comparison/regression.json": Record<string, unknown>;
    "discovery/failure-patterns.json": Record<string, unknown>;
    "discovery/evidence-traces.json": Record<string, unknown>;
    "adaptive-stress/targeted-cohort.json": Record<string, unknown>;
    "adaptive-stress/stress-spec.json": Record<string, unknown>;
    "adaptive-stress/amplification.json": Record<string, unknown>;
    "deployment/gate-decision.json": Record<string, unknown>;
    "checksums/SHA256SUMS": Record<string, string>;
  };
}

export class EvidencePackageBuilder {
  /**
   * Builds an immutable, cryptographically verifiable 13-stage Evidence Package
   */
  buildPackage(input: BuildEvidencePackageInput): ImmutableEvidencePackage {
    const packageId = input.packageId ?? `evid_pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const generatedAt = new Date().toISOString();

    const files: ImmutableEvidencePackage["files"] = {
      "agent/registration.json": input.agent as unknown as Record<string, unknown>,
      "agent/version.json": {
        agentId: input.agent.id,
        version: input.candidateVersion,
        configurationHash: input.agent.configurationHash,
      },
      "benchmark/benchmark.json": {
        benchmarkId: input.benchmarkId,
        version: input.benchmarkVersion,
        name: input.baseSpec.name,
      },
      "benchmark/simulation-spec.json": input.baseSpec as unknown as Record<string, unknown>,
      "benchmark/population-snapshot.json": {
        populationVersion: input.populationVersion,
        actors: input.baseSpec.actors,
      },
      "evaluation/rubric.json": input.baseSpec.evaluationRubric as unknown as Record<string, unknown>,
      "evaluation/evaluator.json": {
        evaluatorVersion: "2.0.0-multi-layer",
        engine: "MultiLayerEvaluationEngine",
      },
      "evaluation/context-hash.json": {
        evaluationContextHash: input.evaluationContextHash,
      },
      "evaluation/calibration.json": {
        status: input.calibrationStatus,
        basis: input.calibrationStatus === "CALIBRATED" ? "human_expert_gold_set" : "synthetic_validation",
      },
      "comparison/baseline.json": input.baselineReport as unknown as Record<string, unknown>,
      "comparison/candidate.json": input.candidateReport as unknown as Record<string, unknown>,
      "comparison/regression.json": input.gateResult.regressionReport as unknown as Record<string, unknown>,
      "discovery/failure-patterns.json": {
        discoveredFailures: input.failurePatterns,
      },
      "discovery/evidence-traces.json": {
        evidenceTraceIds: input.evidenceTraceIds,
      },
      "adaptive-stress/targeted-cohort.json": input.adaptiveStressResult.targetedCohort as unknown as Record<string, unknown>,
      "adaptive-stress/stress-spec.json": {
        stressSpecId: `${input.baseSpec.id}_targeted_stress`,
      },
      "adaptive-stress/amplification.json": {
        baselineFailureRate: input.adaptiveStressResult.baselineFailureRate,
        stressFailureRate: input.adaptiveStressResult.stressFailureRate,
        amplificationFactor: input.adaptiveStressResult.amplificationFactor,
        beforeAfterEvidence: input.adaptiveStressResult.beforeAfterEvidence,
      },
      "deployment/gate-decision.json": {
        decision: input.gateResult.decision,
        reason: input.gateResult.reason,
        jobId: input.gateResult.jobId,
      },
      "checksums/SHA256SUMS": {},
    };

    // Compute SHA-256 for each file
    const sha256Sums: Record<string, string> = {};
    for (const [filePath, content] of Object.entries(files)) {
      if (filePath === "checksums/SHA256SUMS") continue;
      const canonical = canonicalJsonStringify(content);
      const hash = createHash("sha256").update(canonical).digest("hex");
      sha256Sums[filePath] = hash;
    }
    files["checksums/SHA256SUMS"] = sha256Sums;

    // Compute Root Package Checksum
    const rootCanonical = canonicalJsonStringify(sha256Sums);
    const rootChecksum = createHash("sha256").update(rootCanonical).digest("hex");

    return {
      packageId,
      manifest: {
        schemaVersion: "contentx.evidence.v2",
        packageId,
        generatedAt,
        lineageChain: {
          agentId: input.agent.id,
          agentVersion: input.candidateVersion,
          specId: input.baseSpec.id,
          benchmarkId: input.benchmarkId,
          benchmarkVersion: input.benchmarkVersion,
          populationVersion: input.populationVersion,
          evaluationContextHash: input.evaluationContextHash,
          calibrationStatus: input.calibrationStatus,
          failurePatternCount: input.failurePatterns.length,
          stressRunId: input.adaptiveStressResult.stressRunId,
          gateDecision: input.gateResult.decision,
        },
        rootChecksum,
      },
      files,
    };
  }

  /**
   * Verifies complete cryptographic checksums of an Evidence Package
   */
  verifyPackage(pkg: ImmutableEvidencePackage): {
    valid: boolean;
    rootMatch: boolean;
    fileMismatches: string[];
    calculatedRootChecksum: string;
  } {
    const fileMismatches: string[] = [];
    const recordedSums = pkg.files["checksums/SHA256SUMS"];

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

export const evidencePackageBuilder = new EvidencePackageBuilder();
