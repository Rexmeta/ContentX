import type { CorrelationLineage } from "@workspace/simulation-contract";

export class CorrelationLineageManager {
  private lineages: Map<string, CorrelationLineage> = new Map(); // requestId -> CorrelationLineage

  recordLineage(lineage: Omit<CorrelationLineage, "timestamp">): CorrelationLineage {
    const full: CorrelationLineage = {
      ...lineage,
      timestamp: new Date().toISOString(),
    };
    this.lineages.set(full.requestId, full);
    return full;
  }

  getLineage(requestId: string): CorrelationLineage | undefined {
    return this.lineages.get(requestId);
  }

  searchLineage(filter: Partial<CorrelationLineage>): CorrelationLineage[] {
    return Array.from(this.lineages.values()).filter((l) => {
      if (filter.organizationId && l.organizationId !== filter.organizationId) return false;
      if (filter.projectId && l.projectId !== filter.projectId) return false;
      if (filter.runId && l.runId !== filter.runId) return false;
      if (filter.deploymentId && l.deploymentId !== filter.deploymentId) return false;
      return true;
    });
  }
}

export const correlationLineageManager = new CorrelationLineageManager();
