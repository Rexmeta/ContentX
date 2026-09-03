import { describe, it, expect } from "vitest";
import { standardRegressionCorpusService } from "../productionEvidence/standardRegressionCorpusService";
import { compileCustomerServiceReferenceBenchmark } from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import type { TrajectoryTrace } from "@workspace/simulation-contract";

describe("P9 Gate #3: Canonical Regression Corpus (R01~R08) & Confusion Matrix Suite", () => {
  const spec = compileCustomerServiceReferenceBenchmark();

  function buildTraceForCase(caseId: string, isFail: boolean): TrajectoryTrace {
    return {
      runId: `run_${caseId}`,
      simulationId: `sim_${caseId}`,
      specId: spec.id,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      events: [
        {
          id: `evt_${caseId}_1`,
          simulationId: `sim_${caseId}`,
          runId: `run_${caseId}`,
          turn: 1,
          actorId: "actor_customer",
          actorType: "persona_actor",
          correlationId: `corr_${caseId}`,
          source: { type: "system" },
          stateBefore: { affective: {}, relational: {}, cognitive: {} },
          action: { action: "customer_inquiry", reasonCodes: ["test_probe"] },
          stateAfter: { affective: {}, relational: {}, cognitive: {} },
          timestamp: new Date().toISOString(),
        },
        {
          id: `evt_${caseId}_2`,
          simulationId: `sim_${caseId}`,
          runId: `run_${caseId}`,
          turn: 2,
          actorId: "actor_support_agent",
          actorType: "ai_agent_target",
          correlationId: `corr_${caseId}`,
          source: { type: "llm", version: "1.0.0" },
          stateBefore: { affective: {}, relational: {}, cognitive: {} },
          action: isFail
            ? { action: "grant_unauthorized_cash_concession", reasonCodes: ["policy_boundary_exceeded"] }
            : { action: "deny_refund", reasonCodes: ["standard_terms_enforced", "voucher_offered", "empathy_expressed"] },
          stateAfter: { affective: {}, relational: {}, cognitive: {} },
          timestamp: new Date().toISOString(),
        },
      ],
      outcome: {
        status: "completed",
        turnsUsed: 2,
        finalScores: { policy_compliance: isFail ? 50 : 95 },
      },
    };
  }

  it("1. retrieves canonical R01~R08 corpus with 20 total balanced cases (10 known-good, 10 known-bad)", () => {
    const corpus = standardRegressionCorpusService.getCanonicalCorpus();
    expect(corpus.length).toBe(20);

    const knownGood = corpus.filter((c) => c.isKnownGood);
    const knownBad = corpus.filter((c) => !c.isKnownGood);
    expect(knownGood.length).toBe(10);
    expect(knownBad.length).toBe(10);

    const rCategories = new Set(corpus.map((c) => c.regressionId));
    expect(rCategories.size).toBe(8);
    expect(rCategories.has("R01")).toBe(true);
    expect(rCategories.has("R08")).toBe(true);
  });

  it("2. computes complete Confusion Matrix and statistical regression metrics", () => {
    const corpus = standardRegressionCorpusService.getCanonicalCorpus();
    const traces = corpus.map((c) => ({
      caseId: c.caseId,
      trace: buildTraceForCase(c.caseId, !c.isKnownGood), // Perfectly matching behaviors
    }));

    const result = standardRegressionCorpusService.evaluateCorpus({
      spec,
      traces,
    });

    const cm = result.confusionMatrix;
    expect(cm.totalEvaluated).toBe(20);
    expect(cm.TP).toBe(10);
    expect(cm.TN).toBe(10);
    expect(cm.FP).toBe(0);
    expect(cm.FN).toBe(0);
    expect(cm.precision).toBe(1.0);
    expect(cm.recall).toBe(1.0);
    expect(cm.falsePositiveRate).toBe(0.0);
    expect(cm.falseNegativeRate).toBe(0.0);
    expect(cm.accuracy).toBe(1.0);

    expect(result.criticalRegressionSummary).toContain("detection on tested critical-regression cases");
  });

  it("3. handles zero-denominator edge cases safely without returning NaN", () => {
    // Evaluate an empty trace list
    const result = standardRegressionCorpusService.evaluateCorpus({
      spec,
      traces: [],
    });

    const cm = result.confusionMatrix;
    expect(cm.totalEvaluated).toBe(0);
    expect(Number.isNaN(cm.precision)).toBe(false);
    expect(Number.isNaN(cm.recall)).toBe(false);
    expect(Number.isNaN(cm.falsePositiveRate)).toBe(false);
    expect(Number.isNaN(cm.falseNegativeRate)).toBe(false);
    expect(Number.isNaN(cm.accuracy)).toBe(false);
  });

  it("4. accurately detects false positive blocks and false negative misses", () => {
    const corpus = standardRegressionCorpusService.getCanonicalCorpus();

    // Invert outcomes: 2 known-good falsely fail, 2 known-bad falsely pass
    const traces = corpus.map((c, idx) => {
      let isFail = !c.isKnownGood;
      if (idx === 0) isFail = false; // FN: known-bad falsely passes
      if (idx === 1) isFail = true;  // FP: known-good falsely fails
      return {
        caseId: c.caseId,
        trace: buildTraceForCase(c.caseId, isFail),
      };
    });

    const result = standardRegressionCorpusService.evaluateCorpus({
      spec,
      traces,
    });

    const cm = result.confusionMatrix;
    expect(cm.totalEvaluated).toBe(20);
    expect(cm.FP).toBeGreaterThanOrEqual(1);
    expect(cm.FN).toBeGreaterThanOrEqual(1);
    expect(cm.falsePositiveRate).toBeGreaterThan(0.0);
    expect(cm.falseNegativeRate).toBeGreaterThan(0.0);
  });
});
