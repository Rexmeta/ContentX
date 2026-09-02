import type {
  SimulationSpec,
  TrajectoryTrace,
  EvaluationResult,
  ReplayMode,
} from "@workspace/simulation-contract";
import { validateSimulationSpec } from "@workspace/simulation-contract";
import { SimulationCompiler, type CompileSimulationInput } from "./compiler";
import { SimulationRuntimeEngine, type SimulationRunResult } from "./runtime/engine";

export class SimulationSpecService {
  private specs: Map<string, SimulationSpec> = new Map();
  private runs: Map<string, SimulationRunResult> = new Map();
  private compiler = new SimulationCompiler();

  createSpec(spec: SimulationSpec): SimulationSpec {
    const report = validateSimulationSpec(spec);
    if (!report.success) {
      throw new Error(`Invalid SimulationSpec: ${report.issues.map((i) => i.message).join(", ")}`);
    }
    this.specs.set(spec.id, spec);
    return spec;
  }

  getSpec(id: string): SimulationSpec | undefined {
    return this.specs.get(id);
  }

  listSpecs(): SimulationSpec[] {
    return Array.from(this.specs.values());
  }

  compileSpec(input: CompileSimulationInput): SimulationSpec {
    const spec = this.compiler.compile(input);
    this.specs.set(spec.id, spec);
    return spec;
  }

  async runSpec(specId: string, options: { runId?: string; simulationId?: string } = {}): Promise<SimulationRunResult> {
    const spec = this.specs.get(specId);
    if (!spec) {
      throw new Error(`SimulationSpec "${specId}" not found`);
    }
    const engine = new SimulationRuntimeEngine(spec);
    const result = await engine.run(options);
    this.runs.set(result.runId, result);
    return result;
  }

  getRun(runId: string): SimulationRunResult | undefined {
    return this.runs.get(runId);
  }

  listRuns(simulationId?: string): SimulationRunResult[] {
    const all = Array.from(this.runs.values());
    if (simulationId) {
      return all.filter((r) => r.simulationId === simulationId);
    }
    return all;
  }

  getTrajectory(runId: string): TrajectoryTrace | undefined {
    return this.runs.get(runId)?.trace;
  }

  getEvaluation(runId: string): EvaluationResult | undefined {
    return this.runs.get(runId)?.evaluation;
  }

  async replayRun(runId: string, mode: ReplayMode): Promise<SimulationRunResult> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run "${runId}" not found for replay`);
    }
    if (mode === "recorded") {
      const replayedId = `${runId}_replay_${Date.now()}`;
      const replayedTrace: TrajectoryTrace = {
        ...run.trace,
        runId: replayedId,
        events: structuredClone(run.trace.events),
        completedAt: new Date().toISOString(),
      };
      const replayedResult: SimulationRunResult = {
        simulationId: run.simulationId,
        runId: replayedId,
        specId: run.specId,
        trace: replayedTrace,
        evaluation: { ...run.evaluation, runId: replayedId },
        outcome: run.outcome,
        reproducibility: {
          mode: "exact",
          guarantee: "exact",
          reproducibilityKey: `exact_trace_${runId}`,
          varianceNote: "100% exact state transition and trajectory replay from recorded trace.",
        },
      };
      this.runs.set(replayedResult.runId, replayedResult);
      return replayedResult;
    }

    return this.runSpec(run.specId, { simulationId: run.simulationId });
  }
}

export const simulationSpecService = new SimulationSpecService();
