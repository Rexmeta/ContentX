/**
 * Architecture invariants of the generic simulation runtime (spec §6–8):
 * - snapshot immutability (mutation attempts rejected, caller's snapshot
 *   untouched) and reproducibility (same seed → same trace, different
 *   seed → different results)
 * - AgentState isolation between agents and between run and result
 * - trace integrity on the generic loop (gapless order, per-turn shape)
 * - Behavior ≠ Utterance (utterance is an optional manifestation)
 * - version mismatch at persist time → explicit failure, no fallback
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runGenericSimulationLoop,
  validateProposedBehavior,
  type BaseObservation,
  type EngineAgent,
  type Environment,
  type Policy,
  type StateTransition,
} from "../simulation/runtime";
import { NegotiationEnvironment } from "../simulation/environment";
import { heuristicPolicy } from "../simulation/policy";
import { runSimulationLoop } from "../simulation/engine";
import {
  PolicyExecutionError,
  type SimulationParticipant,
} from "../simulation/model";
import type { CharacterSnapshot } from "../character/snapshotModel";

vi.mock("../simulation/repository", () => ({
  insertSimulationWithTrace: vi.fn(),
  getSimulation: vi.fn(),
  listSimulations: vi.fn(),
  listEventsForSimulation: vi.fn(),
}));
vi.mock("../agent/service", () => ({
  getAgentWithState: vi.fn(),
}));
vi.mock("../character/snapshotService", () => ({
  getSnapshot: vi.fn(),
}));

const NOW = "2026-08-13T00:00:00.000Z";

function makeSnapshot(id: string): CharacterSnapshot {
  return {
    id,
    characterId: `character_${id}`,
    populationId: "population_1",
    schemaVersion: "1",
    dependencyGraphVersion: "1-a",
    seed: 1,
    resolvedAttributes: {},
    behavioralProfile: {
      psychological: { risk_tolerance: "medium" },
      behavioral: {},
      goals: [],
      constraints: [],
    },
    provenance: {
      operation: "snapshot",
      createdAt: NOW,
      characterId: `character_${id}`,
      characterSchemaVersion: "1",
    },
    usedBySimulation: false,
    createdAt: NOW,
  } as unknown as CharacterSnapshot;
}

function makeAgent(agentId: string): EngineAgent {
  return {
    participant: {
      agentId,
      snapshotId: `snapshot_${agentId}`,
      characterId: `character_${agentId}`,
      name: agentId,
      role: agentId,
    },
    context: {
      agentId,
      name: agentId,
      role: agentId,
      snapshot: makeSnapshot(agentId),
      goals: [],
      state: {
        affective: { stress: 0.5 },
        relational: { trust: 0.5, rapport: 0.5, cooperativeness: 0.5 },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// A second, non-negotiation environment: proves the loop is generic.
// ---------------------------------------------------------------------------

type StepAction = { move: "step"; amount: number };

interface TallyObservation extends BaseObservation {
  total: number;
}

class TallyEnvironment
  implements Environment<TallyObservation, StepAction, Record<string, unknown>>
{
  readonly type = "tally";
  private total = 0;
  private participants: SimulationParticipant[] = [];
  private seed = 0;

  initialize(participants: SimulationParticipant[], seed: number): void {
    this.participants = participants;
    this.seed = seed;
    this.total = 0;
  }
  observe(): TallyObservation {
    return { turn: 0, total: this.total };
  }
  validateAction(action: StepAction): void {
    if (action.move !== "step" || !Number.isFinite(action.amount)) {
      throw new PolicyExecutionError("Invalid tally action");
    }
  }
  act(_agentId: string, action: StepAction): StateTransition {
    this.total += action.amount;
    return { effects: { total: this.total } };
  }
  getState(): Record<string, unknown> {
    return { total: this.total };
  }
  isDone(): boolean {
    return false;
  }
  outcome(turnsUsed: number): Record<string, unknown> {
    return { total: this.total, turnsUsed };
  }
  reset(): void {
    this.total = 0;
  }
}

/** Deterministic policy WITHOUT utterances — Behavior ≠ Utterance. */
const silentPolicy: Policy<TallyObservation, StepAction> = {
  type: "heuristic",
  modelVersion: null,
  async decide(_observation, _context, rng) {
    return {
      action: { move: "step", amount: rng() },
      rationale: "step forward",
      stateDeltas: { affective: { stress: 0.05 } },
    };
  },
};

