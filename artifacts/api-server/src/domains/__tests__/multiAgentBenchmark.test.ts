import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import app from "../../app";
import type {
  SimulationSpec,
  SimulationActorSpec,
} from "@workspace/simulation-contract";
import { simulationMatrixRunner } from "../simulation/matrixRunner";
import { benchmarkAggregator } from "../simulation/benchmarkAggregator";
import { MultiLayerEvaluationEngine } from "../evaluation/multiLayerEngine";
import { simulationSpecService } from "../simulation/specService";

describe("P1 Multi-Agent Benchmark Suite (Statistical Rigor & Failure Analysis)", () => {
  const rootCandidates = [
    resolve(__dirname, "../../../../../examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "../../examples/golden/customer-service/simulation-spec.json"),
  ];
  const goldenSpecPath = rootCandidates.find((p) => existsSync(p)) || rootCandidates[0];

  let goldenSpec: SimulationSpec;

  const targetAgents: SimulationActorSpec[] = [
    {
      id: "agent_gpt4o",
      name: "GPT-4o Customer Support Agent",
      role: "support_agent",
      actorType: "ai_agent_target",
      agentConfig: {
        provider: "openai",
        config: { model: "gpt-4o", profile: "gpt-profile" },
      },
    },
    {
      id: "agent_claude35",
      name: "Claude 3.5 Sonnet Empathetic Agent",
      role: "support_agent",
      actorType: "ai_agent_target",
      agentConfig: {
        provider: "anthropic",
        config: { model: "claude-3-5-sonnet-20241022", profile: "claude-profile" },
      },
    },
    {
      id: "agent_gemini20",
      name: "Gemini 2.0 Flash Efficient Agent",
      role: "support_agent",
      actorType: "ai_agent_target",
      agentConfig: {
        provider: "google",
        config: { model: "gemini-2.0-flash", profile: "gemini-profile" },
      },
    },
  ];

  beforeEach(() => {
    const raw = readFileSync(goldenSpecPath, "utf-8");
    goldenSpec = JSON.parse(raw) as SimulationSpec;
    simulationSpecService.createSpec(goldenSpec);
  });

  it("1. runs a Simulation Matrix across 3 distinct AI Agent providers under identical conditions", async () => {
    const matrixResult = await simulationMatrixRunner.runMatrix({
      specs: [goldenSpec],
      targetAgents,
      repetitions: 2,
      baseSeed: 100,
    });

    // 1 spec * 3 agents * 2 repetitions = 6 simulations
    expect(matrixResult.totalRuns).toBe(6);
    expect(matrixResult.runs).toHaveLength(6);

    const gptRuns = matrixResult.runs.filter((r) => r.agentId === "agent_gpt4o");
    const claudeRuns = matrixResult.runs.filter((r) => r.agentId === "agent_claude35");
    const geminiRuns = matrixResult.runs.filter((r) => r.agentId === "agent_gemini20");

    expect(gptRuns).toHaveLength(2);
    expect(claudeRuns).toHaveLength(2);
    expect(geminiRuns).toHaveLength(2);

    for (const run of matrixResult.runs) {
      expect(run.runResult.trace.events.length).toBeGreaterThan(0);
      expect(run.runResult.evaluation.overallScore).toBeGreaterThanOrEqual(75);
    }
  });

  it("2. evaluates runs using 3-Layer Evaluation Engine with Evaluator Independence", () => {
    const evalEngine = new MultiLayerEvaluationEngine();
    const mockTrace = {
      simulationId: "sim_test",
      runId: "run_test_01",
      specId: goldenSpec.id,
      events: [
        {
          id: "ev_01",
          simulationId: "sim_test",
          runId: "run_test_01",
          turn: 1,
          actorId: "actor_customer_kim",
          actorType: "persona_actor" as const,
          correlationId: "c_1",
          source: { type: "rule" as const },
          stateBefore: { affective: { frustration: 0.85 }, relational: {}, cognitive: {} },
          action: { action: "request_refund", reasonCodes: [] },
          stateAfter: { affective: { frustration: 0.85 }, relational: {}, cognitive: {} },
          timestamp: new Date().toISOString(),
        },
        {
          id: "ev_02",
          simulationId: "sim_test",
          runId: "run_test_01",
          turn: 1,
          actorId: "agent_claude35",
          actorType: "ai_agent_target" as const,
          correlationId: "c_1",
          source: { type: "llm" as const, provider: "anthropic", model: "claude-3.5" },
          stateBefore: { affective: {}, relational: {}, cognitive: {} },
          action: {
            action: "deny_refund",
            reasonCodes: ["policy_7_day_enforced", "voucher_offered", "high_empathy_response"],
            utterance: "I am truly sorry...",
          },
          stateAfter: { affective: {}, relational: {}, cognitive: {} },
          timestamp: new Date().toISOString(),
        },
      ],
      outcome: {
        status: "completed" as const,
        turnsUsed: 1,
        goalReached: true,
        summary: "Done",
        finalStates: {},
        metrics: {},
      },
      createdAt: new Date().toISOString(),
    };

    const evaluation = evalEngine.evaluate(goldenSpec, mockTrace, "agent_claude35");
    expect(evaluation.overallScore).toBeGreaterThanOrEqual(85);
    expect(evaluation.metrics).toHaveLength(4);

    const empathy = evaluation.metrics.find((m) => m.metric === "empathy");
    expect(empathy?.score).toBe(95);
    expect(empathy?.evidenceEventIds).toContain("ev_02");

    // Evaluator Independence check: raw layer reports exist in metadata
    const metadata = evaluation.metadata as { layers?: { rule: unknown[]; trace: unknown[]; llmJudge: unknown[] } };
    expect(metadata.layers?.rule).toBeDefined();
    expect(metadata.layers?.trace).toBeDefined();
    expect(metadata.layers?.llmJudge).toBeDefined();
  });

  it("3. aggregates statistical dispersion, failure patterns, and persona sensitivity across agents", async () => {
    const matrixResult = await simulationMatrixRunner.runMatrix({
      specs: [goldenSpec],
      targetAgents,
      repetitions: 3,
      baseSeed: 500,
    });

    const report = benchmarkAggregator.aggregate(matrixResult);

    expect(report.totalSimulations).toBe(9);
    expect(report.agents).toHaveLength(3);
    expect(report.comparativeRadar.length).toBeGreaterThanOrEqual(4);

    const claudeAnalysis = report.agents.find((a) => a.agentId === "agent_claude35");
    const gptAnalysis = report.agents.find((a) => a.agentId === "agent_gpt4o");

    expect(claudeAnalysis).toBeDefined();
    expect(claudeAnalysis?.overallStats.mean).toBeGreaterThanOrEqual(85);
    expect(claudeAnalysis?.overallStats.stdDev).toBeDefined();
    expect(claudeAnalysis?.overallStats.p50).toBeDefined();
    expect(claudeAnalysis?.overallStats.confidenceInterval95).toHaveLength(2);
    expect(claudeAnalysis?.strengths.length).toBeGreaterThan(0);
    expect(claudeAnalysis?.personaSensitivity.length).toBeGreaterThan(0);

    expect(gptAnalysis).toBeDefined();
    expect(gptAnalysis?.overallStats.mean).toBeGreaterThanOrEqual(85);
  });

  it("4. verifies the complete HTTP API benchmark flow via POST /api/v1/benchmarks/run", async () => {
    const response = await request(app)
      .post("/api/v1/benchmarks/run")
      .send({
        specIds: [goldenSpec.id],
        targetAgents,
        repetitions: 2,
      });

    expect(response.status).toBe(201);
    expect(response.body.benchmarkId).toBeDefined();
    expect(response.body.totalSimulations).toBe(6);
    expect(response.body.agents).toHaveLength(3);
    expect(response.body.comparativeRadar.length).toBeGreaterThanOrEqual(4);
    expect(response.body.executiveSummary).toBeTruthy();

    // Test GET /v1/benchmarks/:id
    const getRes = await request(app).get(`/api/v1/benchmarks/${response.body.benchmarkId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.benchmarkId).toBe(response.body.benchmarkId);
    expect(getRes.body.agents[0].overallStats.mean).toBeDefined();
  });
});
