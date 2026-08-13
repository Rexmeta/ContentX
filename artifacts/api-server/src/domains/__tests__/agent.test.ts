/**
 * Phase 7–9 domain tests: snapshot immutability, agent instantiation,
 * and strict isolation of runtime AgentState from canonical Characters.
 * Persistence is mocked — these tests verify the domain contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  CharacterRow,
  CharacterSnapshotRow,
  AgentRow,
  AgentStateRow,
} from "@workspace/db";

vi.mock("../character/repository", () => ({
  getCharacter: vi.fn(),
  insertCharacter: vi.fn(),
  listCharacters: vi.fn(),
  updateCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
}));

vi.mock("../character/snapshotRepository", () => ({
  insertSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  listSnapshots: vi.fn(),
  markSnapshotUsed: vi.fn(),
  deleteSnapshotIfUnused: vi.fn(),
}));

vi.mock("../agent/repository", () => ({
  insertAgentWithStates: vi.fn(),
  getAgent: vi.fn(),
  listAgents: vi.fn(),
  deleteAgent: vi.fn(),
  listStatesForAgent: vi.fn(),
  mergeStateValues: vi.fn(),
}));

import * as characterRepo from "../character/repository";
import * as snapshotRepo from "../character/snapshotRepository";
import * as agentRepo from "../agent/repository";
import * as snapshotService from "../character/snapshotService";
import * as agentService from "../agent/service";
import {
  SnapshotImmutableError,
  SnapshotNotFoundError,
} from "../character/snapshotModel";
import {
  AGENT_STATE_CATEGORIES,
  InvalidAgentError,
} from "../agent/model";

const NOW = new Date("2026-08-13T00:00:00Z");

const characterRow: CharacterRow = {
  id: "character_1",
  name: "Korean Sales Managers #1",
  canonicalName: null,
  aliases: null,
  attributes: {
    identity: { age: 41 },
    professional: { occupation: "sales manager" },
    psychological: { risk_tolerance: "medium" },
    behavioral: { communication_style: "direct" },
    goals: ["close the deal"],
    constraints: ["never lie"],
  },
  derivedClassifications: null,
  provenance: {
    operation: "sample",
    createdAt: NOW.toISOString(),
    sourceType: "population",
    populationId: "population_1",
    seed: 42,
    populationVersion: 1,
    schemaVersion: "1",
    dependencyGraphVersion: "2-abc",
    sampleIndex: 0,
    strategy: "conditional",
  },
  schemaVersion: "1",
  createdAt: NOW,
  updatedAt: NOW,
};

const snapshotRow: CharacterSnapshotRow = {
  id: "snapshot_1",
  characterId: "character_1",
  populationId: "population_1",
  schemaVersion: "1",
  dependencyGraphVersion: "2-abc",
  seed: 42,
  resolvedAttributes: (characterRow.attributes as object) ?? {},
  behavioralProfile: {
    psychological: { risk_tolerance: "medium" },
    behavioral: { communication_style: "direct" },
    goals: ["close the deal"],
    constraints: ["never lie"],
  },
  provenance: {
    operation: "snapshot",
    createdAt: NOW.toISOString(),
    characterId: "character_1",
    characterSchemaVersion: "1",
  },
  usedBySimulation: false,
  createdAt: NOW,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("snapshot creation", () => {
  it("deep-copies attributes and records full sampling lineage", async () => {
    vi.mocked(characterRepo.getCharacter).mockResolvedValue(characterRow);
    vi.mocked(snapshotRepo.insertSnapshot).mockImplementation(
      async (row) => ({ ...snapshotRow, ...row, createdAt: NOW }) as CharacterSnapshotRow,
    );
    const snapshot = await snapshotService.createSnapshot({
      characterId: "character_1",
    });
    expect(snapshot.populationId).toBe("population_1");
    expect(snapshot.seed).toBe(42);
    expect(snapshot.dependencyGraphVersion).toBe("2-abc");
    expect(snapshot.behavioralProfile.goals).toEqual(["close the deal"]);
    // Deep copy: the snapshot's attributes are not the character's object.
    const inserted = vi.mocked(snapshotRepo.insertSnapshot).mock.calls[0]![0];
    expect(inserted.resolvedAttributes).toEqual(characterRow.attributes);
    expect(inserted.resolvedAttributes).not.toBe(characterRow.attributes);
  });

  it("404s on unknown character", async () => {
    vi.mocked(characterRepo.getCharacter).mockResolvedValue(undefined);
    await expect(
      snapshotService.createSnapshot({ characterId: "character_x" }),
    ).rejects.toThrow(snapshotService.CharacterNotFoundError);
  });
});

describe("snapshot immutability", () => {
  it("the snapshot module exposes no update path", () => {
    // Contract test: neither the repository nor the service exports any
    // update/mutate function besides the monotonic markSnapshotUsed.
    const mutators = (mod: object) =>
      Object.keys(mod).filter((k) => /update|mutate|set|patch/i.test(k));
    expect(mutators(snapshotRepo)).toEqual([]);
    expect(mutators(snapshotService)).toEqual([]);
  });

  it("used snapshots can never be deleted", async () => {
    vi.mocked(snapshotRepo.deleteSnapshotIfUnused).mockResolvedValue("used");
    await expect(
      snapshotService.deleteSnapshot("snapshot_1"),
    ).rejects.toThrow(SnapshotImmutableError);
    vi.mocked(snapshotRepo.deleteSnapshotIfUnused).mockResolvedValue(
      "missing",
    );
    await expect(
      snapshotService.deleteSnapshot("snapshot_x"),
    ).rejects.toThrow(SnapshotNotFoundError);
  });
});

function makeAgentRow(id: string): AgentRow {
  return {
    id,
    snapshotId: "snapshot_1",
    name: "Agent",
    goals: [],
    constraints: [],
    policy: null,
    runtimeConfig: null,
    memory: [],
    provenance: {
      operation: "instantiate",
      createdAt: NOW.toISOString(),
      snapshotId: "snapshot_1",
      characterId: "character_1",
    },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("agent instantiation", () => {
  const goal = {
    objective: "negotiate the budget",
    priority: 4,
    urgency: 0.8,
    successCriteria: ["budget approved"],
  };

  beforeEach(() => {
    vi.mocked(snapshotRepo.getSnapshot).mockResolvedValue(snapshotRow);
    vi.mocked(agentRepo.insertAgentWithStates).mockImplementation(
      async (agent, states) => ({
        agent: { ...makeAgentRow(agent.id), ...agent } as AgentRow,
        states: states.map(
          (s) =>
            ({ ...s, version: 1, createdAt: NOW, updatedAt: NOW }) as AgentStateRow,
        ),
      }),
    );
  });

  it("initializes all five state categories in one transaction", async () => {
    const agent = await agentService.createAgent({
      snapshotId: "snapshot_1",
      goals: [goal],
      constraints: [{ type: "hard", description: "stay professional" }],
    });
    expect(Object.keys(agent.state).sort()).toEqual(
      [...AGENT_STATE_CATEGORIES].sort(),
    );
    expect(agent.state["relational"]!.values["trust"]).toBe(0.5);
    expect(agent.goals[0]!.id).toMatch(/^event_/);
    expect(agent.provenance.characterId).toBe("character_1");
    expect(agentRepo.insertAgentWithStates).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid goals, constraints, categories, and state values", async () => {
    await expect(
      agentService.createAgent({
        snapshotId: "snapshot_1",
        goals: [{ ...goal, priority: 9 }],
        constraints: [],
      }),
    ).rejects.toThrow(/priority/);
    await expect(
      agentService.createAgent({
        snapshotId: "snapshot_1",
        goals: [],
        constraints: [{ type: "vague", description: "x" }],
      }),
    ).rejects.toThrow(/type must be one of/);
    await expect(
      agentService.createAgent({
        snapshotId: "snapshot_1",
        goals: [],
        constraints: [],
        initialState: { mystical: { mana: 0.5 } },
      }),
    ).rejects.toThrow(/unknown category/);
    await expect(
      agentService.createAgent({
        snapshotId: "snapshot_1",
        goals: [],
        constraints: [],
        initialState: { affective: { stress: 1.5 } },
      }),
    ).rejects.toThrow(/within \[0, 1\]/);
  });

  it("read asserts the five-category invariant", async () => {
    vi.mocked(agentRepo.getAgent).mockResolvedValue(makeAgentRow("agent_1"));
    vi.mocked(agentRepo.listStatesForAgent).mockResolvedValue([
      {
        id: "agentstate_1",
        agentId: "agent_1",
        category: "affective",
        values: { stress: 0.2 },
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
      } as AgentStateRow,
    ]);
    await expect(
      agentService.getAgentWithState("agent_1"),
    ).rejects.toThrow(/invariant violated/);
  });

  it("404s on unknown snapshot", async () => {
    vi.mocked(snapshotRepo.getSnapshot).mockResolvedValue(undefined);
    await expect(
      agentService.createAgent({
        snapshotId: "snapshot_x",
        goals: [],
        constraints: [],
      }),
    ).rejects.toThrow(SnapshotNotFoundError);
  });
});

describe("API contract (generated zod)", () => {
  it("rejects out-of-range state values and unknown categories at the boundary", async () => {
    const { CreateAgentBody, UpdateAgentStateBody } = await import(
      "@workspace/api-zod"
    );
    expect(
      UpdateAgentStateBody.safeParse({ values: { trust: 1.5 } }).success,
    ).toBe(false);
    // NOTE: Orval does not emit minProperties, so the empty-map case is
    // rejected by the domain layer (validateStateValues), not the contract.
    expect(
      UpdateAgentStateBody.safeParse({ values: { trust: 0.9 } }).success,
    ).toBe(true);
    const base = { snapshotId: "snapshot_1", goals: [], constraints: [] };
    expect(
      CreateAgentBody.safeParse({
        ...base,
        initialState: { affective: { stress: -0.2 } },
      }).success,
    ).toBe(false);
    // Unknown categories are STRIPPED (not rejected) by generated zod —
    // that's why the route forwards the raw initialState to the domain
    // layer, which rejects unknown categories explicitly.
    const stripped = CreateAgentBody.safeParse({
      ...base,
      initialState: { mystical: { mana: 0.5 } },
    });
    expect(stripped.success).toBe(true);
    if (stripped.success) {
      expect(stripped.data.initialState).toEqual({});
    }
    expect(
      CreateAgentBody.safeParse({
        ...base,
        initialState: { relational: { trust: 0.4 } },
      }).success,
    ).toBe(true);
  });
});

describe("agent state isolation", () => {
  it("state updates go only through mergeStateValues — no character or snapshot writes", async () => {
    vi.mocked(agentRepo.mergeStateValues).mockResolvedValue({
      id: "agentstate_1",
      agentId: "agent_1",
      category: "relational",
      values: { trust: 0.9 },
      version: 2,
      createdAt: NOW,
      updatedAt: NOW,
    } as AgentStateRow);
    const state = await agentService.updateAgentState({
      agentId: "agent_1",
      category: "relational",
      values: { trust: 0.9 },
    });
    expect(state.version).toBe(2);
    // Isolation: the canonical character repo and the snapshot repo were
    // never touched by a runtime state update.
    expect(vi.mocked(characterRepo.updateCharacter)).not.toHaveBeenCalled();
    expect(vi.mocked(characterRepo.insertCharacter)).not.toHaveBeenCalled();
    expect(vi.mocked(snapshotRepo.insertSnapshot)).not.toHaveBeenCalled();
    expect(vi.mocked(snapshotRepo.markSnapshotUsed)).not.toHaveBeenCalled();
  });

  it("rejects unknown categories and out-of-range values", async () => {
    await expect(
      agentService.updateAgentState({
        agentId: "agent_1",
        category: "spiritual",
        values: { chi: 0.5 },
      }),
    ).rejects.toThrow(InvalidAgentError);
    await expect(
      agentService.updateAgentState({
        agentId: "agent_1",
        category: "affective",
        values: { stress: -0.1 },
      }),
    ).rejects.toThrow(/within \[0, 1\]/);
    expect(agentRepo.mergeStateValues).not.toHaveBeenCalled();
  });

  it("distinguishes missing agent (404) from broken invariant", async () => {
    vi.mocked(agentRepo.mergeStateValues).mockResolvedValue(undefined);
    vi.mocked(agentRepo.getAgent).mockResolvedValue(undefined);
    await expect(
      agentService.updateAgentState({
        agentId: "agent_x",
        category: "affective",
        values: { stress: 0.4 },
      }),
    ).rejects.toThrow(agentService.AgentNotFoundError);
  });
});