/** Same policy but WITH an utterance. */
const talkingPolicy: Policy<TallyObservation, StepAction> = {
  type: "heuristic",
  modelVersion: null,
  async decide(observation, context, rng) {
    const behavior = await silentPolicy.decide(observation, context, rng);
    return { ...behavior, utterance: "stepping now" };
  },
};

async function runTally(
  policy: Policy<TallyObservation, StepAction>,
  seed: number,
  agents = [makeAgent("a"), makeAgent("b")],
) {
  return runGenericSimulationLoop({
    environment: new TallyEnvironment(),
    agents,
    policy,
    seed,
    maxTurns: 3,
  });
}

describe("snapshot immutability", () => {
  it("never mutates the caller's snapshot and freezes the loop's copy", async () => {
    const agent = makeAgent("a");
    const original = agent.context.snapshot;
    const before = structuredClone(original);
    await runTally(silentPolicy, 42, [agent, makeAgent("b")]);
    // Caller's object untouched, byte for byte.
    expect(original).toEqual(before);
    // The loop works on a deep-frozen clone, not the caller's object.
    expect(agent.context.snapshot).not.toBe(original);
    expect(Object.isFrozen(agent.context.snapshot)).toBe(true);
    expect(
      Object.isFrozen(agent.context.snapshot.behavioralProfile.psychological),
    ).toBe(true);
  });

  it("rejects a policy that attempts to mutate the snapshot", async () => {
    const mutatingPolicy: Policy<TallyObservation, StepAction> = {
      type: "heuristic",
      modelVersion: null,
      async decide(_observation, context) {
        (context.snapshot.behavioralProfile.psychological as Record<string, unknown>)[
          "risk_tolerance"
        ] = "high";
        return {
          action: { move: "step", amount: 0.1 },
          rationale: "r",
          stateDeltas: {},
        };
      },
    };
    await expect(runTally(mutatingPolicy, 42)).rejects.toThrow(TypeError);
  });
});

describe("generic runtime reproducibility", () => {
  it("same seed → identical trace, outcome, and final states", async () => {
    const a = await runTally(silentPolicy, 42);
    const b = await runTally(silentPolicy, 42);
    expect(a.trace).toEqual(b.trace);
    expect(a.outcome).toEqual(b.outcome);
    expect(a.finalStates).toEqual(b.finalStates);
  });

  it("different seed → different results", async () => {
    const a = await runTally(silentPolicy, 42);
    const b = await runTally(silentPolicy, 1337);
    expect(a.trace).not.toEqual(b.trace);
  });
});

describe("AgentState isolation", () => {
  it("agents' runtime states are independent objects that evolve separately", async () => {
    const a = makeAgent("a");
    const b = makeAgent("b");
    await runTally(silentPolicy, 42, [a, b]);
    expect(a.context.state).not.toBe(b.context.state);
    expect(a.context.state["affective"]).not.toBe(b.context.state["affective"]);
  });

  it("finalStates are clones — mutating the result never touches the contexts", async () => {
    const a = makeAgent("a");
    const result = await runTally(silentPolicy, 42, [a, makeAgent("b")]);
    const reported = result.finalStates["a"]!;
    expect(reported).toEqual(a.context.state);
    expect(reported).not.toBe(a.context.state);
    reported["affective"]!["stress"] = -99;
    expect(a.context.state["affective"]!["stress"]).not.toBe(-99);
  });
});

describe("generic trace integrity", () => {
  it("sequence is gapless and each agent turn follows observation → decision → action → stateChange? → utterance?", async () => {
    const { trace } = await runTally(talkingPolicy, 42);
    trace.forEach((e, i) => expect(e.sequence).toBe(i));
    const order = [
      "observation",
      "decision",
      "action",
      "stateChange",
      "utterance",
    ];
    // Group agent events by (turn, actor); each group must follow `order`.
    const groups = new Map<string, string[]>();
    for (const e of trace) {
      if (e.actorId === "environment") continue;
      const key = `${e.turn}:${e.actorId}`;
      groups.set(key, [...(groups.get(key) ?? []), e.type]);
    }
    expect(groups.size).toBeGreaterThan(0);
    for (const types of groups.values()) {
      const indices = types.map((t) => order.indexOf(t));
      expect(indices).toEqual([...indices].sort((x, y) => x - y));
      expect(types[0]).toBe("observation");
      expect(types).toContain("decision");
      expect(types).toContain("action");
    }
    // Exactly one trailing environment outcome event.
    expect(trace[trace.length - 1]!.type).toBe("outcome");
    expect(trace.filter((e) => e.type === "outcome")).toHaveLength(1);
  });

  it("decision events carry the structured action plus rationale; action events carry environment effects", async () => {
    const { trace } = await runTally(talkingPolicy, 42);
    const decision = trace.find((e) => e.type === "decision")!;
    expect(decision.payload["move"]).toBe("step");
    expect(typeof decision.payload["rationale"]).toBe("string");
    const action = trace.find((e) => e.type === "action")!;
    expect(action.payload["move"]).toBe("step");
    expect(typeof action.payload["total"]).toBe("number");
  });
});

