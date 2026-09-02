import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import app from "../../app";
import type {
  SimulationSpec,
  SimulationActorSpec,
} from "@workspace/simulation-contract";
import {
  DimensionRegistry,
  CohortGenerator,
  samplingEngine,
  coverageAnalyzer,
  adaptiveSampler,
  localPopulationProvider,
  matraixPopulationAdapter,
} from "../population";
import { simulationMatrixRunner } from "../simulation/matrixRunner";
import { benchmarkAggregator } from "../simulation/benchmarkAggregator";

describe("P2-2 Population Engine, Behavioral Coverage & Adaptive Sampling Suite", () => {
  const rootCandidates = [
    resolve(__dirname, "../../../../../examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "../../examples/golden/customer-service/simulation-spec.json"),
  ];
  const goldenSpecPath = rootCandidates.find((p) => existsSync(p)) || rootCandidates[0];

  let goldenSpec: SimulationSpec;

  beforeEach(() => {
    const raw = readFileSync(goldenSpecPath, "utf-8");
    goldenSpec = JSON.parse(raw) as SimulationSpec;
  });

  it("1. verifies Dimension Registry and Cohort Space coverage", () => {
    const dimensions = DimensionRegistry.list();
    expect(dimensions.length).toBeGreaterThanOrEqual(5);

    const frustration = DimensionRegistry.get("frustration");
    expect(frustration).toBeDefined();
    expect(frustration?.boundaryThresholds).toContain(0.7);

    const cohorts = CohortGenerator.listCohorts();
    expect(cohorts.length).toBeGreaterThanOrEqual(4);

    const boundaryCohort = CohortGenerator.getCohort("cohort_boundary_escalation");
    expect(boundaryCohort?.dimensions.frustration.min).toBe(0.68);
    expect(boundaryCohort?.dimensions.frustration.max).toBe(0.72);
  });

  it("2. tests 5 distinct Sampling Strategies (random, stratified, boundary, adversarial, scenario_driven)", () => {
    // 1. Random
    const randomRes = samplingEngine.sample({ strategy: "random", sampleSize: 10, baseSeed: 10 });
    expect(randomRes.personas).toHaveLength(10);
    expect(randomRes.strategy).toBe("random");

    // 2. Stratified
    const stratifiedRes = samplingEngine.sample({ strategy: "stratified", sampleSize: 15, baseSeed: 20 });
    expect(stratifiedRes.personas).toHaveLength(15);
    expect(stratifiedRes.sampledCohorts.length).toBeGreaterThanOrEqual(4);

    // 3. Boundary
    const boundaryRes = samplingEngine.sample({ strategy: "boundary", sampleSize: 8, baseSeed: 30 });
    expect(boundaryRes.personas).toHaveLength(8);
    for (const p of boundaryRes.personas) {
      const f = p.behaviorProfile?.initialState?.affective?.frustration ?? 0;
      expect(f).toBeGreaterThanOrEqual(0.68);
      expect(f).toBeLessThanOrEqual(0.72);
    }

    // 4. Adversarial
    const advRes = samplingEngine.sample({
      strategy: "adversarial",
      sampleSize: 6,
      baseSeed: 40,
      adversarialTargetWeaknesses: ["empathy_deficit"],
    });
    expect(advRes.personas).toHaveLength(6);
    for (const p of advRes.personas) {
      const f = p.behaviorProfile?.initialState?.affective?.frustration ?? 0;
      expect(f).toBeGreaterThanOrEqual(0.8);
    }

    // 5. Scenario Driven
    const scenRes = samplingEngine.sample({
      strategy: "scenario_driven",
      sampleSize: 5,
      scenarioDomain: "customer_service",
    });
    expect(scenRes.personas).toHaveLength(5);
  });

  it("3. quantifies Behavioral Coverage across high-dimensional persona spaces", () => {
    // Create a comprehensive stratified persona sample
    const sample = samplingEngine.sample({ strategy: "stratified", sampleSize: 25, baseSeed: 77 });
    const coverageReport = coverageAnalyzer.analyze(sample.personas);

    expect(coverageReport.overallCoverageScore).toBeGreaterThanOrEqual(85);
    expect(coverageReport.benchmarkSpaceCoverage).toBeGreaterThanOrEqual(85);
    expect(coverageReport.behavioralCoverage).toBeGreaterThanOrEqual(90);
    expect(coverageReport.cohortCoverage).toBe(100);
    expect(coverageReport.boundaryCoverage).toBeGreaterThanOrEqual(90);
    expect(coverageReport.summary).toContain("benchmark space coverage");
  });

  it("4. executes Adaptive Simulation loop (Benchmark -> Failure Pattern -> Adaptive Sampling -> Re-test)", async () => {
    const targetAgents: SimulationActorSpec[] = [
      {
        id: "agent_strict",
        name: "Strict Agent",
        role: "support_agent",
        actorType: "ai_agent_target",
        agentConfig: { provider: "mock", config: { profile: "strict" } },
      },
      {
        id: "agent_empathic",
        name: "Empathic Agent",
        role: "support_agent",
        actorType: "ai_agent_target",
        agentConfig: { provider: "mock", config: { profile: "claude-profile" } },
      },
    ];

    const matrixResult = await simulationMatrixRunner.runMatrix({
      specs: [goldenSpec],
      targetAgents,
      repetitions: 2,
      baseSeed: 999,
    });

    const report = benchmarkAggregator.aggregate(matrixResult);
    expect(report.agents.length).toBe(2);

    const allFailures = Array.from(
      new Set(report.agents.flatMap((a) => a.failurePatterns.map((f) => f.patternType)))
    );

    const adaptiveSample = adaptiveSampler.sampleAdaptive({
      benchmarkId: report.benchmarkId,
      failurePatterns: allFailures.length > 0 ? allFailures : ["empathy_deficit", "escalation_delay"],
      vulnerableCohorts: ["highly_frustrated_customer"],
      sampleSize: 4,
      intensity: 0.9,
    });

    expect(adaptiveSample.personas).toHaveLength(4);
    for (const p of adaptiveSample.personas) {
      expect(p.behaviorProfile?.traits).toContain("adaptive_adversarial");
      expect(p.behaviorProfile?.initialState?.affective?.frustration).toBeGreaterThanOrEqual(0.85);
    }

    const stressSpecs: SimulationSpec[] = adaptiveSample.personas.map((persona, idx) => ({
      ...goldenSpec,
      id: `stress_spec_${idx + 1}`,
      actors: [
        persona,
        goldenSpec.actors.find((a) => a.actorType === "ai_agent_target")!,
      ],
    }));

    const stressMatrixResult = await simulationMatrixRunner.runMatrix({
      specs: stressSpecs,
      targetAgents: [targetAgents[0]],
      repetitions: 1,
      baseSeed: 1234,
    });

    expect(stressMatrixResult.totalRuns).toBe(4);
    for (const run of stressMatrixResult.runs) {
      expect(run.runResult.trace.events.length).toBeGreaterThan(0);
    }
  });

  it("5. verifies Population Provider polymorphism (LocalProvider vs MatraixPopulationAdapter)", async () => {
    const localDimensions = await localPopulationProvider.listDimensions();
    const matraixDimensions = await matraixPopulationAdapter.listDimensions();

    expect(localDimensions.length).toBe(matraixDimensions.length);

    const matraixSample = await matraixPopulationAdapter.sample({
      strategy: "stratified",
      sampleSize: 5,
    });

    expect(matraixSample.personas).toHaveLength(5);
    expect(matraixSample.metadata.source).toBe("matraix-adapter");
  });

  it("6. tests HTTP REST API endpoints (/api/v1/simulation-populations/*)", async () => {
    // 1. GET dimensions
    const dimRes = await request(app).get("/api/v1/simulation-populations/dimensions");
    expect(dimRes.status).toBe(200);
    expect(dimRes.body.length).toBeGreaterThanOrEqual(5);

    // 2. GET cohorts
    const cohortRes = await request(app).get("/api/v1/simulation-populations/cohorts");
    expect(cohortRes.status).toBe(200);
    expect(cohortRes.body.length).toBeGreaterThanOrEqual(4);

    // 3. POST sample
    const sampleRes = await request(app)
      .post("/api/v1/simulation-populations/sample")
      .send({
        strategy: "stratified",
        sampleSize: 10,
      });
    expect(sampleRes.status).toBe(201);
    expect(sampleRes.body.personas).toHaveLength(10);

    // 4. POST coverage
    const covRes = await request(app)
      .post("/api/v1/simulation-populations/coverage")
      .send({ personas: sampleRes.body.personas });
    expect(covRes.status).toBe(200);
    expect(covRes.body.overallCoverageScore).toBeGreaterThanOrEqual(80);

    // 5. POST adaptive
    const adaptRes = await request(app)
      .post("/api/v1/simulation-populations/adaptive")
      .send({
        benchmarkId: "bench_api_test",
        failurePatterns: ["escalation_delay"],
        vulnerableCohorts: ["highly_frustrated_customer"],
        sampleSize: 6,
        intensity: 0.85,
      });
    expect(adaptRes.status).toBe(201);
    expect(adaptRes.body.personas).toHaveLength(6);
    expect(adaptRes.body.personas[0].behaviorProfile.traits).toContain("adaptive_adversarial");
  });
});
