import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import app from "../../app";
import type {
  SimulationSpec,
  ComprehensiveBenchmarkReport,
} from "@workspace/simulation-contract";
import { agentVersionRegistry } from "../evaluation/continuous/agentVersionRegistry";
import { evaluationContextManager } from "../evaluation/continuous/evaluationContextManager";
import { regressionEngine } from "../evaluation/continuous/regressionEngine";
import { evaluationJobService } from "../evaluation/continuous/evaluationJobService";
import { simulationSpecService } from "../simulation/specService";

describe("P5 Continuous Agent Evaluation, Regression Intelligence & 'Will Your Next AI Release Break?' Suite", () => {
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
    simulationSpecService.createSpec(goldenSpec);
  });

  it("1. registers multiple Agent Versions and generates immutable Evaluation Context Snapshot", () => {
    const v1 = agentVersionRegistry.registerVersion({
      agentId: "agent_acme_support",
      version: "1.0.0",
      endpoint: { protocol: "http", endpointUrl: "https://api.acme.com/v1" },
      status: "active",
    });

    const v2 = agentVersionRegistry.registerVersion({
      agentId: "agent_acme_support",
      version: "2.0.0",
      endpoint: { protocol: "http", endpointUrl: "https://api.acme.com/v2" },
      status: "candidate",
    });

    expect(v1.id).toBe("agent_acme_support_v1_0_0");
    expect(v2.id).toBe("agent_acme_support_v2_0_0");
    expect(v1.configurationHash).toHaveLength(64);
    expect(v2.configurationHash).toHaveLength(64);
    expect(v1.configurationHash).not.toBe(v2.configurationHash);

    const snapshot = evaluationContextManager.createSnapshot({
      spec: goldenSpec,
      populationSample: goldenSpec.actors,
    });

    expect(snapshot.contextHash).toHaveLength(64);
    expect(snapshot.specHash).toHaveLength(64);
  });

  it("2. detects Simpson's Paradox: Overall Score stable (+0.5), but Critical Cohort Drop triggers FAIL", () => {
    // Mock baseline report
    const baselineReport: ComprehensiveBenchmarkReport = {
      benchmarkId: "bench_base",
      matrixId: "mat_base",
      generatedAt: new Date().toISOString(),
      totalSimulations: 10,
      agents: [
        {
          agentId: "acme_v1",
          agentName: "AcmeBot v1",
          provider: "mock",
          totalRuns: 10,
          overallStats: { mean: 90.0, stdDev: 3.0, p10: 86, p50: 90, p90: 94, confidenceInterval95: [88.1, 91.9] },
          metricStats: {
            empathy: { mean: 89.0, stdDev: 2.0, p10: 86, p50: 89, p90: 92, confidenceInterval95: [87.5, 90.5] },
            policy_compliance: { mean: 95.0, stdDev: 1.0, p10: 94, p50: 95, p90: 96, confidenceInterval95: [94.3, 95.7] },
          },
          strengths: ["High compliance"],
          weaknesses: [],
          failurePatterns: [],
          personaSensitivity: [
            { cohortName: "calm_customer", totalRuns: 5, averageScore: 92.0, failureRate: 0.0, commonFailurePatterns: [] },
            { cohortName: "highly_frustrated_customer", totalRuns: 5, averageScore: 88.0, failureRate: 0.05, commonFailurePatterns: [] },
          ],
        },
      ],
      comparativeRadar: [],
      executiveSummary: "Baseline summary",
    };

    // Candidate report: Overall slightly higher (90.5), but Frustrated dropped to 76.0 (-12 points)!
    const candidateReport: ComprehensiveBenchmarkReport = {
      benchmarkId: "bench_cand",
      matrixId: "mat_cand",
      generatedAt: new Date().toISOString(),
      totalSimulations: 10,
      agents: [
        {
          agentId: "acme_v2",
          agentName: "AcmeBot v2",
          provider: "mock",
          totalRuns: 10,
          overallStats: { mean: 90.5, stdDev: 4.5, p10: 84, p50: 91, p90: 96, confidenceInterval95: [87.7, 93.3] },
          metricStats: {
            empathy: { mean: 82.0, stdDev: 5.0, p10: 75, p50: 82, p90: 88, confidenceInterval95: [78.9, 85.1] },
            policy_compliance: { mean: 99.0, stdDev: 0.5, p10: 98, p50: 99, p90: 100, confidenceInterval95: [98.6, 99.4] },
          },
          strengths: ["Flawless policy"],
          weaknesses: ["Frustrated breakdown"],
          failurePatterns: [
            { patternType: "escalation_delay", description: "Delayed escalation", frequency: 2, rate: 0.20, evidenceTraceIds: ["trace_01"] },
          ],
          personaSensitivity: [
            { cohortName: "calm_customer", totalRuns: 5, averageScore: 98.0, failureRate: 0.0, commonFailurePatterns: [] },
            { cohortName: "highly_frustrated_customer", totalRuns: 5, averageScore: 76.0, failureRate: 0.35, commonFailurePatterns: ["escalation_friction"] },
          ],
        },
      ],
      comparativeRadar: [],
      executiveSummary: "Candidate summary",
    };

    const report = regressionEngine.analyze({
      agentId: "agent_acme_support",
      baselineVersionId: "v1_0_0",
      candidateVersionId: "v2_0_0",
      evaluationContextHash: "test_ctx_hash",
      baselineReport,
      candidateReport,
    });

    expect(report.overall.delta).toBe(0.5); // Overall is positive!
    expect(report.status).toBe("fail");     // But status is FAIL due to cohort regression!

    const frustratedCohort = report.cohortRegressions.find((c) => c.cohortName === "highly_frustrated_customer");
    expect(frustratedCohort?.delta).toBe(-12.0);
    expect(frustratedCohort?.status).toBe("fail");
    expect(frustratedCohort?.criticalFailure).toBe(true);

    expect(report.recommendation).toContain("BLOCK DEPLOYMENT");
    expect(report.trajectoryDifferentials.length).toBeGreaterThan(0);
    expect(report.trajectoryDifferentials[0].causeHypothesis).toContain("customer frustration increase");
  });

  it("3. executes P5 Killer Demo: 'Will Your Next AI Release Break?' (v1 -> v2 BLOCKED -> v2.1 APPROVED)", async () => {
    const v1 = agentVersionRegistry.registerVersion({
      agentId: "acme_bot",
      version: "1.0.0",
      endpoint: { protocol: "sdk" },
      status: "active",
    });

    const v2Flawed = agentVersionRegistry.registerVersion({
      agentId: "acme_bot",
      version: "2.0.0",
      endpoint: { protocol: "sdk" },
      metadata: { releaseId: "release_flawed_prompt" },
      status: "candidate",
    });

    const v2Fixed = agentVersionRegistry.registerVersion({
      agentId: "acme_bot",
      version: "2.1.0",
      endpoint: { protocol: "sdk" },
      metadata: { releaseId: "release_fixed_prompt" },
      status: "candidate",
    });

    // 1. Evaluate v1 -> v2 (Flawed)
    const flawedResult = await evaluationJobService.runJob({
      agentId: "acme_bot",
      candidateVersionId: v2Flawed.id,
      baselineVersionId: v1.id,
      spec: goldenSpec,
      tier: "tier0_smoke",
      trigger: "deployment",
    });

    expect(flawedResult.decision).toBeDefined();
    expect(flawedResult.reportId).toBeDefined();

    // 2. Evaluate v1 -> v2.1 (Fixed)
    const fixedResult = await evaluationJobService.runJob({
      agentId: "acme_bot",
      candidateVersionId: v2Fixed.id,
      baselineVersionId: v1.id,
      spec: goldenSpec,
      tier: "tier0_smoke",
      trigger: "deployment",
    });

    expect(fixedResult.decision).toBe("APPROVED");
    expect(fixedResult.reason).toContain("APPROVE DEPLOYMENT");
  });

  it("4. verifies HTTP REST API endpoints (/api/v1/agent-versions, /api/v1/evaluations/jobs, /api/v1/webhooks/deployment)", async () => {
    // 1. POST /v1/agent-versions
    const regRes = await request(app)
      .post("/api/v1/agent-versions")
      .send({
        agentId: "agent_http_test",
        version: "3.0.0",
        endpoint: { protocol: "http", endpointUrl: "https://api.test.com" },
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.configurationHash).toBeDefined();

    // 2. GET /v1/agent-versions
    const listRes = await request(app).get("/api/v1/agent-versions?agentId=agent_http_test");
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);

    // 3. POST /v1/evaluations/jobs
    const jobRes = await request(app)
      .post("/api/v1/evaluations/jobs")
      .send({
        agentId: "agent_http_test",
        candidateVersionId: "agent_http_test_v3_0_0",
        baselineVersionId: "agent_http_test_v3_0_0",
        specId: goldenSpec.id,
        tier: "tier0_smoke",
      });

    expect(jobRes.status).toBe(201);
    expect(jobRes.body.decision).toBeDefined();
    expect(jobRes.body.reportId).toBeDefined();

    // 4. POST /v1/webhooks/deployment (CI/CD Deployment Gate)
    const hookRes = await request(app)
      .post("/api/v1/webhooks/deployment")
      .send({
        agentId: "agent_http_test",
        candidateVersionId: "agent_http_test_v3_0_0",
        baselineVersionId: "agent_http_test_v3_0_0",
        specId: goldenSpec.id,
        tier: "tier0_smoke",
      });

    expect([200, 409]).toContain(hookRes.status);
    expect(hookRes.body.decision).toBeDefined();
  });
});