describe("Behavior ≠ Utterance", () => {
  it("actions without utterances are recorded normally, with no utterance event", async () => {
    const { trace } = await runTally(silentPolicy, 42);
    expect(trace.filter((e) => e.type === "utterance")).toHaveLength(0);
    expect(trace.filter((e) => e.type === "action").length).toBeGreaterThan(0);
    expect(trace.filter((e) => e.type === "decision").length).toBeGreaterThan(0);
  });

  it("an utterance, when present, is recorded as its own event", async () => {
    const { trace } = await runTally(talkingPolicy, 42);
    const utterances = trace.filter((e) => e.type === "utterance");
    expect(utterances.length).toBeGreaterThan(0);
    expect(utterances[0]!.payload).toEqual({ text: "stepping now" });
  });

  it("an empty-string utterance is rejected (neither text nor absence)", () => {
    expect(() =>
      validateProposedBehavior({
        action: { move: "step", amount: 0.1 },
        rationale: "r",
        utterance: "",
        stateDeltas: {},
      }),
    ).toThrow(PolicyExecutionError);
    expect(() =>
      validateProposedBehavior({
        action: { move: "step", amount: 0.1 },
        rationale: "r",
        stateDeltas: {},
      }),
    ).not.toThrow();
  });
});

describe("negotiation runs unchanged on the generic runtime", () => {
  it("the legacy facade produces a deterministic negotiation trace", async () => {
    const run = () =>
      runSimulationLoop({
        environment: new NegotiationEnvironment({ topic: "budget" }),
        agents: [makeAgent("a"), makeAgent("b")],
        policy: heuristicPolicy,
        seed: 7,
        maxTurns: 10,
      });
    const [x, y] = await Promise.all([run(), run()]);
    expect(x.trace).toEqual(y.trace);
    // Negotiation policies always utter — every action has its utterance.
    expect(x.trace.filter((e) => e.type === "utterance").length).toBe(
      x.trace.filter((e) => e.type === "action").length,
    );
  });
});

describe("version mismatch → explicit failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function arrange(stateCategories: Record<string, { values: Record<string, number>; version: number }>) {
    const agentService = await import("../agent/service");
    const snapshotService = await import("../character/snapshotService");
    vi.mocked(agentService.getAgentWithState).mockImplementation(
      async (agentId: string) =>
        ({
          id: agentId,
          snapshotId: `snapshot_${agentId}`,
          name: agentId,
          goals: [],
          state: stateCategories,
        }) as never,
    );
    vi.mocked(snapshotService.getSnapshot).mockImplementation(
      async (id: string) => makeSnapshot(id) as never,
    );
    return import("../simulation/service");
  }

  it("fails explicitly when the run produces state for a category with no captured version", async () => {
    // Heuristic deltas touch "affective"; capturing only "relational"
    // leaves that category without a version → explicit error, no guess.
    const service = await arrange({
      relational: { values: { trust: 0.5 }, version: 1 },
    });
    await expect(
      service.runSimulation({
        name: "s",
        topic: "t",
        agentIds: ["a", "b"],
        seed: 42,
      }),
    ).rejects.toThrow(/Missing captured state version/);
  });

  it("propagates a persistence version conflict unchanged — no silent retry or fallback", async () => {
    const service = await arrange({
      relational: { values: { trust: 0.5 }, version: 1 },
      affective: { values: { stress: 0.5 }, version: 1 },
    });
    const repo = await import("../simulation/repository");
    class FakeConflict extends Error {}
    vi.mocked(repo.insertSimulationWithTrace).mockRejectedValue(
      new FakeConflict("state version conflict"),
    );
    await expect(
      service.runSimulation({
        name: "s",
        topic: "t",
        agentIds: ["a", "b"],
        seed: 42,
      }),
    ).rejects.toThrow(FakeConflict);
  });
});
