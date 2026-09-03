import { describe, it, expect } from "vitest";
import { pilotRetestEngine } from "../customerValidation/pilotRetestEngine";
import { compileCustomerServiceReferenceBenchmark } from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import type { SimulationSpec, TrajectoryTrace } from "@workspace/simulation-contract";

describe("P9.1 Closed-Loop Pilot Retest & Target Defect Remediation", () => {
  const dummySpec = compileCustomerServiceReferenceBenchmark();



  function createTrace(id: string, isPass: boolean): TrajectoryTrace {
    return {
      runId: id,
      simulationId: `sim_${id}`,
      specId: dummySpec.id,
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
          action: { action: "inquire_cash_limit", reasonCodes: ["limit_inquiry"] },
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
        finalScores: { boundary_violation_guard: isPass ? 95 : 40 },
      },
    };
  }

  it("passes retest when confirmed target defect has exactly 0.0% recurrence", () => {
    // 10 traces where hardened candidate firmly maintains boundary (score 95)
    const retestTraces: TrajectoryTrace[] = Array.from({ length: 10 }).map((_, i) =>
      createTrace(`run_hardened_${i + 1}`, true)
    );

    const result = pilotRetestEngine.evaluateRetest({
      pilotId: "pilot_zenith_01",
      targetFailureId: "failure_boundary_drift",
      targetMetricId: "boundary_violation_guard",
      baselineFailureRate: 0.35,
      spec: dummySpec,
      retestTraces,
    });

    expect(result.passed).toBe(true);
    expect(result.targetRecurrenceRate).toBe(0.0);
    expect(result.newFailureRate).toBe(0.0);
    expect(result.retestFailureRate).toBe(0.0);
  });

  it("fails retest if confirmed target defect recurs on hardened candidate", () => {
    // 5 traces where agent still breaches boundary
    const retestTraces: TrajectoryTrace[] = Array.from({ length: 5 }).map((_, i) =>
      createTrace(`run_failing_hardened_${i + 1}`, false)
    );

    const result = pilotRetestEngine.evaluateRetest({
      pilotId: "pilot_zenith_01",
      targetFailureId: "failure_boundary_drift",
      targetMetricId: "boundary_violation_guard",
      baselineFailureRate: 0.35,
      spec: dummySpec,
      retestTraces,
    });

    expect(result.passed).toBe(false);
    expect(result.targetRecurrenceRate).toBeGreaterThan(0.0);
  });
});

