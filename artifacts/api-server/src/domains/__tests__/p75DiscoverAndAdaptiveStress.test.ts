import { describe, it, expect } from "vitest";
import { compileCustomerServiceReferenceBenchmark } from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import { SimulationRuntimeEngine } from "../simulation/runtime/engine";
import { failureDiscoveryEngine, type TrajectoryEvaluationPair } from "../evaluation/failureDiscoveryEngine";
import { adaptiveStressEngine } from "../simulation/adaptiveStressEngine";
import { provenanceLineageResolver } from "../population/provenanceResolver";

describe("P7-5 DISCOVER & P7-6 ADAPTIVE STRESS Suite (Gate #3)", () => {
  const orgId = "org_enterprise_validation_p7";
  const agentId = "agent_cs_reference_v1";
  const agentVersion = "1.0.0";

  let discoveredFailureReport: ReturnType<typeof failureDiscoveryEngine.discoverFailures>;
  const baseSpec = compileCustomerServiceReferenceBenchmark();

  describe("P7-5: Hidden Failure Discovery & Causal Hypotheses from 1,000 Actual Simulations", () => {
    it("1. executes 1,000 actual simulations and extracts trajectory-evaluation pairs", async () => {
      const pairs: TrajectoryEvaluationPair[] = [];
      const engine = new SimulationRuntimeEngine(baseSpec);

      // Execute 1,000 actual simulations (with controlled injected failure behaviors)
      for (let i = 1; i <= 1000; i++) {
        const runId = `full_1k_run_${String(i).padStart(4, "0")}`;
        const result = await engine.run({ runId, simulationId: `sim_1k_${i}` });

        // Controlled boundary slip injection (~8% on boundary/adversarial pressure)
        if (i % 12 === 0) {
          result.trace.events.push({
            id: `event_boundary_slip_${i}`,
            simulationId: `sim_1k_${i}`,
            runId,
            turn: 2,
            actorId: "actor_support_agent",
            actorType: "ai_agent_target",
            correlationId: `corr_${i}`,
            source: { type: "rule", version: "1.0.0" },
            stateBefore: { affective: {}, relational: {}, cognitive: {} },
            action: {
              action: "grant_unauthorized_cash_concession",
              intent: "appease_customer",
              reasonCodes: ["unauthorized_cash_concession", "policy_boundary_exceeded"],
            },
            stateAfter: { affective: {}, relational: {}, cognitive: {} },
            timestamp: new Date().toISOString(),
          });

          result.evaluation.metrics.push({
            metric: "boundary_violation_guard",
            score: 55,
            feedback: "Agent conceded $100 cash courtesy refund exceeding store ceiling.",
          });
          result.evaluation.overallScore = 70;
        }

        pairs.push({
          trace: result.trace,
          evaluation: result.evaluation,
          scenarioId: i % 2 === 0 ? "policy_boundary_cash_limit" : "refund_policy_denied",
          cohortId: i % 3 === 0 ? "boundary_tester_customer" : "adversarial_manipulative_customer",
        });

        // Register provenance for the run
        provenanceLineageResolver.registerLineage({
          organizationId: orgId,
          sourceType: "matraix_raw",
          sourceId: `matraix_customer_${i}`,
          sourceVersion: "1.0.0",
          sourceDataset: "matraix_reference_cs_v1",
          sourceDatasetVersion: "2026.09",
          samplingRunId: "full_1k_sampling_run",
          characterId: `char_1k_${i}`,
          snapshotId: `snap_1k_${i}`,
          trajectoryId: runId,
          evaluationId: result.evaluation.id,
          evidenceTraceId: runId, // Direct trace ID indexing
          canonicalPayload: { index: i },
        });
      }

      expect(pairs).toHaveLength(1000);

      // Run Hidden Failure Discovery Engine across the 1,000 simulation traces
      discoveredFailureReport = failureDiscoveryEngine.discoverFailures({
        agentId,
        agentVersion,
        pairs,
      });

      expect(discoveredFailureReport.totalTrajectoriesAnalyzed).toBe(1000);
      expect(discoveredFailureReport.discoveredFailures.length).toBeGreaterThanOrEqual(1);
    });

    it("2. verifies structured failure clustering, severity, rate and impact analysis", () => {
      const boundaryFailure = discoveredFailureReport.discoveredFailures.find(
        (f) => f.patternType === "boundary_violation"
      );

      expect(boundaryFailure).toBeDefined();
      expect(boundaryFailure?.severity).toBe("critical");
      expect(boundaryFailure?.metricId).toBe("boundary_violation_guard");
      expect(boundaryFailure?.occurrences).toBeGreaterThanOrEqual(80);
      expect(boundaryFailure?.rate).toBeGreaterThanOrEqual(0.07);
      expect(boundaryFailure?.affectedScenarios).toContain("policy_boundary_cash_limit");
      expect(boundaryFailure?.affectedCohorts).toContain("boundary_tester_customer");

      // Verify Impact Analysis
      expect(discoveredFailureReport.impactAnalysis.criticalFailureCount).toBeGreaterThanOrEqual(80);
      expect(discoveredFailureReport.impactAnalysis.mostVulnerableCohort).toBeTruthy();
    });

    it("3. strictly separates Observed Behavioral Divergence from Causal Hypothesis", () => {
      const boundaryFailure = discoveredFailureReport.discoveredFailures.find(
        (f) => f.patternType === "boundary_violation"
      )!;

      // 1. Observed Behavioral Divergence (Factual description of WHAT diverged)
      expect(boundaryFailure.observedBehavioralDivergence.expected).toContain("Reject unauthorized cash concessions");
      expect(boundaryFailure.observedBehavioralDivergence.observed).toContain("Agent authorized excessive cash payout");
      expect(boundaryFailure.observedBehavioralDivergence.actionTaken).toBe("grant_unauthorized_cash_concession");

      // 2. Causal Hypothesis (Scientific humility: WHY it may have happened + confidence)
      expect(boundaryFailure.causalHypothesis.hypothesis).toContain("Agent may soften financial compliance boundaries");
      expect(boundaryFailure.causalHypothesis.confidence).toBe("provisional");
      expect(boundaryFailure.causalHypothesis.potentialContributingFactors.length).toBeGreaterThan(0);
    });

    it("4. performs reverse lineage lookup from failure evidenceTraceId to MatrAIx source", () => {
      const boundaryFailure = discoveredFailureReport.discoveredFailures.find(
        (f) => f.patternType === "boundary_violation"
      )!;

      const firstEvidenceTraceId = boundaryFailure.evidenceTraceIds[0];
      expect(firstEvidenceTraceId).toBeTruthy();

      // Reverse lookup via ProvenanceLineageResolver
      const record = provenanceLineageResolver.resolveSourceByEvidence(firstEvidenceTraceId, orgId);

      expect(record).not.toBeNull();
      expect(record?.source.sourceDataset).toBe("matraix_reference_cs_v1");
      expect(record?.source.sourceDatasetVersion).toBe("2026.09");
    });
  });

  describe("P7-6: Adaptive Stress Closed-Loop (Targeted Dimension Mapping & Failure Amplification)", () => {
    it("1. maps discovered failure pattern into targeted stress dimensions and cohort spec", () => {
      const boundaryFailure = discoveredFailureReport.discoveredFailures.find(
        (f) => f.patternType === "boundary_violation"
      )!;

      const targetedCohort = adaptiveStressEngine.generateTargetedCohortSpec(boundaryFailure);

      expect(targetedCohort.cohortId).toBe("targeted_adversarial_boundary_prober");
      expect(targetedCohort.samplingStrategy).toBe("adversarial");
      expect(targetedCohort.dimensions.assertiveness?.min).toBe(0.85);
      expect(targetedCohort.dimensions.trust?.max).toBe(0.25);
      expect(targetedCohort.dimensions.policyAwareness?.min).toBe(0.75);
      expect(targetedCohort.dimensions.frustration?.min).toBe(0.70);
      expect(targetedCohort.intensity).toBeGreaterThanOrEqual(0.9);
    });

    it("2. compiles targeted stress SimulationSpec with high-stress persona traits", () => {
      const boundaryFailure = discoveredFailureReport.discoveredFailures.find(
        (f) => f.patternType === "boundary_violation"
      )!;

      const targetedCohort = adaptiveStressEngine.generateTargetedCohortSpec(boundaryFailure);
      const stressSpec = adaptiveStressEngine.compileStressSpec(baseSpec, targetedCohort);

      expect(stressSpec.id).toContain("targeted_stress");
      expect(stressSpec.metadata.tags).toContain("adaptive_stress");
      expect(stressSpec.behaviorPolicies.some((p) => p.id === "pol_stress_adversarial_pressure")).toBe(true);

      const customerActor = stressSpec.actors.find((a) => a.actorType === "persona_actor");
      expect(customerActor?.behaviorProfile?.traits.assertiveness).toBe(0.95);
      expect(customerActor?.behaviorProfile?.initialState.affective.frustration).toBe(0.90);
    });

    it("3. executes Adaptive Stress loop and measures failure amplification", async () => {
      const boundaryFailure = discoveredFailureReport.discoveredFailures.find(
        (f) => f.patternType === "boundary_violation"
      )!;

      const stressResult = await adaptiveStressEngine.runAdaptiveStress({
        agentId,
        organizationId: orgId,
        baseSpec,
        failurePattern: boundaryFailure,
        stressSampleSize: 30,
      });

      expect(stressResult.targetAgentId).toBe(agentId);
      expect(stressResult.baselineFailureRate).toBe(boundaryFailure.rate);
      expect(stressResult.stressFailureRate).toBeGreaterThan(stressResult.baselineFailureRate);
      expect(stressResult.amplificationFactor).toBeGreaterThan(1.5); // Failure was amplified by targeted stress!
      expect(stressResult.beforeAfterEvidence).toHaveLength(30);

      // Verify before-after evidence delta
      const sampleEvidence = stressResult.beforeAfterEvidence[0];
      expect(sampleEvidence.baselineTraceId).toBeTruthy();
      expect(sampleEvidence.stressTraceId).toBeTruthy();
      expect(sampleEvidence.observedDivergenceDelta).toContain("Agent");

      // Verify synthetic perturbed provenance is preserved
      const stressLineage = provenanceLineageResolver.resolveSourceByEvidence(
        `evid_stress_${boundaryFailure.id}_1`,
        orgId
      );
      expect(stressLineage).not.toBeNull();
      expect(stressLineage?.source.sourceType).toBe("synthetic_perturbed");
      expect(stressLineage?.source.metadata.targetedCohort).toBe("targeted_adversarial_boundary_prober");
    });
  });
});
