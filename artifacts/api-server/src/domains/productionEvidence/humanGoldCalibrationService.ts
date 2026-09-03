import type {
  HumanGoldSet,
  HumanGoldAnnotation,
  CalibrationResult,
  CalibrationStatus,
  SimulationSpec,
  TrajectoryTrace,
} from "@workspace/simulation-contract";
import { MultiLayerEvaluationEngine } from "../evaluation/multiLayerEngine";

export interface CreateGoldSetInput {
  goldSetId: string;
  organizationId: string;
  name: string;
  rubricVersion: string;
  annotations: HumanGoldAnnotation[];
}

export interface RunCalibrationInput {
  goldSet: HumanGoldSet;
  spec: SimulationSpec;
  trajectories: TrajectoryTrace[];
}

export class HumanGoldCalibrationService {
  private goldSets = new Map<string, HumanGoldSet>();
  private evaluationEngine = new MultiLayerEvaluationEngine();

  registerGoldSet(input: CreateGoldSetInput): HumanGoldSet {
    // Quality Controls: Check for duplicates or empty annotations
    if (!input.annotations || input.annotations.length === 0) {
      throw new Error("Gold set must contain at least 1 annotated trajectory.");
    }

    const uniqueKeys = new Set<string>();
    for (const ann of input.annotations) {
      const key = `${ann.trajectoryId}_${ann.expertId}`;
      if (uniqueKeys.has(key)) {
        throw new Error(`Duplicate annotation detected for trajectory ${ann.trajectoryId} by expert ${ann.expertId}`);
      }
      uniqueKeys.add(key);
    }

    const expertIds = new Set(input.annotations.map((a) => a.expertId));

    const goldSet: HumanGoldSet = {
      goldSetId: input.goldSetId,
      organizationId: input.organizationId,
      name: input.name,
      rubricVersion: input.rubricVersion,
      annotations: input.annotations,
      expertCount: expertIds.size,
      createdAt: new Date().toISOString(),
    };

    this.goldSets.set(goldSet.goldSetId, goldSet);
    return goldSet;
  }

  getGoldSet(goldSetId: string): HumanGoldSet | undefined {
    return this.goldSets.get(goldSetId);
  }

  /**
   * Executes Calibration Analysis comparing LLM Judge with Multi-Expert Human Gold Consensus
   */
  calibrateEvaluator(input: RunCalibrationInput): CalibrationResult {
    const { goldSet, spec, trajectories } = input;
    const limitations: string[] = [];

    // 1. Group annotations by trajectoryId to compute multi-expert consensus
    const trajectoryAnnotations = new Map<string, HumanGoldAnnotation[]>();
    for (const ann of goldSet.annotations) {
      const list = trajectoryAnnotations.get(ann.trajectoryId) ?? [];
      list.push(ann);
      trajectoryAnnotations.set(ann.trajectoryId, list);
    }

    const humanConsensusScores: number[] = [];
    const automatedJudgeScores: number[] = [];

    for (const trace of trajectories) {
      const anns = trajectoryAnnotations.get(trace.runId);
      if (!anns || anns.length === 0) continue;

      // Calculate consensus score (mean of expert annotations)
      const consensus = anns.reduce((sum, a) => sum + a.overallScore, 0) / anns.length;
      humanConsensusScores.push(consensus);

      // Run automated evaluation engine
      const evalResult = this.evaluationEngine.evaluate(spec, trace);
      automatedJudgeScores.push(evalResult.overallScore);
    }

    const sampleSize = humanConsensusScores.length;
    if (sampleSize === 0) {
      return {
        calibrationRunId: `calib_${Date.now()}`,
        goldSetId: goldSet.goldSetId,
        evaluatorVersion: "2.0.0-multi-layer",
        rubricVersion: goldSet.rubricVersion,
        sampleSize: 0,
        expertCount: goldSet.expertCount,
        pearsonR: 0,
        cohensKappa: 0,
        mae: 0,
        bias: 0,
        calibrationStatus: "FAILED",
        criteriaMet: false,
        calculatedAt: new Date().toISOString(),
        limitations: ["No matching trajectories found between gold set annotations and input traces."],
      };
    }

    // 2. Statistical Computations
    const pearsonR = this.calculatePearsonCorrelation(humanConsensusScores, automatedJudgeScores);
    const cohensKappa = this.calculateCohensKappa(humanConsensusScores, automatedJudgeScores);
    const mae = this.calculateMAE(humanConsensusScores, automatedJudgeScores);
    const bias = this.calculateBias(humanConsensusScores, automatedJudgeScores);

    // 3. Evaluate Acceptance Criteria
    // CALIBRATED requires: sampleSize >= 20, pearsonR >= 0.90, cohensKappa >= 0.85, MAE <= 5.0
    let calibrationStatus: CalibrationStatus = "PROVISIONAL";
    let criteriaMet = false;

    if (sampleSize < 20) {
      limitations.push(`Sample size (${sampleSize}) is below gold threshold (N >= 20). Classified as PROVISIONAL.`);
    }

    if (pearsonR < 0.70) {
      calibrationStatus = "FAILED";
      limitations.push(`Pearson correlation (${pearsonR}) is below minimum acceptable threshold (r >= 0.70).`);
    } else if (sampleSize >= 20 && pearsonR >= 0.90 && cohensKappa >= 0.85 && mae <= 5.0) {
      calibrationStatus = "CALIBRATED";
      criteriaMet = true;
    } else {
      calibrationStatus = "PROVISIONAL";
      limitations.push(`Evaluator meets operational baseline but is not certified as CALIBRATED (Pearson: ${pearsonR}, Kappa: ${cohensKappa}, MAE: ${mae}).`);
    }

    return {
      calibrationRunId: `calib_run_${Date.now()}`,
      goldSetId: goldSet.goldSetId,
      evaluatorVersion: "2.0.0-multi-layer",
      rubricVersion: goldSet.rubricVersion,
      sampleSize,
      expertCount: goldSet.expertCount,
      pearsonR,
      cohensKappa,
      mae,
      bias,
      calibrationStatus,
      criteriaMet,
      calculatedAt: new Date().toISOString(),
      limitations,
    };
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n <= 1) return 1.0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }

    const denominator = Math.sqrt(denomX * denomY);
    if (denominator === 0) return 1.0;
    return Number((numerator / denominator).toFixed(3));
  }

  private calculateCohensKappa(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;

    // Binary decision: Pass (>= 80) vs Fail (< 80)
    let agreeCount = 0;
    let xPass = 0;
    let yPass = 0;

    for (let i = 0; i < n; i++) {
      const xP = x[i] >= 80;
      const yP = y[i] >= 80;
      if (xP === yP) agreeCount++;
      if (xP) xPass++;
      if (yP) yPass++;
    }

    const po = agreeCount / n; // Observed agreement
    const pe = (xPass / n) * (yPass / n) + ((n - xPass) / n) * ((n - yPass) / n); // Expected chance agreement

    if (pe === 1) return 1.0;
    const kappa = (po - pe) / (1 - pe);
    return Number(Math.max(0, Math.min(1, kappa)).toFixed(3));
  }

  private calculateMAE(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;
    const sum = x.reduce((acc, val, i) => acc + Math.abs(val - y[i]), 0);
    return Number((sum / n).toFixed(2));
  }

  private calculateBias(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;
    // Bias = Mean(Judge - Human)
    const sum = y.reduce((acc, val, i) => acc + (val - x[i]), 0);
    return Number((sum / n).toFixed(2));
  }
}

export const humanGoldCalibrationService = new HumanGoldCalibrationService();
