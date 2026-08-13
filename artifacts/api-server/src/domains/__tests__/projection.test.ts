/**
 * Phase 13–14: shared Projection contract tests.
 *
 * Proves: (1) both adapters read the SAME canonical graph without requiring
 * any roleplay-specific fields on the canonical model; (2) provenance chains
 * are complete and ordered canonical → simulation → projection; (3) the
 * roleplayx adapter maps simulation results (snapshots/trace/evaluations)
 * into scenario concepts; (4) the LLM-backed novel adapter strictly
 * validates provider output and never mutates its sources.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContentGraph } from "../content/model";
import type { ProjectionSource } from "../projection/contract";
import {
  buildProvenanceChain,
  InvalidProjectionError,
  ProjectionExecutionError,
} from "../projection/contract";
import { roleplayxAdapter } from "../projection/roleplayxAdapter";
import { validContentGraph } from "./fixtures";
import type { Simulation, InteractionEvent } from "../simulation/model";
import type { CharacterSnapshot } from "../character/snapshotModel";

vi.mock("../ai/llmClient", () => ({
  LLM_MODEL_ID: "openai/test-model",
  LLMRequestError: class LLMRequestError extends Error {},
  completeJSON: vi.fn(),
}));
import { completeJSON } from "../ai/llmClient";
import { novelAdapter, novelDraftSchema } from "../projection/novelAdapter";

const NOW = "2026-08-13T00:00:00.000Z";

function makeSimulationBundle(): NonNullable<ProjectionSource["simulation"]> {
  const simulation: Simulation = {
    id: "simulation_1",
    name: "Budget negotiation",
    environmentType: "text",
    config: { topic: "Q3 budget", maxTurns: 10, policy: "heuristic" },
    participants: [
      {
        agentId: "agent_a",
        snapshotId: "snapshot_a",
        characterId: "character_a",
        name: "Sales Manager",
        role: "sales",
      },
      {
        agentId: "agent_b",
        snapshotId: "snapshot_b",
        characterId: "character_b",
        name: "Finance Manager",
        role: "finance",
      },
    ],
    seed: 42,
    status: "completed",
    turnsExecuted: 4,
    outcome: {
      agreementReached: true,
      finalGap: 0.1,
      finalPositions: { agent_a: 0.5, agent_b: 0.6 },
      turnsUsed: 4,
      summary: "Agreement reached.",
    },
    error: null,
    provenance: {
      operation: "simulate",
      createdAt: NOW,
      seed: 42,
      environmentType: "text",
      policy: "heuristic",
      modelVersion: null,
      snapshotIds: ["snapshot_a", "snapshot_b"],
    },
    createdAt: NOW,
    completedAt: NOW,
  };
  const trace: InteractionEvent[] = [
    {
      id: "interaction_1",
      simulationId: "simulation_1",
      sequence: 0,
      turn: 0,
      actorId: "agent_a",
      type: "utterance",
      payload: { text: "We need more budget." },
      stateBefore: null,
      stateAfter: null,
      createdAt: NOW,
    },
    {
      id: "interaction_2",
      simulationId: "simulation_1",
      sequence: 1,
      turn: 3,
      actorId: "environment",
      type: "outcome",
      payload: { summary: "Agreement reached." },
      stateBefore: null,
      stateAfter: null,
      createdAt: NOW,
    },
  ];
  const snapshots = [
    {
      id: "snapshot_a",
      characterId: "character_a",
      behavioralProfile: {
        psychological: { risk_tolerance: "high" },
        behavioral: { communication_style: "direct" },
        goals: [],
        constraints: [],
      },
    } as unknown as CharacterSnapshot,
  ];
  const evaluations = [
    {
      id: "evaluation_1",
      simulationId: "simulation_1",
      kind: "behavior",
      subjectType: "agent",
      subjectId: "agent_a",
      scores: {},
      findings: {},
      provenance: {},
      createdAt: NOW,
    },
  ] as never[];
  return { simulation, trace, snapshots, evaluations };
}

describe("projection contract", () => {
  it("rejects projection with no sources", async () => {
    await expect(
      roleplayxAdapter.project({ graph: null, simulation: null }),
    ).rejects.toThrow(InvalidProjectionError);
    await expect(
      novelAdapter.project({ graph: null, simulation: null }),
    ).rejects.toThrow(InvalidProjectionError);
  });

  it("builds ordered provenance chains canonical → simulation → projection", () => {
    const source: ProjectionSource = {
      graph: validContentGraph(),
      simulation: makeSimulationBundle(),
    };
    const chain = buildProvenanceChain(source, {
      adapter: "roleplayx",
      adapterVersion: "2.0.0",
      modelVersion: null,
    });
    expect(chain.map((l) => l.layer)).toEqual([
      "canonical",
      "simulation",
      "projection",
    ]);
    expect(chain[1]).toMatchObject({
      simulationId: "simulation_1",
      seed: 42,
      snapshotIds: ["snapshot_a"],
      evaluationIds: ["evaluation_1"],
    });
  });
});

describe("projection independence (canonical model owes nothing to runtimes)", () => {
  it("canonical graph carries no roleplay-specific fields, yet both adapters project it", async () => {
    const graph = validContentGraph();
    // The canonical model must not contain any RoleplayX vocabulary.
    const serialized = JSON.stringify(graph);
    for (const forbidden of [
      "playerRole",
      "successCriteria",
      "recommendedFlow",
      "personas",
      "evaluationContract",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    const roleplay = await roleplayxAdapter.project({
      graph,
      simulation: null,
    });
    expect(roleplay.target).toBe("roleplayx");
    expect(roleplay.payload["personas"]).toBeInstanceOf(Array);

    vi.mocked(completeJSON).mockResolvedValueOnce({
      title: "The Deadline",
      logline: "A QA lead fights for quality.",
      theme: "integrity under pressure",
      characters: [{ name: "QA Lead", arc: "learns to hold the line" }],
      scenes: [
        { heading: "The standoff", prose: "word ".repeat(120).trim() },
        { heading: "The compromise", prose: "word ".repeat(120).trim() },
      ],
    });
    const novel = await novelAdapter.project({ graph, simulation: null });
    expect(novel.target).toBe("novel");
    expect(novel.payload["scenes"]).toBeInstanceOf(Array);
    // Same canonical input, two runtimes — and the graph was never mutated.
    expect(JSON.stringify(graph)).toBe(serialized);
  });
});

describe("roleplayx adapter v2 (simulation source)", () => {
  it("maps snapshots/trace/evaluations to actors, flow, environment and evaluation contract", async () => {
    const bundle = makeSimulationBundle();
    const result = await roleplayxAdapter.project({
      graph: null,
      simulation: bundle,
    });
    const payload = result.payload as {
      title: string;
      personas: { id: string; name: string; traits: string[] }[];
      recommendedFlow: string[];
      environment: { type: string; topic: string; maxTurns: number };
      evaluationContract: { kinds: string[] };
      objectives: string[];
    };
    expect(payload.title).toBe("Budget negotiation");
    expect(payload.personas).toHaveLength(2);
    expect(
      payload.personas.find((p) => p.id === "character_a")!.traits,
    ).toContain("risk_tolerance: high");
    expect(payload.recommendedFlow.some((l) => l.includes("We need more budget"))).toBe(true);
    expect(payload.recommendedFlow.some((l) => l.includes("Agreement reached"))).toBe(true);
    expect(payload.environment).toEqual({
      type: "text",
      topic: "Q3 budget",
      maxTurns: 10,
    });
    expect(payload.evaluationContract.kinds).toContain("behavior");
    expect(payload.objectives.some((o) => o.includes("Q3 budget"))).toBe(true);
  });
});

describe("novel adapter (strict LLM validation)", () => {
  beforeEach(() => vi.mocked(completeJSON).mockReset());

  it("rejects provider output with undeclared fields", async () => {
    vi.mocked(completeJSON).mockResolvedValueOnce({
      title: "t",
      logline: "l",
      theme: "th",
      characters: [{ name: "n", arc: "a" }],
      scenes: [
        { heading: "h", prose: "word ".repeat(120).trim() },
        { heading: "h2", prose: "word ".repeat(120).trim() },
      ],
      marketingBlurb: "not in contract",
    });
    await expect(
      novelAdapter.project({ graph: validContentGraph(), simulation: null }),
    ).rejects.toThrow(ProjectionExecutionError);
  });

  it("rejects drafts violating the declared scene-count contract", async () => {
    const scene = () => ({
      heading: "h",
      prose: "word ".repeat(120).trim(),
    });
    for (const scenes of [
      [], // none
      [scene()], // too few (< 2)
      [scene(), scene(), scene(), scene(), scene()], // too many (> 4)
    ]) {
      vi.mocked(completeJSON).mockResolvedValueOnce({
        title: "t",
        logline: "l",
        theme: "th",
        characters: [{ name: "n", arc: "a" }],
        scenes,
      });
      await expect(
        novelAdapter.project({ graph: validContentGraph(), simulation: null }),
      ).rejects.toThrow(ProjectionExecutionError);
    }
  });

  it("rejects drafts violating the declared prose-length contract", async () => {
    for (const prose of [
      "too short", // far below 80 words
      "word ".repeat(300).trim(), // above 200 words
    ]) {
      vi.mocked(completeJSON).mockResolvedValueOnce({
        title: "t",
        logline: "l",
        theme: "th",
        characters: [{ name: "n", arc: "a" }],
        scenes: [
          { heading: "h", prose },
          { heading: "h2", prose: "word ".repeat(120).trim() },
        ],
      });
      await expect(
        novelAdapter.project({ graph: validContentGraph(), simulation: null }),
      ).rejects.toThrow(ProjectionExecutionError);
    }
  });

  it("records the model version in the projection provenance link", async () => {
    vi.mocked(completeJSON).mockResolvedValueOnce({
      title: "t",
      logline: "l",
      theme: "th",
      characters: [{ name: "n", arc: "a" }],
      scenes: [
        { heading: "h", prose: "word ".repeat(120).trim() },
        { heading: "h2", prose: "word ".repeat(120).trim() },
      ],
    });
    const result = await novelAdapter.project({
      graph: validContentGraph(),
      simulation: null,
    });
    const link = result.provenance.find((l) => l.layer === "projection")!;
    expect(link).toMatchObject({
      adapter: "novel",
      modelVersion: "openai/test-model",
    });
    expect(novelDraftSchema.safeParse(result.payload).success).toBe(true);
  });
});
