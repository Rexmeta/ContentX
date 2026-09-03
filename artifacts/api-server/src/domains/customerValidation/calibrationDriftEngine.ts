import type {
  ExpandedHumanGoldSet,
  CalibrationDriftReport,
  SimulationSpec,
  TrajectoryTrace,
} from "@workspace/simulation-contract";
import { MultiLayerEvaluationEngine } from "../evaluation/multiLayerEngine";
import { expandedGoldSetService } from "./expandedGoldSetService";

export interface EvaluateCalibrationDriftInput {
  spec: SimulationSpec;
  currentGoldSet: ExpandedHumanGoldSet;
  trajectories: TrajectoryTrace[];
  baselinePearsonR?: number;
  baselineMAE?: number;
  baselineGoldSetId?: string;
}

export class CalibrationDriftEngine {
  private evaluationEngine = new MultiLayerEvaluationEngine();

  evaluateDrift(input: EvaluateCalibrationDriftInput): {
    metrics: {
      pearsonR: number;
      cohensKappa: number;
      mae: number;
      bias: number;
      sampleSize: number;
      calibrationStatus: "CALIBRATED" | "PROVISIONAL" | "FAILED";
    };
    driftReport: CalibrationDriftReport;
  } {
    const { spec, currentGoldSet, trajectories } = input;
    const consensusMap = expandedGoldSetService.getConsensusScores(currentGoldSet.goldSetId);

    const humanScores: number[] = [];
    const judgeScores: number[] = [];

    for (const trace of trajectories) {
      const humanScore = consensusMap.get(trace.runId);
      if (humanScore === undefined) continue;

      const evalResult = this.evaluationEngine.evaluate(spec, trace);
      humanScores.push(humanScore);
      judgeScores.push(evalResult.overallScore);
    }

    const n = humanScores.length;
    if (n === 0) {
      throw new Error("No matching trajectories found between Gold Set and evaluation traces.");
    }

    // 1. Pearson Correlation (r)
    const meanH = humanScores.reduce((a, b) => a + b, 0) / n;
    const meanJ = judgeScores.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let denH = 0;
    let denJ = 0;
    for (let i = 0; i < n; i++) {
      const diffH = humanScores[i] - meanH;
      const diffJ = judgeScores[i] - meanJ;
      num += diffH * diffJ;
      denH += diffH * diffH;
      denJ += diffJ * diffJ;
    }
    const den = Math.sqrt(denH * denJ);
    const pearsonR = den > 0 ? Number((num / den).toFixed(2)) : 1.0;

    // 2. Cohen's Kappa (Judge vs Human Consensus binary pass/fail agreement, cutoff >= 80)
    let agreeCount = 0;
    let hPass = 0;
    let jPass = 0;
    for (let i = 0; i < n; i++) {
      const hP = humanScores[i] >= 80;
      const jP = judgeScores[i] >= 80;
      if (hP === jP) agreeCount++;
      if (hP) hPass++;
      if (jP) jPass++;
    }
    const po = agreeCount / n;
    const pe = (hPass / n) * (jPass / n) + ((n - hPass) / n) * ((n - jPass) / n);
    const cohensKappa = pe < 1.0 ? Number(((po - pe) / (1.0 - pe)).toFixed(2)) : 1.0;

    // 3. MAE and Bias
    const mae = Number((humanScores.reduce((sum, h, i) => sum + Math.abs(judgeScores[i] - h), 0) / n).toFixed(2));
    const bias = Number((humanScores.reduce((sum, h, i) => sum + (judgeScores[i] - h), 0) / n).toFixed(2));

    // Determine calibration status (Smoke N >= 20, Full Customer Validation N >= 50)
    let calibrationStatus: "CALIBRATED" | "PROVISIONAL" | "FAILED" = "PROVISIONAL";
    if (pearsonR < 0.70) {
      calibrationStatus = "FAILED";
    } else if (n >= 20 && pearsonR >= 0.90 && cohensKappa >= 0.85 && mae <= 5.0) {
      calibrationStatus = "CALIBRATED";
    } else {
      calibrationStatus = "PROVISIONAL";
    }

    // 4. Drift Tracking against Baseline
    const baselineR = input.baselinePearsonR ?? 0.94;
    const baselineMAE = input.baselineMAE ?? 2.10;
    const deltaPearsonR = Number((pearsonR - baselineR).toFixed(2));
    const deltaMAE = Number((mae - baselineMAE).toFixed(2));

    let driftStatus: "STABLE" | "DRIFT_WARNING" | "DRIFT_CRITICAL" = "STABLE";
    if (Math.abs(deltaPearsonR) > 0.15 || deltaMAE > 3.0) {
      driftStatus = "DRIFT_CRITICAL";
    } else if (Math.abs(deltaPearsonR) > 0.05 || deltaMAE > 1.5) {
      driftStatus = "DRIFT_WARNING";
    }

    const driftReport: CalibrationDriftReport = {
      driftReportId: `drift_${Date.now()}`,
      baselineGoldSetId: input.baselineGoldSetId ?? "gold_set_cs_v1",
      currentGoldSetId: currentGoldSet.goldSetId,
      baselinePearsonR: baselineR,
      currentPearsonR: pearsonR,
      deltaPearsonR,
      baselineMAE,
      currentMAE: mae,
      deltaMAE,
      driftStatus,
      calculatedAt: new Date().toISOString(),
    };

    return {
      metrics: {
        pearsonR,
        cohensKappa,
        mae,
        bias,
        sampleSize: n,
        calibrationStatus,
      },
      driftReport,
    };
  }
}

export const calibrationDriftEngine = new CalibrationDriftEngine();
