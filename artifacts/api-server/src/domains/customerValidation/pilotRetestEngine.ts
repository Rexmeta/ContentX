import type { PilotRetestResult, TrajectoryTrace, SimulationSpec } from "@workspace/simulation-contract";
import { MultiLayerEvaluationEngine } from "../evaluation/multiLayerEngine";

export interface ExecuteRetestInput {
  pilotId: string;
  targetFailureId: string;
  targetMetricId: string;
  baselineFailureRate: number;
  spec: SimulationSpec;
  retestTraces: TrajectoryTrace[];
}

export class PilotRetestEngine {
  private evaluationEngine = new MultiLayerEvaluationEngine();

  /**
   * Evaluates hardened candidate traces to verify defect remediation and isolate target recurrence from new failures.
   */
  evaluateRetest(input: ExecuteRetestInput): PilotRetestResult {
    const { pilotId, targetFailureId, targetMetricId, baselineFailureRate, spec, retestTraces } = input;
    const totalRuns = retestTraces.length;

    if (totalRuns === 0) {
      throw new Error("Retest evaluation requires at least 1 retest trace.");
    }

    let targetFailureOccurrences = 0;
    let otherFailureOccurrences = 0;

    for (const trace of retestTraces) {
      const evalResult = this.evaluationEngine.evaluate(spec, trace);

      // Check specific target metric
      const targetMetric = evalResult.metrics.find((m) => m.metric === targetMetricId || m.metric.includes(targetMetricId));
      const isTargetBreached = targetMetric ? targetMetric.score < 80 : evalResult.overallScore < 80;

      if (isTargetBreached) {
        targetFailureOccurrences++;
      } else if (evalResult.overallScore < 80) {
        otherFailureOccurrences++;
      }
    }

    const targetRecurrenceRate = Number((targetFailureOccurrences / totalRuns).toFixed(4));
    const newFailureRate = Number((otherFailureOccurrences / totalRuns).toFixed(4));
    const overallFailureRate = Number(((targetFailureOccurrences + otherFailureOccurrences) / totalRuns).toFixed(4));

    // Retest passes only if target confirmed defect recurrence is exactly 0.0%
    const passed = targetRecurrenceRate === 0.0 && overallFailureRate <= baselineFailureRate;

    return {
      retestId: `retest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pilotId,
      targetFailureId,
      targetMetricId,
      baselineFailureRate,
      retestFailureRate: overallFailureRate,
      targetRecurrenceRate,
      newFailureRate,
      overallFailureRate,
      passed,
      retestedAt: new Date().toISOString(),
    };
  }
}

export const pilotRetestEngine = new PilotRetestEngine();
