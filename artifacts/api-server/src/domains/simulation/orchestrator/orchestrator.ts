import type {
  ExperimentSpec,
  ExperimentExecutionReport,
  SimulationSpec,
  SimulationActorSpec,
} from "@workspace/simulation-contract";
import { experimentPlanner } from "./experimentPlanner";
import { ExperimentQueue } from "./queue";
import { WorkerPool } from "./workerPool";
import { CostTracker } from "./costTracker";
import { samplingEngine } from "../../population";

export class ScalableSimulationOrchestrator {
  private queues: Map<string, ExperimentQueue> = new Map();

  async executeExperiment(
    experiment: ExperimentSpec,
    specs: SimulationSpec[]
  ): Promise<ExperimentExecutionReport> {
    const startTime = Date.now();

    // 1. Get or create queue for idempotency
    let queue = this.queues.get(experiment.id);
    if (!queue) {
      queue = new ExperimentQueue();
      const plannedRuns = experimentPlanner.plan(experiment, specs);
      queue.initialize(plannedRuns);
      this.queues.set(experiment.id, queue);
    }

    // 2. Sample population personas to supply worker pool
    const populationSample = samplingEngine.sample({
      strategy: experiment.samplingStrategy,
      sampleSize: experiment.sampleSize,
      baseSeed: experiment.baseSeed,
    });

    // 3. Spawn Worker Pool and execute pending runs
    const workerPool = new WorkerPool({
      queue,
      policy: experiment.executionPolicy,
      specs,
      personas: populationSample.personas,
    });

    await workerPool.processAll();

    // 4. Aggregate cost and throughput KPIs
    const totalDurationMs = Date.now() - startTime;
    const allRuns = queue.getAllRuns();
    const metrics = CostTracker.aggregateMetrics(allRuns, totalDurationMs);

    return {
      experimentId: experiment.id,
      benchmarkId: experiment.benchmarkId,
      ...metrics,
      runs: allRuns,
      completedAt: new Date().toISOString(),
    };
  }

  getExperimentQueue(experimentId: string): ExperimentQueue | undefined {
    return this.queues.get(experimentId);
  }
}

export const scalableSimulationOrchestrator = new ScalableSimulationOrchestrator();
