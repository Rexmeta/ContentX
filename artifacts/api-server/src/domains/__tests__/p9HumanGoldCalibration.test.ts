import { describe, it, expect } from "vitest";
import { humanGoldCalibrationService } from "../productionEvidence/humanGoldCalibrationService";
import { compileCustomerServiceReferenceBenchmark } from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import type { HumanGoldAnnotation, TrajectoryTrace } from "@workspace/simulation-contract";

describe("P9 Gate #2: Human Gold Set Calibration & Multi-Rater Engine Suite", () => {
  const spec = compileCustomerServiceReferenceBenchmark();

  function generateMockTrace(id: string, score: number): TrajectoryTrace {
    const isPass = score >= 80;
    return {
      runId: id,
      simulationId: `sim_${id}`,
      specId: spec.id,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      events: [
        {
          id: `evt_${id}_1`,
          simulationId: `sim_${id}`,
          runId: id,
          turn: 1,
          actorId: "actor_customer",
          actorType: "persona_actor",
          correlationId: `corr_${id}`,
          source: { type: "system" },
          stateBefore: { affective: {}, relational: {}, cognitive: {} },
          action: { action: "inquire_return", reasonCodes: ["return_window_inquiry"] },
          stateAfter: { affective: {}, relational: {}, cognitive: {} },
          timestamp: new Date().toISOString(),
        },
        {
          id: `evt_${id}_2`,
          simulationId: `sim_${id}`,
          runId: id,
          turn: 2,
          actorId: "actor_support_agent",
          actorType: "ai_agent_target",
          correlationId: `corr_${id}`,
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
    };
  }

  it("1. successfully certifies CALIBRATED when human gold consensus matches LLM judge (N >= 20, r >= 0.90, kappa >= 0.85, MAE <= 5.0)", () => {
    const annotations: HumanGoldAnnotation[] = [];
    const traces: TrajectoryTrace[] = [];

    // Create 20 trajectories annotated by 3 pseudonymized experts
    for (let i = 1; i <= 20; i++) {
      const trajId = `traj_gold_${String(i).padStart(2, "0")}`;
      const isFail = i % 4 === 0;
      const baseScore = isFail ? 42 : 92; // 5 low scores, 15 high scores
      traces.push(generateMockTrace(trajId, baseScore));

      for (const expertId of ["exp_fintech_lead_01", "exp_legal_auditor_02", "exp_cx_specialist_03"]) {
        annotations.push({
          annotationId: `ann_${trajId}_${expertId}`,
          trajectoryId: trajId,
          scenarioId: "policy_boundary_cash_limit",
          cohortId: "boundary_tester_customer",
          rubricVersion: "1.0.0",
          dimensionScores: { policy_compliance: baseScore, empathy: 85 },
          overallScore: baseScore,
          expertId,
          annotationVersion: "1.0.0",
          annotationTimestamp: new Date().toISOString(),
        });
      }
    }

    const goldSet = humanGoldCalibrationService.registerGoldSet({
      goldSetId: "gold_set_cs_benchmark_2026",
      organizationId: "org_pilot_client",
      name: "Customer Service 20-Trajectory Multi-Expert Gold Standard",
      rubricVersion: "1.0.0",
      annotations,
    });

    expect(goldSet.expertCount).toBe(3);
    expect(goldSet.annotations.length).toBe(60);

    const calibrationResult = humanGoldCalibrationService.calibrateEvaluator({
      goldSet,
      spec,
      trajectories: traces,
    });

    expect(calibrationResult.sampleSize).toBe(20);
    expect(calibrationResult.expertCount).toBe(3);
    expect(calibrationResult.pearsonR).toBeGreaterThanOrEqual(0.90);
    expect(calibrationResult.cohensKappa).toBeGreaterThanOrEqual(0.85);
    expect(calibrationResult.mae).toBeLessThanOrEqual(5.0);
    expect(calibrationResult.calibrationStatus).toBe("CALIBRATED");
    expect(calibrationResult.criteriaMet).toBe(true);
  });

  it("2. assigns PROVISIONAL when sample size is below gold threshold (N < 20)", () => {
    const smallAnnotations: HumanGoldAnnotation[] = [];
    const smallTraces: TrajectoryTrace[] = [];

    for (let i = 1; i <= 5; i++) {
      const trajId = `traj_small_${i}`;
      smallTraces.push(generateMockTrace(trajId, 90));
      smallAnnotations.push({
        annotationId: `ann_small_${i}`,
        trajectoryId: trajId,
        scenarioId: "policy_boundary_cash_limit",
        cohortId: "boundary_tester_customer",
        rubricVersion: "1.0.0",
        dimensionScores: { policy_compliance: 90 },
        overallScore: 90,
        expertId: "exp_lone_reviewer",
        annotationVersion: "1.0.0",
        annotationTimestamp: new Date().toISOString(),
      });
    }

    const smallGoldSet = humanGoldCalibrationService.registerGoldSet({
      goldSetId: "gold_set_pilot_small",
      organizationId: "org_pilot_client",
      name: "Pilot Small Sample Gold Set",
      rubricVersion: "1.0.0",
      annotations: smallAnnotations,
    });

    const result = humanGoldCalibrationService.calibrateEvaluator({
      goldSet: smallGoldSet,
      spec,
      trajectories: smallTraces,
    });

    expect(result.calibrationStatus).toBe("PROVISIONAL");
    expect(result.limitations.some((l) => l.includes("below gold threshold"))).toBe(true);
  });

  it("3. rejects calibration with FAILED status if correlation with human gold is weak (r < 0.70)", () => {
    const mismatchedAnnotations: HumanGoldAnnotation[] = [];
    const mismatchedTraces: TrajectoryTrace[] = [];

    for (let i = 1; i <= 20; i++) {
      const trajId = `traj_mismatch_${i}`;
      // Invert human ratings completely relative to agent behavior to force negative/zero correlation
      const humanScore = i % 2 === 0 ? 100 : 20;
      const actualAgentScore = i % 2 === 0 ? 20 : 100;

      mismatchedTraces.push(generateMockTrace(trajId, actualAgentScore));
      mismatchedAnnotations.push({
        annotationId: `ann_mismatch_${i}`,
        trajectoryId: trajId,
        scenarioId: "policy_boundary_cash_limit",
        cohortId: "boundary_tester_customer",
        rubricVersion: "1.0.0",
        dimensionScores: { policy_compliance: humanScore },
        overallScore: humanScore,
        expertId: "exp_adversarial_rater",
        annotationVersion: "1.0.0",
        annotationTimestamp: new Date().toISOString(),
      });
    }

    const badGoldSet = humanGoldCalibrationService.registerGoldSet({
      goldSetId: "gold_set_mismatched",
      organizationId: "org_pilot_client",
      name: "Inverted Gold Set",
      rubricVersion: "1.0.0",
      annotations: mismatchedAnnotations,
    });

    const result = humanGoldCalibrationService.calibrateEvaluator({
      goldSet: badGoldSet,
      spec,
      trajectories: mismatchedTraces,
    });

    expect(result.calibrationStatus).toBe("FAILED");
    expect(result.pearsonR).toBeLessThan(0.70);
  });

  it("4. throws quality control error on duplicate expert annotations or empty gold set", () => {
    expect(() =>
      humanGoldCalibrationService.registerGoldSet({
        goldSetId: "gold_empty",
        organizationId: "org_test",
        name: "Empty Set",
        rubricVersion: "1.0.0",
        annotations: [],
      })
    ).toThrow(/must contain at least 1 annotated trajectory/);

    expect(() =>
      humanGoldCalibrationService.registerGoldSet({
        goldSetId: "gold_dup",
        organizationId: "org_test",
        name: "Duplicate Set",
        rubricVersion: "1.0.0",
        annotations: [
          {
            annotationId: "ann_1",
            trajectoryId: "traj_01",
            scenarioId: "s1",
            cohortId: "c1",
            rubricVersion: "1.0.0",
            dimensionScores: { s: 90 },
            overallScore: 90,
            expertId: "exp_01",
            annotationVersion: "1.0.0",
            annotationTimestamp: new Date().toISOString(),
          },
          {
            annotationId: "ann_2",
            trajectoryId: "traj_01",
            scenarioId: "s1",
            cohortId: "c1",
            rubricVersion: "1.0.0",
            dimensionScores: { s: 92 },
            overallScore: 92,
            expertId: "exp_01", // Duplicate for same trajectory
            annotationVersion: "1.0.0",
            annotationTimestamp: new Date().toISOString(),
          },
        ],
      })
    ).toThrow(/Duplicate annotation detected/);
  });
});
