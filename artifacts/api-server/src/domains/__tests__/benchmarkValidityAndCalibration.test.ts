import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import app from "../../app";
import type {
  SimulationSpec,
  SimulationActorSpec,
} from "@workspace/simulation-contract";
import { judgeCalibrationEngine } from "../evaluation/judgeCalibration";
import { discriminativePowerAnalyzer } from "../evaluation/discriminativePower";
import { simulationMatrixRunner } from "../simulation/matrixRunner";
import { benchmarkAggregator } from "../simulation/benchmarkAggregator";
import { SimulationRuntimeEngine } from "../simulation/runtime/engine";
import { simulationSpecService } from "../simulation/specService";

describe("P3 Benchmark Validity, Calibration & Discriminative Power Suite", () => {
  const rootCandidates = [
    resolve(__dirname, "../../../../../examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "../../examples/golden/customer-service/simulation-spec.json"),
  ];
  const goldenSpecPath = rootCandidates.find((p) => existsSync(p)) || rootCandidates[0];

  let goldenSpec: SimulationSpec;

  const targetAgents: SimulationActorSpec[] = [
    {
      id: "agent_strict_compliant",
      name: "Strict Rule-Follower Agent",
      role: "support_agent",
      actorType: "ai_agent_target",
      agentConfig: {
        provider: "openai",
        config: { model: "gpt-4o", profile: "strict" },
      },
    },
    {
      id: "agent_high_empathy",
      name: "High Empathy De-escalator Agent",
      role: "support_agent",
      actorType: "ai_agent_target",
      agentConfig: {
        provider: "anthropic",
        config: { model: "claude-3-5-sonnet", profile: "claude-profile" },
      },
    },
  ];

  beforeEach(() => {
    const raw = readFileSync(goldenSpecPath, "utf-8");
    goldenSpec = JSON.parse(raw) as SimulationSpec;
    simulationSpecService.createSpec(goldenSpec);
  });

  it("1. verifies Replay Guarantee distinction (Exact vs Parameterized Best-Effort)", async () => {
    const engine = new SimulationRuntimeEngine(goldenSpec);

    // Initial Live Run
    const liveRun = await engine.run({ runId: "live_run_001" });
    expect(liveRun.reproducibility.mode).toBe("parameterized");
    expect(liveRun.reproducibility.guarantee).toBe("best_effort");
    expect(liveRun.reproducibility.reproducibilityKey).toContain("live_run_001");

    // Recorded Replay
    const recordedReplay = await engine.replay({ runId: "replay_rec_001", mode: "recorded" });
    expect(recordedReplay.reproducibility.mode).toBe("exact");
    expect(recordedReplay.reproducibility.guarantee).toBe("exact");
    expect(recordedReplay.trace.events).toHaveLength(liveRun.trace.events.length);
  });

  it("2. calibrates LLM Judge against human expert ground truth calibration set", () => {
    const expertDataPoints = [
      { interactionId: "calib_01", scenarioDomain: "retail", humanExpertScore: 92, llmJudgeScore: 90, dimension: "empathy" },
      { interactionId: "calib_02", scenarioDomain: "retail", humanExpertScore: 85, llmJudgeScore: 88, dimension: "empathy" },
      { interactionId: "calib_03", scenarioDomain: "retail", humanExpertScore: 70, llmJudgeScore: 72, dimension: "empathy" },
      { interactionId: "calib_04", scenarioDomain: "retail", humanExpertScore: 95, llmJudgeScore: 94, dimension: "policy" },
      { interactionId: "calib_05", scenarioDomain: "retail", humanExpertScore: 60, llmJudgeScore: 65, dimension: "policy" },
      { interactionId: "calib_06", scenarioDomain: "retail", humanExpertScore: 88, llmJudgeScore: 86, dimension: "escalation" },
      { interactionId: "calib_07", scenarioDomain: "retail", humanExpertScore: 90, llmJudgeScore: 91, dimension: "escalation" },
      { interactionId: "calib_08", scenarioDomain: "retail", humanExpertScore: 78, llmJudgeScore: 80, dimension: "overall" },
      { interactionId: "calib_09", scenarioDomain: "retail", humanExpertScore: 82, llmJudgeScore: 84, dimension: "overall" },
      { interactionId: "calib_10", scenarioDomain: "retail", humanExpertScore: 94, llmJudgeScore: 95, dimension: "overall" },
    ];

    const report = judgeCalibrationEngine.calibrate("expert_gold_set_v1", expertDataPoints);

    expect(report.sampleSize).toBe(10);
    expect(report.status).toBe("calibrated");
    expect(report.humanExpertAgreement).toBeGreaterThanOrEqual(0.85); // 85%+ agreement within tolerance
    expect(report.pearsonCorrelation).toBeGreaterThanOrEqual(0.90);    // r > 0.90
    expect(report.meanAbsoluteError).toBeLessThanOrEqual(4.0);         // MAE <= 4 points
    expect(report.cohenKappa).toBeGreaterThanOrEqual(0.70);
  });

  it("3. evaluates Discriminative Power and Agent Separation Index (Cohen's d)", async () => {
    const matrixResult = await simulationMatrixRunner.runMatrix({
      specs: [goldenSpec],
      targetAgents,
      repetitions: 3,
      baseSeed: 888,
    });

    const report = benchmarkAggregator.aggregate(matrixResult);

    expect(report.validityReport).toBeDefined();
    expect(report.validityReport?.reliabilityScore).toBeGreaterThanOrEqual(80);
    expect(report.validityReport?.validityScore).toBeGreaterThanOrEqual(80);
    expect(report.validityReport?.discriminativePower.isDiscriminative).toBe(true);
    expect(report.validityReport?.discriminativePower.agentSeparationIndex).toBeGreaterThan(0);
    expect(report.validityReport?.overallValidityStatus).toBe("certified_valid");
  });

  it("4. verifies HTTP API endpoints for Judge Calibration and Validity Reports", async () => {
    // 1. POST /v1/evaluations/calibrate
    const calibRes = await request(app)
      .post("/api/v1/evaluations/calibrate")
      .send({
        calibrationSetId: "gold_standard_cs_v1",
        dataPoints: [
          { interactionId: "c1", scenarioDomain: "cs", humanExpertScore: 90, llmJudgeScore: 92, dimension: "empathy" },
          { interactionId: "c2", scenarioDomain: "cs", humanExpertScore: 80, llmJudgeScore: 82, dimension: "policy" },
          { interactionId: "c3", scenarioDomain: "cs", humanExpertScore: 75, llmJudgeScore: 76, dimension: "escalation" },
        ],
      });

    expect(calibRes.status).toBe(200);
    expect(calibRes.body.status).toBe("calibrated");
    expect(calibRes.body.pearsonCorrelation).toBeGreaterThanOrEqual(0.95);

    // 2. POST /v1/benchmarks/run with calibration
    const benchRes = await request(app)
      .post("/api/v1/benchmarks/run")
      .send({
        specIds: [goldenSpec.id],
        targetAgents,
        repetitions: 2,
        calibrationData: [
          { interactionId: "c1", scenarioDomain: "cs", humanExpertScore: 90, llmJudgeScore: 92, dimension: "empathy" },
        ],
      });

    expect(benchRes.status).toBe(201);
    expect(benchRes.body.validityReport).toBeDefined();
    expect(benchRes.body.validityReport.reliabilityScore).toBeGreaterThanOrEqual(80);
  });
});
