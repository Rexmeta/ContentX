import type {
  SimulationSpec,
  SimulationActorSpec,
} from "@workspace/simulation-contract";
import { SimulationRuntimeEngine, type SimulationRunResult } from "./runtime/engine";

export interface MatrixExecutionConfig {
  specs: SimulationSpec[];
  targetAgents: SimulationActorSpec[];
  repetitions?: number;
  baseSeed?: number;
}

export interface MatrixRunEntry {
  specId: string;
  agentId: string;
  agentName: string;
  provider: string;
  repetitionIndex: number;
  seed: number;
  runResult: SimulationRunResult;
}

export interface MatrixExecutionResult {
  matrixId: string;
  totalRuns: number;
  completedAt: string;
  runs: MatrixRunEntry[];
}

export class SimulationMatrixRunner {
  async runMatrix(config: MatrixExecutionConfig): Promise<MatrixExecutionResult> {
    const matrixId = `matrix_${Date.now()}`;
    const repetitions = config.repetitions ?? 1;
    const baseSeed = config.baseSeed ?? 42;
    const results: MatrixRunEntry[] = [];

    let runSeq = 0;

    for (const spec of config.specs) {
      for (const agentSpec of config.targetAgents) {
        for (let rep = 1; rep <= repetitions; rep++) {
          runSeq++;
          const seed = baseSeed + runSeq * 100;
          const runId = `run_${matrixId}_${agentSpec.id}_${rep}`;
          const simulationId = `sim_${matrixId}_${spec.id}`;

          // Create a tailored spec instance with the target agent injected
          const tailoredSpec: SimulationSpec = {
            ...spec,
            actors: [
              ...spec.actors.filter((a) => a.actorType !== "ai_agent_target"),
              agentSpec,
            ],
          };

          const engine = new SimulationRuntimeEngine(tailoredSpec);
          const runResult = await engine.run({ runId, simulationId });

          results.push({
            specId: spec.id,
            agentId: agentSpec.id,
            agentName: agentSpec.name,
            provider: agentSpec.agentConfig?.provider ?? "openai",
            repetitionIndex: rep,
            seed,
            runResult,
          });
        }
      }
    }

    return {
      matrixId,
      totalRuns: results.length,
      completedAt: new Date().toISOString(),
      runs: results,
    };
  }
}

export const simulationMatrixRunner = new SimulationMatrixRunner();
