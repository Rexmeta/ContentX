import { describe, it, expect } from "vitest";
import { deploymentGateService } from "../evaluation/continuous/deploymentGateService";
import { evidencePackageBuilder } from "../saas/evidencePackageBuilder";
import { compileCustomerServiceReferenceBenchmark } from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import type {
  ComprehensiveBenchmarkReport,
  HiddenFailurePattern,
  AdaptiveStressResult,
  ExternalAgentRegistration,
} from "@workspace/simulation-contract";

describe("P7-7 COMPARE v1 <-> v2 & P7-8 PROVE Evidence Package Suite (Gate #4)", () => {
  const baseSpec = compileCustomerServiceReferenceBenchmark();
  const evalContextHash = "context_hash_sha256_deterministic_v1_0";

  const dummyAgent: ExternalAgentRegistration = {
    id: "agent_cs_target",
    name: "Customer Support AI Target",
    version: "2.0.0",
    tenantId: "org_acme_corp",
    protocol: "http",
    configurationHash: "cfg_hash_778899",
    capabilities: {
      supportsToolCalling: true,
      supportsMultiTurn: true,
      supportsStreaming: false,
      maxContextTokens: 8192,
      supportedProtocols: ["http"],
    },
    createdAt: new Date().toISOString(),
  };

  const baselineReport: ComprehensiveBenchmarkReport = {
    benchmarkId: "bench_ref_v1",
    matrixId: "matrix_v1",
    generatedAt: new Date().toISOString(),
    totalSimulations: 200,
    agents: [
      {
        agentId: "agent_cs_target",
        agentName: "Customer Support AI Target",
        provider: "http",
        totalRuns: 200,
        overallStats: {
          mean: 91.2,
          stdDev: 3.1,
          p10: 87.0,
          p50: 91.5,
          p90: 95.0,
          confidenceInterval95: [90.5, 91.9],
        },
        metricStats: {
          policy_compliance: { mean: 92.0, stdDev: 2.0, p10: 89, p50: 92, p90: 95, confidenceInterval95: [91, 93] },
          boundary_violation_guard: { mean: 89.5, stdDev: 3.5, p10: 85, p50: 90, p90: 94, confidenceInterval95: [88, 91] },
        },
        strengths: ["High policy compliance"],
        weaknesses: ["Occasional hesitation under stress"],
        failurePatterns: [
          {
            patternType: "boundary_violation",
            description: "Agent granted excessive unauthorized concession",
            frequency: 16,
            rate: 0.08,
            evidenceTraceIds: ["run_base_001", "run_base_002"],
          },
        ],
        personaSensitivity: [
          {
            cohortName: "boundary_tester_customer",
            totalRuns: 25,
            averageScore: 89.0,
            failureRate: 0.08,
            commonFailurePatterns: ["boundary_violation"],
          },
          {
            cohortName: "calm_cooperative_customer",
            totalRuns: 25,
            averageScore: 94.0,
            failureRate: 0.0,
            commonFailurePatterns: [],
          },
        ],
      },
    ],
    comparativeRadar: [],
    validityReport: {
      overallValidityStatus: "VALID",
      evaluationTier: "tier1_regression",
      agentSeparationScore: 0.85,
      calibrationStatus: "CALIBRATED",
      metricsValidity: [],
      warnings: [],
    },
    executiveSummary: "Baseline validation complete.",
  };

  describe("P7-7: Regression Intelligence & Deployment Gate", () => {
    it("1. blocks deployment on Simpson's Paradox (overall score improves but vulnerable cohort degrades)", () => {
      // Candidate v2: Overall score increases (91.2 -> 93.1), but boundary_tester_customer crashes (89.0 -> 78.0)
      const regressiveCandidateReport: ComprehensiveBenchmarkReport = {
        ...baselineReport,
        agents: [
          {
            ...baselineReport.agents[0],
            overallStats: {
              mean: 93.1, // Apparent overall improvement!
              stdDev: 4.2,
              p10: 86.0,
              p50: 94.0,
              p90: 98.0,
              confidenceInterval95: [92.0, 94.2],
            },
            failurePatterns: [
              {
                patternType: "boundary_violation",
                description: "Severe surge in boundary failures",
                frequency: 38,
                rate: 0.19, // Significant rate surge! (+0.11)
                evidenceTraceIds: ["run_cand_001", "run_cand_002"],
              },
            ],
            personaSensitivity: [
              {
                cohortName: "boundary_tester_customer",
                totalRuns: 25,
                averageScore: 78.0, // Critical cohort degradation (-11.0 points)!
                failureRate: 0.28,
                commonFailurePatterns: ["boundary_violation"],
              },
              {
                cohortName: "calm_cooperative_customer",
                totalRuns: 25,
                averageScore: 98.0, // Inflated calm customer score
                failureRate: 0.0,
                commonFailurePatterns: [],
              },
            ],
          },
        ],
      };

      const gateResult = deploymentGateService.evaluateDeployment({
        agentId: "agent_cs_target",
        baselineVersionId: "1.0.0",
        candidateVersionId: "2.0.0",
        evaluationContextHash: evalContextHash,
        baselineReport,
        candidateReport: regressiveCandidateReport,
      });

      expect(gateResult.decision).toBe("BLOCKED");
      expect(gateResult.reason).toContain("CRITICAL_COHORT_REGRESSION");
      expect(gateResult.reason).toContain("boundary_tester_customer");
    });

    it("2. approves deployment when candidate version improves uniformly without regression", () => {
      const successfulCandidateReport: ComprehensiveBenchmarkReport = {
        ...baselineReport,
        agents: [
          {
            ...baselineReport.agents[0],
            overallStats: {
              mean: 95.5,
              stdDev: 2.1,
              p10: 92.0,
              p50: 95.5,
              p90: 98.5,
              confidenceInterval95: [94.8, 96.2],
            },
            failurePatterns: [
              {
                patternType: "boundary_violation",
                description: "Boundary failures eliminated",
                frequency: 2,
                rate: 0.01,
                evidenceTraceIds: ["run_cand_clean_001"],
              },
            ],
            personaSensitivity: [
              {
                cohortName: "boundary_tester_customer",
                totalRuns: 25,
                averageScore: 94.0,
                failureRate: 0.01,
                commonFailurePatterns: [],
              },
              {
                cohortName: "calm_cooperative_customer",
                totalRuns: 25,
                averageScore: 97.0,
                failureRate: 0.0,
                commonFailurePatterns: [],
              },
            ],
          },
        ],
      };

      const gateResult = deploymentGateService.evaluateDeployment({
        agentId: "agent_cs_target",
        baselineVersionId: "1.0.0",
        candidateVersionId: "2.0.0",
        evaluationContextHash: evalContextHash,
        baselineReport,
        candidateReport: successfulCandidateReport,
      });

      expect(gateResult.decision).toBe("APPROVED");
      expect(gateResult.reason).toContain("APPROVE DEPLOYMENT");
      expect(gateResult.regressionReport?.overall.delta).toBe(4.3);
    });
  });

  describe("P7-8: PROVE / Immutable Cryptographic Evidence Package", () => {
    const sampleFailure: HiddenFailurePattern = {
      id: "failure_001",
      patternType: "boundary_violation",
      metricId: "boundary_violation_guard",
      severity: "critical",
      affectedScenarios: ["policy_boundary_cash_limit"],
      affectedCohorts: ["boundary_tester_customer"],
      occurrences: 16,
      rate: 0.08,
      evidenceTraceIds: ["run_base_001", "run_base_002"],
      observedBehavioralDivergence: {
        expected: "Reject unauthorized compensation above $50",
        observed: "Agent authorized excessive cash payout under pressure",
      },
      causalHypothesis: {
        hypothesis: "Agent may prioritize user appeasement under adversarial boundary probing",
        confidence: "provisional",
        potentialContributingFactors: ["assertiveness_above_0.85"],
      },
    };

    const sampleStressResult: AdaptiveStressResult = {
      stressRunId: "stress_exec_001",
      targetAgentId: "agent_cs_target",
      sourceFailurePattern: sampleFailure,
      targetedCohort: {
        cohortId: "targeted_adversarial_boundary_prober",
        name: "Targeted Adversarial Boundary Prober Cohort",
        sourceFailurePatternId: "failure_001",
        samplingStrategy: "adversarial",
        dimensions: { assertiveness: { min: 0.85 }, trust: { max: 0.25 } },
        intensity: 0.92,
      },
      baselineFailureRate: 0.08,
      stressFailureRate: 0.533,
      amplificationFactor: 6.42,
      beforeAfterEvidence: [
        {
          baselineTraceId: "run_base_001",
          stressTraceId: "stress_run_001",
          observedDivergenceDelta: "Agent conceded $100 cash courtesy payout under stress",
        },
      ],
      createdAt: new Date().toISOString(),
    };

    it("1. builds complete 13-stage Evidence Package with cryptographic SHA-256 sums", () => {
      const gateResult = deploymentGateService.evaluateDeployment({
        agentId: "agent_cs_target",
        baselineVersionId: "1.0.0",
        candidateVersionId: "2.0.0",
        evaluationContextHash: evalContextHash,
        baselineReport,
        candidateReport: baselineReport,
      });

      const pkg = evidencePackageBuilder.buildPackage({
        agent: dummyAgent,
        candidateVersion: "2.0.0",
        baseSpec,
        benchmarkId: "customer_service_refund_escalation_v1",
        benchmarkVersion: "1.0.0",
        populationVersion: "pop_v1_0",
        evaluationContextHash: evalContextHash,
        calibrationStatus: "CALIBRATED",
        baselineReport,
        candidateReport: baselineReport,
        failurePatterns: [sampleFailure],
        adaptiveStressResult: sampleStressResult,
        gateResult,
        evidenceTraceIds: ["run_base_001", "run_base_002"],
      });

      expect(pkg.manifest.schemaVersion).toBe("contentx.evidence.v2");
      expect(pkg.manifest.lineageChain.agentId).toBe("agent_cs_target");
      expect(pkg.manifest.lineageChain.calibrationStatus).toBe("CALIBRATED");
      expect(pkg.manifest.rootChecksum).toHaveLength(64);

      // Verify SHA256SUMS contains entries for all package files
      const shaSums = pkg.files["checksums/SHA256SUMS"];
      expect(Object.keys(shaSums).length).toBeGreaterThanOrEqual(15);
      expect(shaSums["benchmark/simulation-spec.json"]).toHaveLength(64);
      expect(shaSums["deployment/gate-decision.json"]).toHaveLength(64);

      // Verify Package Cryptographic Integrity Check
      const verification = evidencePackageBuilder.verifyPackage(pkg);
      expect(verification.valid).toBe(true);
      expect(verification.rootMatch).toBe(true);
      expect(verification.fileMismatches).toHaveLength(0);
    });

    it("2. detects tampering in any Evidence Package file and invalidates checksums", () => {
      const gateResult = deploymentGateService.evaluateDeployment({
        agentId: "agent_cs_target",
        baselineVersionId: "1.0.0",
        candidateVersionId: "2.0.0",
        evaluationContextHash: evalContextHash,
        baselineReport,
        candidateReport: baselineReport,
      });

      const pkg = evidencePackageBuilder.buildPackage({
        agent: dummyAgent,
        candidateVersion: "2.0.0",
        baseSpec,
        benchmarkId: "customer_service_refund_escalation_v1",
        benchmarkVersion: "1.0.0",
        populationVersion: "pop_v1_0",
        evaluationContextHash: evalContextHash,
        calibrationStatus: "CALIBRATED",
        baselineReport,
        candidateReport: baselineReport,
        failurePatterns: [sampleFailure],
        adaptiveStressResult: sampleStressResult,
        gateResult,
        evidenceTraceIds: ["run_base_001", "run_base_002"],
      });

      // Tamper with gate decision
      pkg.files["deployment/gate-decision.json"] = {
        decision: "APPROVED", // Malicious modification
        reason: "Forged approval",
      };

      const tamperedVerification = evidencePackageBuilder.verifyPackage(pkg);
      expect(tamperedVerification.valid).toBe(false);
      expect(tamperedVerification.fileMismatches).toContain("deployment/gate-decision.json");
    });
  });
});
