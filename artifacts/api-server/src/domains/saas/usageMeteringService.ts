import type { UsageMetrics } from "@workspace/simulation-contract";

export class UsageMeteringService {
  private usageMap: Map<string, UsageMetrics> = new Map(); // orgId_period -> UsageMetrics

  private getKey(orgId: string, period?: string): string {
    const p = period ?? new Date().toISOString().substring(0, 7); // e.g. "2026-09"
    return `${orgId}_${p}`;
  }

  getUsage(orgId: string, period?: string): UsageMetrics {
    const key = this.getKey(orgId, period);
    const p = period ?? new Date().toISOString().substring(0, 7);
    const existing = this.usageMap.get(key);
    if (existing) return existing;

    const fresh: UsageMetrics = {
      organizationId: orgId,
      period: p,
      simulationRuns: 0,
      simulationRunsQuota: 50000,
      llmTokens: 0,
      evaluationRuns: 0,
      storageBytes: 1024 * 1024 * 10, // 10MB base
      apiRequests: 0,
    };
    this.usageMap.set(key, fresh);
    return fresh;
  }

  recordUsage(orgId: string, delta: Partial<Omit<UsageMetrics, "organizationId" | "period">>): UsageMetrics {
    const usage = this.getUsage(orgId);
    if (delta.simulationRuns) usage.simulationRuns += delta.simulationRuns;
    if (delta.llmTokens) usage.llmTokens += delta.llmTokens;
    if (delta.evaluationRuns) usage.evaluationRuns += delta.evaluationRuns;
    if (delta.storageBytes) usage.storageBytes += delta.storageBytes;
    if (delta.apiRequests) usage.apiRequests += delta.apiRequests;

    return usage;
  }

  hasQuota(orgId: string, runsNeeded: number = 1): boolean {
    const usage = this.getUsage(orgId);
    return usage.simulationRuns + runsNeeded <= usage.simulationRunsQuota;
  }
}

export const usageMeteringService = new UsageMeteringService();
