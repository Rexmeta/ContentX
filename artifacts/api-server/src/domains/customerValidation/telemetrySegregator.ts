import type {
  SegregatedTelemetryReport,
  ConfusionMatrix,
} from "@workspace/simulation-contract";

export class TelemetrySegregator {
  /**
   * Compiles segregated 4-way telemetry report guaranteeing zero metric bleed across namespaces.
   */
  compileTelemetry(input: {
    platform: {
      orchestrationLatencies: number[];
      evalLatencies: number[];
      throughput: number;
      platformCostUSD: number;
    };
    agent: {
      inferenceLatencies: number[];
      networkLatencies: number[];
      toolLatencies: number[];
      timeouts: number;
      httpErrors: number;
      totalCalls: number;
    };
    evaluator: {
      goldSetSampleSize: number;
      expertCount: number;
      multiRaterCoverage: number;
      consensusCoverage: number;
      pearsonR: number;
      cohensKappa: number;
      mae: number;
      bias: number;
      judgeLatencies: number[];
      judgeCostUSD: number;
      calibrationStatus: "CALIBRATED" | "PROVISIONAL" | "FAILED";
      confusionMatrix: ConfusionMatrix;
    };
    customer: {
      failuresDiscovered: number;
      failuresCustomerConfirmed: number;
      failuresRemediated: number;
      targetFailureRecurrenceRateOnRetest: number;
    };
  }): SegregatedTelemetryReport {
    const calcPercentiles = (arr: number[]) => {
      if (!arr || arr.length === 0) return { p50: 0, p95: 0, p99: 0 };
      const sorted = [...arr].sort((a, b) => a - b);
      const p = (pct: number) => sorted[Math.min(Math.floor(sorted.length * pct), sorted.length - 1)];
      return {
        p50: p(0.5),
        p95: p(0.95),
        p99: p(0.99),
      };
    };

    const totalCalls = Math.max(input.agent.totalCalls, 1);

    return {
      platformTelemetry: {
        orchestrationLatencyMs: calcPercentiles(input.platform.orchestrationLatencies),
        evaluationLatencyMs: calcPercentiles(input.platform.evalLatencies),
        throughputSimulationsPerSec: input.platform.throughput,
        platformCostUSD: Number(input.platform.platformCostUSD.toFixed(4)),
      },
      agentTelemetry: {
        inferenceLatencyMs: calcPercentiles(input.agent.inferenceLatencies),
        networkTransportLatencyMs: calcPercentiles(input.agent.networkLatencies),
        toolExecutionLatencyMs: calcPercentiles(input.agent.toolLatencies),
        timeoutRate: Number((input.agent.timeouts / totalCalls).toFixed(4)),
        httpErrorRate: Number((input.agent.httpErrors / totalCalls).toFixed(4)),
      },
      evaluatorQuality: {
        goldSetSampleSize: input.evaluator.goldSetSampleSize,
        expertCount: input.evaluator.expertCount,
        multiRaterCoverage: input.evaluator.multiRaterCoverage,
        consensusCoverage: input.evaluator.consensusCoverage,
        pearsonR: input.evaluator.pearsonR,
        cohensKappaJudgeVsHuman: input.evaluator.cohensKappa,
        mae: input.evaluator.mae,
        bias: input.evaluator.bias,
        judgeLatencyMs: calcPercentiles(input.evaluator.judgeLatencies),
        judgeCostUSD: Number(input.evaluator.judgeCostUSD.toFixed(4)),
        calibrationStatus: input.evaluator.calibrationStatus,
        confusionMatrix: input.evaluator.confusionMatrix,
      },
      customerBusinessValue: {
        failuresDiscovered: input.customer.failuresDiscovered,
        failuresCustomerConfirmed: input.customer.failuresCustomerConfirmed,
        confirmationRate: input.customer.failuresDiscovered > 0
          ? Number((input.customer.failuresCustomerConfirmed / input.customer.failuresDiscovered).toFixed(2))
          : 1.0,
        failuresRemediatedInHardenedVersion: input.customer.failuresRemediated,
        targetFailureRecurrenceRateOnRetest: Number(input.customer.targetFailureRecurrenceRateOnRetest.toFixed(4)),
      },
    };
  }
}

export const telemetrySegregator = new TelemetrySegregator();
