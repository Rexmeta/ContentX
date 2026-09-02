import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import app from "../../app";
import type {
  SimulationSpec,
  SimulationActorSpec,
  ExperimentSpec,
} from "@workspace/simulation-contract";
import { experimentPlanner } from "../simulation/orchestrator/experimentPlanner";
import { scalableSimulationOrchestrator } from "../simulation/orchestrator/orchestrator";
import { adaptiveLoopService } from "../simulation/adaptiveLoopService";
import { datasetPackageManager } from "../simulation/datasetPackage";
import { simulationSpecService } from "../simulation/specService";

describe("P2-3 ~ P2-6 Scalable Simulation Orchestrator, Dataset Package & Adaptive Closed-Loop Suite", () => {
  const rootCandidates = [
    resolve(__dirname, "../../../../../examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "../../examples/golden/customer-service/simulation-spec.json"),
  ];
  const goldenSpecPath = rootCandidates.find((p) => existsSync(p)) || rootCandidates[0];

  let goldenSpec: SimulationSpec;

  const targetAgent: SimulationActorSpec = {
    id: "agent_gpt4o_cs",
    name: "GPT-4o Customer Service Agent",
    role: "support_agent",
    actorType: "ai_agent_target",
    agentConfig: {
      provider: "openai",
      config: { model: "gpt-4o", profile: "gpt-profile" },
    },
  };

  beforeEach(() => {
    const raw = readFileSync(goldenSpecPath, "utf-8");
    goldenSpec = JSON.parse(raw) as SimulationSpec;
    simulationSpecService.createSpec(goldenSpec);
  });

  it("1. verifies Deterministic Seed Allocation and Grid Planning", () => {
    const experiment: ExperimentSpec = {
      id: "exp_det_001",
      benchmarkId: "bench_det_001",
      name: "Deterministic Seed Test",
      specIds: [goldenSpec.id],
      targetAgents: [targetAgent],
      samplingStrategy: "stratified",
      sampleSize: 5,
      repetitions: 2,
      baseSeed: 12345,
      evaluatorVersion: "2.0.0-multi-layer",
      executionPolicy: {
        concurrencyByProvider: { openai: 10 },
        maxRetries: 3,
        retryBackoffMs: 50,
        timeoutMs: 10000,
      },
      createdAt: new Date().toISOString(),
    };

    const plan1 = experimentPlanner.plan(experiment, [goldenSpec]);
    const plan2 = experimentPlanner.plan(experiment, [goldenSpec]);

    // 1 spec * 5 personas * 1 agent * 2 repetitions = 10 runs
    expect(plan1).toHaveLength(10);
    expect(plan2).toHaveLength(10);

    for (let i = 0; i < plan1.length; i++) {
      expect(plan1[i].runId).toBe(plan2[i].runId);
      expect(plan1[i].seed).toBe(plan2[i].seed);
      expect(plan1[i].personaId).toBe(plan2[i].personaId);
    }
  });

  it("2. executes experiment via Scalable Orchestrator with cost tracking and idempotent resume", async () => {
    const experiment: ExperimentSpec = {
      id: "exp_orch_001",
      benchmarkId: "bench_orch_001",
      name: "Orchestrator Cost & Concurrency Test",
      specIds: [goldenSpec.id],
      targetAgents: [targetAgent],
      samplingStrategy: "stratified",
      sampleSize: 4,
      repetitions: 1,
      baseSeed: 777,
      evaluatorVersion: "2.0.0-multi-layer",
      executionPolicy: {
        concurrencyByProvider: { mock: 20, openai: 10 },
        maxRetries: 2,
        retryBackoffMs: 20,
        timeoutMs: 5000,
      },
      createdAt: new Date().toISOString(),
    };

    // First Execution
    const report = await scalableSimulationOrchestrator.executeExperiment(experiment, [goldenSpec]);

    expect(report.totalPlannedRuns).toBe(4);
    expect(report.succeededRuns).toBe(4);
    expect(report.failedRuns).toBe(0);
    expect(report.validRunRate).toBe(1.0);
    expect(report.totalCostUSD).toBeGreaterThan(0);
    expect(report.costPer1kRunsUSD).toBeGreaterThan(0);
    expect(report.runsPerMinute).toBeGreaterThan(0);

    // Idempotency: Re-executing same experiment immediately finishes with 0 extra runs needed
    const report2 = await scalableSimulationOrchestrator.executeExperiment(experiment, [goldenSpec]);
    expect(report2.succeededRuns).toBe(4);
  });

  it("3. runs the complete Adaptive Benchmark Closed-Loop (Baseline -> Weakness -> Stress Cohort -> Re-Test)", async () => {
    const result = await adaptiveLoopService.runAdaptiveLoop({
      spec: goldenSpec,
      targetAgent,
      baselineSampleSize: 4,
      stressSampleSize: 4,
      stressIntensity: 0.9,
    });

    expect(result.loopId).toBeTruthy();
    expect(result.baselineBenchmark.agents).toHaveLength(1);
    expect(result.adaptiveStressBenchmark.agents).toHaveLength(1);
    expect(result.detectedFailures.length).toBeGreaterThan(0);
    expect(result.differentialReport.executiveFinding).toContain("targeted stress testing");
    expect(result.reproduciblePackage.manifest.checksum).toBeTruthy();
  });

  it("4. exports a complete Benchmark Dataset Package with immutable manifest.json", () => {
    const datasetPackage = datasetPackageManager.buildPackage({
      benchmark: {
        benchmarkId: "bench_pkg_test",
        matrixId: "mat_pkg_test",
        generatedAt: new Date().toISOString(),
        totalSimulations: 5,
        agents: [],
        comparativeRadar: [],
        executiveSummary: "Package test",
      },
      experiments: [],
      experimentReports: [],
      specifications: [goldenSpec],
    });

    expect(datasetPackage.manifest.schemaVersion).toBe("2026.1.0");
    expect(datasetPackage.manifest.isImmutable).toBe(true);
    expect(datasetPackage.manifest.checksum).toHaveLength(64); // SHA-256
    expect(datasetPackage.specifications).toHaveLength(1);
  });

  it("5. verifies HTTP API endpoints (/api/v1/experiments/run, /api/v1/benchmarks/adaptive-loop, /api/v1/benchmarks/:id/package)", async () => {
    // 1. POST /v1/experiments/run
    const expRes = await request(app)
      .post("/api/v1/experiments/run")
      .send({
        experiment: {
          id: "exp_http_001",
          benchmarkId: "bench_http_001",
          name: "HTTP Experiment Test",
          specIds: [goldenSpec.id],
          targetAgents: [targetAgent],
          samplingStrategy: "stratified",
          sampleSize: 3,
          repetitions: 1,
          baseSeed: 999,
        },
        specs: [goldenSpec],
      });

    expect(expRes.status).toBe(201);
    expect(expRes.body.totalPlannedRuns).toBe(3);
    expect(expRes.body.succeededRuns).toBe(3);
    expect(expRes.body.costPer1kRunsUSD).toBeDefined();

    // 2. POST /v1/benchmarks/adaptive-loop
    const loopRes = await request(app)
      .post("/api/v1/benchmarks/adaptive-loop")
      .send({
        spec: goldenSpec,
        targetAgent,
        baselineSampleSize: 3,
        stressSampleSize: 3,
      });

    expect(loopRes.status).toBe(201);
    expect(loopRes.body.differentialReport).toBeDefined();
    expect(loopRes.body.reproduciblePackage.manifest.checksum).toBeDefined();

    // 3. POST /v1/benchmarks/:id/package
    const pkgRes = await request(app)
      .post("/api/v1/benchmarks/bench_http_001/package")
      .send({
        benchmark: {
          benchmarkId: "bench_http_001",
          matrixId: "mat_http_001",
          generatedAt: new Date().toISOString(),
          totalSimulations: 3,
          agents: [],
          comparativeRadar: [],
          executiveSummary: "HTTP package test",
        },
        specifications: [goldenSpec],
      });

    expect(pkgRes.status).toBe(201);
    expect(pkgRes.body.manifest.schemaVersion).toBe("2026.1.0");
    expect(pkgRes.body.manifest.checksum).toHaveLength(64);
  });
});
