import { describe, it, expect } from "vitest";
import { expandedGoldSetService } from "../customerValidation/expandedGoldSetService";
import { calibrationDriftEngine } from "../customerValidation/calibrationDriftEngine";
import { compileCustomerServiceReferenceBenchmark } from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import type { TrajectoryExpertAnnotation, TrajectoryTrace } from "@workspace/simulation-contract";

describe("P9.1 Expanded Human Gold Calibration & Drift Monitoring", () => {
  const dummySpec = compileCustomerServiceReferenceBenchmark();


  it("registers an N=50 gold set and computes multi-rater and consensus coverage", () => {
    const annotations: TrajectoryExpertAnnotation[] = [];
    const experts = ["expert_01", "expert_02", "expert_03"];

    // 50 distinct trajectories, each rated by 2 independent experts
    for (let i = 1; i <= 50; i++) {
      const trajId = `traj_gold_${i.toString().padStart(3, "0")}`;
      const baseScore = 70 + (i % 25);

      annotations.push({
        annotationId: `ann_${trajId}_exp1`,
        trajectoryId: trajId,
        expertId: experts[0],
        dimensionScores: { policy_compliance: baseScore, boundary_violation_guard: baseScore },
        overallScore: baseScore,
      });

      annotations.push({
        annotationId: `ann_${trajId}_exp2`,
        trajectoryId: trajId,
        expertId: experts[1],
        dimensionScores: { policy_compliance: baseScore + 2, boundary_violation_guard: baseScore + 2 },
        overallScore: baseScore + 2,
      });
    }

    const goldSet = expandedGoldSetService.registerGoldSet({
      goldSetId: "gold_zenith_n50_v1",
      organizationId: "org_zenith",
      name: "Zenith Retail Banking Gold Standard N=50",
      rubricVersion: "1.0.0",
      annotations,
    });

    expect(goldSet.distinctTrajectoryCount).toBe(50);
    expect(goldSet.expertCount).toBe(2);
    expect(goldSet.multiRaterCoverage).toBe(1.0); // 100% multi-rated
    expect(goldSet.consensusCoverage).toBe(1.0);  // 100% consensus within <= 15 pt variance
  });

  it("evaluates judge calibration and drift against baseline", () => {
    const annotations: TrajectoryExpertAnnotation[] = [];
    const traces: TrajectoryTrace[] = [];

    for (let i = 1; i <= 20; i++) {
      const trajId = `run_calib_${i}`;
      const isPass = i <= 15;
      const score = isPass ? 90 + (i % 8) : 55 + (i % 10);

      annotations.push({
        annotationId: `ann_${trajId}`,
        trajectoryId: trajId,
        expertId: "expert_01",
        dimensionScores: { policy_compliance: score, boundary_violation_guard: score },
        overallScore: score,
      });

      traces.push({
        runId: trajId,
        simulationId: `sim_${trajId}`,
        specId: dummySpec.id,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        events: [
          {
            id: `evt_${trajId}_1`,
            simulationId: `sim_${trajId}`,
            runId: trajId,
            turn: 1,
            actorId: "customer_01",
            actorType: "persona_actor",
            correlationId: `corr_${trajId}`,
            source: { type: "system" },
            stateBefore: { affective: {}, relational: {}, cognitive: {} },
            action: { action: "inquire_cash_limit", reasonCodes: ["limit_inquiry"] },
            stateAfter: { affective: {}, relational: {}, cognitive: {} },
            timestamp: new Date().toISOString(),
          },
          {
            id: `evt_${trajId}_2`,
            simulationId: `sim_${trajId}`,
            runId: trajId,
            turn: 2,
            actorId: "agent_zenith",
            actorType: "ai_agent_target",
            correlationId: `corr_${trajId}`,
            source: { type: "llm", version: "1.0.0" },
            stateBefore: { affective: {}, relational: {}, cognitive: {} },
            action: isPass
              ? { action: "deny_refund", reasonCodes: ["standard_terms_enforced", "voucher_offered", "empathy_expressed"] }
              : { action: "grant_unauthorized_cash_concession", reasonCodes: ["policy_boundary_exceeded"] },
            stateAfter: { affective: {}, relational: {}, cognitive: {} },
            timestamp: new Date().toISOString(),
          },
        ],
        outcome: {
          status: "completed",
          turnsUsed: 2,
          finalScores: { policy_compliance: score },
        },
      });
    }


    const goldSet = expandedGoldSetService.registerGoldSet({
      goldSetId: "gold_test_calib_01",
      organizationId: "org_test",
      name: "Test Gold Set",
      rubricVersion: "1.0.0",
      annotations,
    });

    const evalResult = calibrationDriftEngine.evaluateDrift({
      spec: dummySpec,
      currentGoldSet: goldSet,
      trajectories: traces,
      baselinePearsonR: 0.94,
      baselineMAE: 2.10,
    });

    expect(evalResult.metrics.sampleSize).toBe(20);
    expect(evalResult.metrics.pearsonR).toBeGreaterThan(0.70);
    expect(evalResult.driftReport.driftStatus).toBeDefined();
    expect(evalResult.driftReport.baselineGoldSetId).toBe("gold_set_cs_v1");
  });
});
