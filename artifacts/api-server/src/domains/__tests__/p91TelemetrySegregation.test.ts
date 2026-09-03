import { describe, it, expect } from "vitest";
import { telemetrySegregator } from "../customerValidation/telemetrySegregator";

describe("P9.1 4-Way Telemetry Segregation", () => {
  it("compiles strictly partitioned telemetry report with zero data bleed", () => {
    const report = telemetrySegregator.compileTelemetry({
      platform: {
        orchestrationLatencies: [35, 40, 42, 50, 65],
        evalLatencies: [10, 12, 14, 16, 20],
        throughput: 30.5,
        platformCostUSD: 1.25,
      },
      agent: {
        inferenceLatencies: [120, 140, 160, 200, 350],
        networkLatencies: [15, 20, 25, 30, 45],
        toolLatencies: [30, 40, 50, 60, 80],
        timeouts: 1,
        httpErrors: 2,
        totalCalls: 100,
      },
      evaluator: {
        goldSetSampleSize: 50,
        expertCount: 3,
        multiRaterCoverage: 0.94,
        consensusCoverage: 0.92,
        pearsonR: 0.92,
        cohensKappa: 0.88,
        mae: 2.3,
        bias: 0.4,
        judgeLatencies: [80, 95, 110, 130, 180],
        judgeCostUSD: 0.75,
        calibrationStatus: "CALIBRATED",
        confusionMatrix: {
          TP: 10,
          TN: 10,
          FP: 0,
          FN: 0,
          precision: 1.0,
          recall: 1.0,
          falsePositiveRate: 0.0,
          falseNegativeRate: 0.0,
          accuracy: 1.0,
          totalEvaluated: 20,
        },
      },
      customer: {
        failuresDiscovered: 4,
        failuresCustomerConfirmed: 3,
        failuresRemediated: 3,
        targetFailureRecurrenceRateOnRetest: 0.0,
      },
    });

    // 1. Platform Telemetry
    expect(report.platformTelemetry.orchestrationLatencyMs.p50).toBe(42);
    expect(report.platformTelemetry.orchestrationLatencyMs.p95).toBe(65);
    expect(report.platformTelemetry.throughputSimulationsPerSec).toBe(30.5);
    expect(report.platformTelemetry.platformCostUSD).toBe(1.25);

    // 2. External Agent Telemetry
    expect(report.agentTelemetry.inferenceLatencyMs.p50).toBe(160);
    expect(report.agentTelemetry.timeoutRate).toBe(0.01);
    expect(report.agentTelemetry.httpErrorRate).toBe(0.02);

    // 3. Evaluator Quality & Cost
    expect(report.evaluatorQuality.judgeLatencyMs.p50).toBe(110);
    expect(report.evaluatorQuality.judgeCostUSD).toBe(0.75);
    expect(report.evaluatorQuality.pearsonR).toBe(0.92);
    expect(report.evaluatorQuality.cohensKappaJudgeVsHuman).toBe(0.88);
    expect(report.evaluatorQuality.multiRaterCoverage).toBe(0.94);

    // 4. Customer Business Value
    expect(report.customerBusinessValue.failuresDiscovered).toBe(4);
    expect(report.customerBusinessValue.failuresCustomerConfirmed).toBe(3);
    expect(report.customerBusinessValue.confirmationRate).toBe(0.75);
    expect(report.customerBusinessValue.targetFailureRecurrenceRateOnRetest).toBe(0.0);
  });
});
