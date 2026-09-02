import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import app from "../../app";
import {
  validateSimulationSpec,
  type SimulationSpec,
} from "@workspace/simulation-contract";
import { SimulationRuntimeEngine } from "../simulation/runtime/engine";
import { SimulationCompiler } from "../simulation/compiler";

describe("Golden Scenario E2E: Customer Service Refund Escalation (P0-6)", () => {
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

  it("1. validates the golden scenario specification against SimulationSpec v1 contract", () => {
    const report = validateSimulationSpec(goldenSpec);
    expect(report.success).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(report.data?.domain).toBe("customer_service");
    expect(report.data?.actors).toHaveLength(2);
  });

  it("2. compiles natural language prompt into a valid SimulationSpec v1 using SimulationCompiler", () => {
    const compiler = new SimulationCompiler();
    const compiled = compiler.compile({
      prompt: "Angry customer Kim demanding refund for a defective jacket past 7-day policy limit",
      domain: "customer_service",
      maxTurns: 8,
      customerPersona: {
        name: "Kim Min-jun",
        frustration: 0.85,
      },
    });

    const report = validateSimulationSpec(compiled);
    expect(report.success).toBe(true);
    expect(compiled.actors[0].name).toBe("Kim Min-jun");
    expect(compiled.behaviorPolicies[0].response.reasonCode).toBe("refund_denied_twice");
  });

  it("3. executes Golden Scenario and verifies behavioral invariants", async () => {
    const engine = new SimulationRuntimeEngine(goldenSpec);
    const runResult = await engine.run({ runId: "golden_run_001", simulationId: "golden_sim_001" });

    const { trace, evaluation, outcome } = runResult;

    // Invariant 1: Max turns
    expect(trace.events.length).toBeGreaterThan(0);
    expect(outcome.turnsUsed).toBeLessThanOrEqual(8);

    // Invariant 2: Required events & ReasonCodes
    const customerEvents = trace.events.filter((e) => e.actorId === "actor_customer_kim");
    const agentEvents = trace.events.filter((e) => e.actorId === "actor_cs_agent_bot");

    expect(customerEvents.some((e) => e.action.action === "request_refund")).toBe(true);
    expect(
      agentEvents.some((e) => e.action.action === "deny_refund" && e.action.reasonCodes.includes("voucher_offered"))
    ).toBe(true);
    expect(
      customerEvents.some((e) => e.action.action === "escalate_to_manager" && e.action.reasonCodes.includes("refund_denied_twice"))
    ).toBe(true);
    expect(
      agentEvents.some((e) => e.action.action === "transfer_to_supervisor")
    ).toBe(true);

    // Invariant 3: Correlation ID and Parent Event ID chain
    for (const ev of trace.events) {
      expect(ev.correlationId).toBeTruthy();
      expect(ev.source).toBeDefined();
      expect(["rule", "llm", "tool", "environment"]).toContain(ev.source.type);
    }

    // Invariant 4: Outcome status
    expect(outcome.status).toBe("escalated");
    expect(outcome.goalReached).toBe(true);

    // Invariant 5: Evaluation & Evidence Event IDs
    expect(evaluation.overallScore).toBeGreaterThanOrEqual(80);
    expect(evaluation.metrics.length).toBeGreaterThanOrEqual(3);

    const policyMetric = evaluation.metrics.find((m) => m.metric === "policy_compliance");
    expect(policyMetric).toBeDefined();
    expect(policyMetric?.evidenceEventIds.length).toBeGreaterThan(0);

    const empathyMetric = evaluation.metrics.find((m) => m.metric === "empathy");
    expect(empathyMetric).toBeDefined();
    expect(empathyMetric?.evidenceEventIds.length).toBeGreaterThan(0);

    const escalationMetric = evaluation.metrics.find((m) => m.metric === "escalation_control");
    expect(escalationMetric).toBeDefined();
    expect(escalationMetric?.evidenceEventIds.length).toBeGreaterThan(0);

    // Verify evidenceEventIds actually exist in the trace
    const allTraceEventIds = new Set(trace.events.map((e) => e.id));
    for (const metric of evaluation.metrics) {
      for (const evId of metric.evidenceEventIds) {
        expect(allTraceEventIds.has(evId)).toBe(true);
      }
    }
  });

  it("4. performs 100% exact match deterministic replay in recorded mode", async () => {
    const engine = new SimulationRuntimeEngine(goldenSpec);
    const initialRun = await engine.run({ runId: "golden_orig_001", simulationId: "golden_sim_001" });
    const replayedRun = await engine.replay({
      runId: "golden_replay_001",
      mode: "recorded",
      simulationId: "golden_sim_001",
    });

    expect(replayedRun.trace.events).toHaveLength(initialRun.trace.events.length);
    for (let i = 0; i < initialRun.trace.events.length; i++) {
      const orig = initialRun.trace.events[i];
      const rep = replayedRun.trace.events[i];
      expect(rep.turn).toBe(orig.turn);
      expect(rep.actorId).toBe(orig.actorId);
      expect(rep.action.action).toBe(orig.action.action);
      expect(rep.action.reasonCodes).toEqual(orig.action.reasonCodes);
      expect(rep.stateBefore).toEqual(orig.stateBefore);
      expect(rep.stateAfter).toEqual(orig.stateAfter);
    }
    expect(replayedRun.evaluation.overallScore).toBe(initialRun.evaluation.overallScore);
  });

  it("5. validates end-to-end HTTP API workflow (/simulation-specs, /simulations, /runs)", async () => {
    // 1. Post spec
    const createSpecRes = await request(app)
      .post("/api/v1/simulation-specs")
      .send(goldenSpec);
    expect(createSpecRes.status).toBe(201);
    expect(createSpecRes.body.id).toBe(goldenSpec.id);

    // 2. Validate spec endpoint
    const validateRes = await request(app)
      .post("/api/v1/simulation-specs/validate")
      .send(goldenSpec);
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.success).toBe(true);

    // 3. Auto-compile endpoint
    const compileRes = await request(app)
      .post("/api/v1/simulations/compile")
      .send({
        prompt: "Angry customer demanding return on order ORD-1234 past 7 days",
        domain: "customer_service",
      });
    expect(compileRes.status).toBe(201);
    expect(compileRes.body.id).toBeDefined();

    // 4. Run simulation for spec
    const runRes = await request(app)
      .post(`/api/v1/simulations/${goldenSpec.id}/run`)
      .send({ simulationId: "sim_api_test", runId: "run_api_test" });
    expect(runRes.status).toBe(201);
    expect(runRes.body.runId).toBe("run_api_test");
    expect(runRes.body.trace.events.length).toBeGreaterThan(0);

    // 5. Get Trajectory
    const trajRes = await request(app).get("/api/v1/runs/run_api_test/trajectory");
    expect(trajRes.status).toBe(200);
    expect(trajRes.body.events.length).toBeGreaterThan(0);

    // 6. Get Evaluation
    const evalRes = await request(app).get("/api/v1/runs/run_api_test/evaluation");
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.overallScore).toBeGreaterThanOrEqual(80);
    expect(evalRes.body.metrics[0].evidenceEventIds.length).toBeGreaterThan(0);

    // 7. Replay run
    const replayRes = await request(app)
      .post("/api/v1/runs/run_api_test/replay")
      .send({ mode: "recorded" });
    expect(replayRes.status).toBe(201);
    expect(replayRes.body.trace.events.length).toBe(trajRes.body.events.length);
  });
});
