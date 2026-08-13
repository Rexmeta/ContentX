/**
 * Phase 10–12 domain tests: engine determinism given a seed, trace
 * integrity (total order, stateBefore/stateAfter), behavior validation
 * (LLM output never applied unvalidated), environment semantics, and the
 * three trace-based evaluators.
 */
import { describe, it, expect } from "vitest";
import { TextEnvironment } from "../simulation/environment";
import {
  runSimulationLoop,
  validateBehavior,
  type EngineAgent,
} from "../simulation/engine";
import { heuristicPolicy } from "../simulation/policy";
import {
  PolicyExecutionError,
  type ProposedBehavior,
  type Simulation,
} from "../simulation/model";
import {
  evaluateBehavior,
  evaluateOutcome,
  evaluatePersonaFidelity,
} from "../evaluation/evaluators";
import type { CharacterSnapshot } from "../character/snapshotModel";

const NOW = "2026-08-13T00:00:00.000Z";

function makeSnapshot(riskTolerance: string): CharacterSnapshot {
  return {
    id: "snapshot_1",
    characterId: "character_1",
    populationId: "population_1",
    schemaVersion: "1",
    dependencyGraphVersion: "1-a",
    seed: 1,
    resolvedAttributes: {},
    behavioralProfile: {
      psychological: { risk_tolerance: riskTolerance },
      behavioral: {},
      goals: [],
      constraints: [],
    },
    provenance: {
      operation: "snapshot",
      createdAt: NOW,
      characterId: "character_1",
      characterSchemaVersion: "1",
    },
    usedBySimulation: false,
    createdAt: NOW,
  } as unknown as CharacterSnapshot;
}

function makeAgent(
  agentId: string,
  name: string,
  riskTolerance: string,
): EngineAgent {
  return {
    participant: {
      agentId,
      snapshotId: `snapshot_${agentId}`,
      characterId: `character_${agentId}`,
      name,
      role: name,
    },
    context: {
      agentId,
      name,
      role: name,
      snapshot: makeSnapshot(riskTolerance),
      goals: [],
      state: {
        affective: { stress: 0.5 },
        relational: { trust: 0.5, rapport: 0.5, cooperativeness: 0.5 },
        motivational: { drive: 0.5 },
        cognitive: { focus: 0.5 },
        behavioral: { assertiveness: 0.5 },
      },
    },
  };
}

async function run(seed: number, maxTurns = 10) {
  return runSimulationLoop({
    environment: new TextEnvironment({ topic: "budget negotiation" }),
    agents: [
      makeAgent("agent_sales", "Sales Manager", "high"),
      makeAgent("agent_finance", "Finance Manager", "low"),
    ],
    policy: heuristicPolicy,
    seed,
    maxTurns,
  });
}

describe("simulation engine determinism", () => {
  it("same seed → identical trace and outcome", async () => {
    const a = await run(42);
    const b = await run(42);
    expect(a.outcome).toEqual(b.outcome);
    expect(a.trace).toEqual(b.trace);
    expect(a.finalStates).toEqual(b.finalStates);
  });

  it("different seed → different trace (behavioral noise)", async () => {
    const a = await run(42);
    const b = await run(1337);
    expect(a.trace).not.toEqual(b.trace);
  });
});

describe("trace integrity", () => {
  it("sequence is a gapless total order and turns are monotonic", async () => {
    const { trace } = await run(42);
    trace.forEach((e, i) => expect(e.sequence).toBe(i));
    for (let i = 1; i < trace.length; i++) {
      expect(trace[i]!.turn).toBeGreaterThanOrEqual(trace[i - 1]!.turn);
    }
  });

  it("every stateChange carries stateBefore/stateAfter and they differ", async () => {
    const { trace } = await run(42);
    const changes = trace.filter((e) => e.type === "stateChange");
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes) {
      expect(c.stateBefore).not.toBeNull();
      expect(c.stateAfter).not.toBeNull();
      expect(c.stateAfter).not.toEqual(c.stateBefore);
    }
  });

  it("trace ends with exactly one environment outcome event", async () => {
    const { trace, outcome } = await run(42);
    const outcomes = trace.filter((e) => e.type === "outcome");
    expect(outcomes).toHaveLength(1);
    expect(trace[trace.length - 1]!.type).toBe("outcome");
    expect(trace[trace.length - 1]!.actorId).toBe("environment");
    expect(outcomes[0]!.payload).toEqual({ ...outcome });
  });

  it("state values remain clamped to [0, 1] through all transitions", async () => {
    const { trace, finalStates } = await run(42, 30);
    const inRange = (s: Record<string, Record<string, number>>) =>
      Object.values(s).every((values) =>
        Object.values(values).every((v) => v >= 0 && v <= 1),
      );
    for (const e of trace) {
      if (e.stateAfter) expect(inRange(e.stateAfter)).toBe(true);
    }
    for (const s of Object.values(finalStates)) {
      expect(inRange(s)).toBe(true);
    }
  });
});

describe("behavior validation (policy output gate)", () => {
  const valid: ProposedBehavior = {
    action: "concede",
    concession: 0.3,
    rationale: "move toward agreement",
    utterance: "I can move a bit.",
    stateDeltas: { affective: { stress: 0.1 } },
  };

  it("accepts a valid behavior", () => {
    expect(() => validateBehavior(valid)).not.toThrow();
  });

  it("rejects unknown actions, out-of-range concessions/deltas, unknown categories", () => {
    expect(() =>
      validateBehavior({ ...valid, action: "bribe" as never }),
    ).toThrow(PolicyExecutionError);
    expect(() => validateBehavior({ ...valid, concession: 1.5 })).toThrow(
      PolicyExecutionError,
    );
    expect(() =>
      validateBehavior({
        ...valid,
        stateDeltas: { affective: { stress: 2 } },
      }),
    ).toThrow(PolicyExecutionError);
    expect(() =>
      validateBehavior({
        ...valid,
        stateDeltas: { mystical: { mana: 0.1 } } as never,
      }),
    ).toThrow(/unknown category/);
    expect(() => validateBehavior({ ...valid, utterance: "" })).toThrow(
      PolicyExecutionError,
    );
  });
});

