import type {
  ExperimentSpec,
  ExperimentRunEntry,
  SimulationSpec,
  SimulationActorSpec,
} from "@workspace/simulation-contract";
import { samplingEngine } from "../../population";

export class ExperimentPlanner {
  /**
   * Plans the combinatorial execution grid:
   * (Specs × Sampled Personas × Target Agents × Repetitions) with deterministic seed derivation.
   */
  plan(experiment: ExperimentSpec, specs: SimulationSpec[]): ExperimentRunEntry[] {
    const runs: ExperimentRunEntry[] = [];
    const baseSeed = experiment.baseSeed ?? 42;
    const repetitions = experiment.repetitions ?? 1;

    // Sample population for this experiment
    const populationSample = samplingEngine.sample({
      strategy: experiment.samplingStrategy,
      sampleSize: experiment.sampleSize,
      baseSeed,
    });

    let runSeq = 0;

    for (const spec of specs) {
      for (const persona of populationSample.personas) {
        for (const agent of experiment.targetAgents) {
          for (let rep = 1; rep <= repetitions; rep++) {
            runSeq++;
            // Deterministic hash seed derivation
            const seed = baseSeed + runSeq * 1013;
            const runId = `run_${experiment.id}_${spec.id}_${persona.id}_${agent.id}_r${rep}`;

            runs.push({
              runId,
              experimentId: experiment.id,
              specId: spec.id,
              personaId: persona.id,
              agentId: agent.id,
              agentName: agent.name,
              provider: agent.agentConfig?.provider ?? "openai",
              seed,
              repetition: rep,
              state: "pending",
              attempts: 0,
              cost: {
                inputTokens: 0,
                outputTokens: 0,
                estimatedCost: 0.0,
                latencyMs: 0,
                provider: agent.agentConfig?.provider ?? "openai",
                model: (agent.agentConfig?.config?.model as string) ?? "gpt-4o",
              },
            });
          }
        }
      }
    }

    return runs;
  }
}

export const experimentPlanner = new ExperimentPlanner();
