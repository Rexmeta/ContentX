import type { ExperimentRunEntry } from "@workspace/simulation-contract";

export class ExperimentQueue {
  private runs: Map<string, ExperimentRunEntry> = new Map();

  initialize(entries: ExperimentRunEntry[]): void {
    for (const entry of entries) {
      if (!this.runs.has(entry.runId)) {
        this.runs.set(entry.runId, entry);
      }
    }
  }

  getPendingRuns(): ExperimentRunEntry[] {
    return Array.from(this.runs.values()).filter(
      (r) => r.state === "pending" || r.state === "retrying" || r.state === "failed"
    );
  }

  getRun(runId: string): ExperimentRunEntry | undefined {
    return this.runs.get(runId);
  }

  getAllRuns(): ExperimentRunEntry[] {
    return Array.from(this.runs.values());
  }

  updateRunState(runId: string, updates: Partial<ExperimentRunEntry>): void {
    const existing = this.runs.get(runId);
    if (existing) {
      this.runs.set(runId, { ...existing, ...updates });
    }
  }
}
