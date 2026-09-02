import type { RunCostMetrics, ExperimentRunEntry } from "@workspace/simulation-contract";

export interface ProviderPricing {
  inputPer1k: number;
  outputPer1k: number;
}

export class CostTracker {
  private static pricingTable: Record<string, ProviderPricing> = {
    openai: { inputPer1k: 0.0025, outputPer1k: 0.01 },
    anthropic: { inputPer1k: 0.003, outputPer1k: 0.015 },
    google: { inputPer1k: 0.0001, outputPer1k: 0.0004 },
    http: { inputPer1k: 0.001, outputPer1k: 0.002 },
    mock: { inputPer1k: 0.0005, outputPer1k: 0.001 },
  };

  static calculateRunCost(
    provider: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs: number,
    model: string = "default"
  ): RunCostMetrics {
    const pricing = this.pricingTable[provider.toLowerCase()] ?? this.pricingTable.openai;
    const cost =
      (inputTokens / 1000) * pricing.inputPer1k +
      (outputTokens / 1000) * pricing.outputPer1k;

    return {
      inputTokens,
      outputTokens,
      estimatedCost: Number(cost.toFixed(6)),
      latencyMs,
      provider,
      model,
    };
  }

  static aggregateMetrics(runs: ExperimentRunEntry[], totalDurationMs: number) {
    const succeeded = runs.filter((r) => r.state === "succeeded");
    const failed = runs.filter((r) => r.state === "failed");

    const totalCost = runs.reduce((sum, r) => sum + (r.cost?.estimatedCost ?? 0), 0);
    const validRate = runs.length > 0 ? Number((succeeded.length / runs.length).toFixed(4)) : 0;
    const costPer1k = runs.length > 0 ? Number(((totalCost / runs.length) * 1000).toFixed(2)) : 0;

    const latencies = runs
      .map((r) => r.cost?.latencyMs ?? 0)
      .filter((l) => l > 0)
      .sort((a, b) => a - b);

    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));

    const latencyP50 = latencies[p50Index] ?? 0;
    const latencyP95 = latencies[p95Index] ?? 0;

    const durationMinutes = Math.max(0.001, totalDurationMs / 60000);
    const runsPerMinute = Number((runs.length / durationMinutes).toFixed(1));

    return {
      totalPlannedRuns: runs.length,
      succeededRuns: succeeded.length,
      failedRuns: failed.length,
      totalDurationMs,
      runsPerMinute,
      totalCostUSD: Number(totalCost.toFixed(4)),
      costPer1kRunsUSD: costPer1k,
      latencyP50Ms: latencyP50,
      latencyP95Ms: latencyP95,
      validRunRate: validRate,
    };
  }
}