describe("LLM behavior contract", () => {
  it("rejects undeclared provider fields instead of stripping them", async () => {
    const { llmBehaviorSchema } = await import("../simulation/policy");
    const valid = {
      action: "concede",
      concession: 0.2,
      rationale: "r",
      utterance: "u",
      stateDeltas: { affective: { stress: 0.1 } },
    };
    expect(llmBehaviorSchema.safeParse(valid).success).toBe(true);
    expect(
      llmBehaviorSchema.safeParse({ ...valid, sideEffect: "drop tables" })
        .success,
    ).toBe(false);
    expect(
      llmBehaviorSchema.safeParse({
        ...valid,
        stateDeltas: { mystical: { mana: 0.5 } },
      }).success,
    ).toBe(false);
    expect(
      llmBehaviorSchema.safeParse({ ...valid, concession: 2 }).success,
    ).toBe(false);
  });
});

describe("TextEnvironment", () => {
  it("accept only closes when the gap is within threshold, and requires all parties", () => {
    const env = new TextEnvironment({ topic: "t" });
    const parts = [
      makeAgent("a", "A", "low").participant,
      makeAgent("b", "B", "low").participant,
    ];
    env.initialize(parts, 1);
    // Gap starts at 0.8 — accept must be a no-op.
    const early = env.act("a", {
      action: "accept",
      concession: 0,
      rationale: "r",
      utterance: "u",
      stateDeltas: {},
    });
    expect(early.closed).toBe(false);
    // Converge fully.
    env.act("a", { action: "concede", concession: 1, rationale: "r", utterance: "u", stateDeltas: {} });
    env.act("b", { action: "concede", concession: 1, rationale: "r", utterance: "u", stateDeltas: {} });
    const one = env.act("a", { action: "accept", concession: 0, rationale: "r", utterance: "u", stateDeltas: {} });
    expect(one.closed).toBe(false); // one acceptance is not agreement
    const both = env.act("b", { action: "accept", concession: 0, rationale: "r", utterance: "u", stateDeltas: {} });
    expect(both.closed).toBe(true);
    expect(env.isDone()).toBe(true);
  });

  it("reset restores deterministic initial positions", () => {
    const env = new TextEnvironment({ topic: "t" });
    const parts = [
      makeAgent("a", "A", "low").participant,
      makeAgent("b", "B", "low").participant,
    ];
    env.initialize(parts, 7);
    const initial = env.getState();
    env.act("a", { action: "concede", concession: 0.5, rationale: "r", utterance: "u", stateDeltas: {} });
    env.reset();
    expect(env.getState()).toEqual(initial);
  });
});

describe("evaluators", () => {
  async function traced() {
    const result = await run(42);
    const trace = result.trace.map((e, i) => ({
      id: `interaction_${i}`,
      simulationId: "simulation_1",
      ...e,
      createdAt: NOW,
    }));
    const simulation: Simulation = {
      id: "simulation_1",
      name: "demo",
      environmentType: "text",
      config: { topic: "budget negotiation", maxTurns: 10, policy: "heuristic" },
      participants: [
        makeAgent("agent_sales", "Sales Manager", "high").participant,
        makeAgent("agent_finance", "Finance Manager", "low").participant,
      ],
      seed: 42,
      status: "completed",
      turnsExecuted: result.turnsExecuted,
      outcome: result.outcome,
      error: null,
      provenance: {
        operation: "simulate",
        createdAt: NOW,
        seed: 42,
        environmentType: "text",
        policy: "heuristic",
        modelVersion: null,
        snapshotIds: [],
      },
      createdAt: NOW,
      completedAt: NOW,
    };
    return { trace, simulation };
  }

  it("behavior evaluation counts decisions from the trace", async () => {
    const { trace } = await traced();
    const result = evaluateBehavior(trace, "agent_sales");
    expect(result.findings["decisionCount"]).toBeGreaterThan(0);
    expect(result.scores["cooperativenessScore"]).toBeGreaterThanOrEqual(0);
    expect(result.scores["cooperativenessScore"]).toBeLessThanOrEqual(1);
  });

  it("persona fidelity compares expected risk tolerance vs observed concessions", async () => {
    const { trace } = await traced();
    const low = evaluatePersonaFidelity(trace, "agent_finance", makeSnapshot("low"));
    const high = evaluatePersonaFidelity(trace, "agent_finance", makeSnapshot("high"));
    expect(low.scores["fidelityScore"]).toBeGreaterThanOrEqual(0);
    expect(low.scores["fidelityScore"]).toBeLessThanOrEqual(1);
    // Same observed behavior scored against opposite expectations must differ.
    expect(low.scores["fidelityScore"]).not.toBe(high.scores["fidelityScore"]);
    expect(low.findings["trait"]).toBe("risk_tolerance");
  });

  it("outcome evaluation reflects agreement and convergence", async () => {
    const { trace, simulation } = await traced();
    const result = evaluateOutcome(simulation, trace);
    expect(result.findings["agreementReached"]).toBe(
      simulation.outcome!.agreementReached,
    );
    expect(result.scores["convergenceScore"]).toBeCloseTo(
      1 - simulation.outcome!.finalGap,
    );
    if (simulation.outcome!.agreementReached) {
      expect(result.scores["successScore"]).toBe(1);
    }
  });
});
