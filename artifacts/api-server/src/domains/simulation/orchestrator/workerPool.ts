import type {
  ExperimentRunEntry,
  ExecutionPolicy,
  SimulationSpec,
  SimulationActorSpec,
} from "@workspace/simulation-contract";
import { SimulationRuntimeEngine } from "../runtime/engine";
import { CostTracker } from "./costTracker";
import type { ExperimentQueue } from "./queue";

export class WorkerPool {
  private queue: ExperimentQueue;
  private policy: ExecutionPolicy;
  private specs: Map<string, SimulationSpec>;
  private personas: Map<string, SimulationActorSpec>;
  private activeWorkersByProvider: Map<string, number> = new Map();

  constructor(options: {
    queue: ExperimentQueue;
    policy: ExecutionPolicy;
    specs: SimulationSpec[];
    personas: SimulationActorSpec[];
  }) {
    this.queue = options.queue;
    this.policy = options.policy;
    this.specs = new Map(options.specs.map((s) => [s.id, s]));
    this.personas = new Map(options.personas.map((p) => [p.id, p]));
  }

  async processAll(): Promise<void> {
    const pending = this.queue.getPendingRuns();
    const batchPromises = pending.map((runEntry) => this.executeRunEntry(runEntry));
    await Promise.all(batchPromises);
  }

  private async executeRunEntry(runEntry: ExperimentRunEntry): Promise<void> {
    const maxRetries = this.policy.maxRetries ?? 3;
    const baseBackoff = this.policy.retryBackoffMs ?? 50;

    const baseSpec = this.specs.get(runEntry.specId);
    const persona = this.personas.get(runEntry.personaId);

    if (!baseSpec || !persona) {
      this.queue.updateRunState(runEntry.runId, {
        state: "failed",
        error: `Missing spec (${runEntry.specId}) or persona (${runEntry.personaId})`,
      });
      return;
    }

    const agentSpec = {
      id: runEntry.agentId,
      name: runEntry.agentName,
      role: "support_agent",
      actorType: "ai_agent_target" as const,
      agentConfig: {
        provider: runEntry.provider,
        config: { model: runEntry.cost?.model ?? "gpt-4o" },
      },
    };

    // Construct execution spec
    const tailoredSpec: SimulationSpec = {
      ...baseSpec,
      actors: [
        persona,
        agentSpec,
      ],
    };

    let attempt = runEntry.attempts;
    let succeeded = false;

    while (attempt <= maxRetries && !succeeded) {
      attempt++;
      this.queue.updateRunState(runEntry.runId, {
        state: attempt > 1 ? "retrying" : "running",
        attempts: attempt,
        startedAt: new Date().toISOString(),
      });

      const startTime = Date.now();
      try {
        const engine = new SimulationRuntimeEngine(tailoredSpec);
        const result = await engine.run({
          runId: runEntry.runId,
          simulationId: `sim_${runEntry.experimentId}`,
        });

        const latencyMs = Date.now() - startTime;
        const totalEvents = result.trace.events.length;
        const inputTokens = totalEvents * 120 + 250;
        const outputTokens = totalEvents * 45 + 50;

        const costMetrics = CostTracker.calculateRunCost(
          runEntry.provider,
          inputTokens,
          outputTokens,
          latencyMs,
          runEntry.cost?.model
        );

        this.queue.updateRunState(runEntry.runId, {
          state: "succeeded",
          attempts: attempt,
          cost: costMetrics,
          completedAt: new Date().toISOString(),
          runResult: result,
        });
        succeeded = true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Execution error";
        if (attempt <= maxRetries) {
          // Exponential backoff
          await new Promise((res) => setTimeout(res, baseBackoff * Math.pow(2, attempt - 1)));
        } else {
          const latencyMs = Date.now() - startTime;
          this.queue.updateRunState(runEntry.runId, {
            state: "failed",
            attempts: attempt,
            error: message,
            cost: { ...runEntry.cost, latencyMs },
            completedAt: new Date().toISOString(),
          });
        }
      }
    }
  }
}
