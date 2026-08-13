import { newId } from "../../shared/id";
import * as repo from "./repository";
import * as snapshotService from "../character/snapshotService";
import { SnapshotNotFoundError } from "../character/snapshotModel";
import type { AgentRow, AgentStateRow } from "@workspace/db";
import {
  AGENT_STATE_CATEGORIES,
  DEFAULT_STATE_VALUES,
  AgentNotFoundError,
  InvalidAgentError,
  validateGoalInput,
  validateConstraintInput,
  validateStateValues,
  type Agent,
  type AgentConstraint,
  type AgentProvenance,
  type AgentState,
  type AgentStateCategory,
  type AgentWithState,
  type Goal,
} from "./model";

export { AgentNotFoundError, InvalidAgentError };
export { SnapshotNotFoundError };

export function toAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    snapshotId: row.snapshotId,
    name: row.name,
    goals: row.goals as Goal[],
    constraints: row.constraints as AgentConstraint[],
    policy: (row.policy as Record<string, unknown> | null) ?? null,
    runtimeConfig: (row.runtimeConfig as Record<string, unknown> | null) ?? null,
    memory: (row.memory as unknown[]) ?? [],
    provenance: row.provenance as AgentProvenance,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAgentState(row: AgentStateRow): AgentState {
  return {
    id: row.id,
    agentId: row.agentId,
    category: row.category as AgentStateCategory,
    values: row.values as Record<string, number>,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Build the category→state map and assert the five-category invariant —
 * an agent with missing state rows is corrupt data, not a valid response.
 */
function stateMap(rows: AgentStateRow[]): Record<string, AgentState> {
  const map = Object.fromEntries(
    rows.map((r) => [r.category, toAgentState(r)]),
  );
  for (const category of AGENT_STATE_CATEGORIES) {
    if (!map[category]) {
      throw new Error(
        `Agent state invariant violated: category "${category}" missing (agent "${rows[0]?.agentId ?? "unknown"}").`,
      );
    }
  }
  return map;
}

/**
 * Instantiate an agent from an immutable snapshot. Goals/constraints are
 * validated as first-class concepts; all five state categories are
 * initialized with explicit defaults in the same transaction.
 */
export async function createAgent(input: {
  snapshotId: string;
  name?: string | undefined;
  goals: { objective: string; priority: number; urgency: number; successCriteria: string[] }[];
  constraints: { type: string; description: string }[];
  policy?: Record<string, unknown> | undefined;
  runtimeConfig?: Record<string, unknown> | undefined;
  initialState?: Partial<Record<string, Record<string, number>>> | undefined;
}): Promise<AgentWithState> {
  const snapshot = await snapshotService.getSnapshot(input.snapshotId);
  if (!snapshot) throw new SnapshotNotFoundError(input.snapshotId);

  input.goals.forEach((g, i) => validateGoalInput(g, `goals[${i}]`));
  input.constraints.forEach((c, i) =>
    validateConstraintInput(c, `constraints[${i}]`),
  );
  for (const [category, values] of Object.entries(input.initialState ?? {})) {
    if (!AGENT_STATE_CATEGORIES.includes(category as AgentStateCategory)) {
      throw new InvalidAgentError(
        `initialState: unknown category "${category}". Allowed: ${AGENT_STATE_CATEGORIES.join(", ")}.`,
      );
    }
    if (values) validateStateValues(values, `initialState.${category}`);
  }

  const agentId = newId("agent");
  const goals: Goal[] = input.goals.map((g) => ({ id: newId("event"), ...g }));
  const constraints: AgentConstraint[] = input.constraints.map((c) => ({
    id: newId("event"),
    type: c.type as AgentConstraint["type"],
    description: c.description,
  }));

  const { agent, states } = await repo.insertAgentWithStates(
    {
      id: agentId,
      snapshotId: snapshot.id,
      name: input.name?.trim() || `Agent of ${snapshot.characterId}`,
      goals,
      constraints,
      policy: input.policy ?? null,
      runtimeConfig: input.runtimeConfig ?? null,
      memory: [],
      provenance: {
        operation: "instantiate",
        createdAt: new Date().toISOString(),
        snapshotId: snapshot.id,
        characterId: snapshot.characterId,
      } satisfies AgentProvenance,
    },
    AGENT_STATE_CATEGORIES.map((category) => ({
      id: newId("agentstate"),
      agentId,
      category,
      values: {
        ...DEFAULT_STATE_VALUES[category],
        ...(input.initialState?.[category] ?? {}),
      },
      version: 1,
    })),
  );
  return { ...toAgent(agent), state: stateMap(states) };
}

export async function getAgentWithState(
  id: string,
): Promise<AgentWithState | null> {
  const row = await repo.getAgent(id);
  if (!row) return null;
  const states = await repo.listStatesForAgent(id);
  return { ...toAgent(row), state: stateMap(states) };
}

export async function listAgents(): Promise<Agent[]> {
  return (await repo.listAgents()).map(toAgent);
}

export async function deleteAgent(id: string): Promise<boolean> {
  return repo.deleteAgent(id);
}

/**
 * Update one state category (merge semantics, version bump). This is the
 * ONLY mutation path for runtime state — it can never touch the canonical
 * character or the snapshot.
 */
export async function updateAgentState(input: {
  agentId: string;
  category: string;
  values: Record<string, number>;
}): Promise<AgentState> {
  if (
    !AGENT_STATE_CATEGORIES.includes(input.category as AgentStateCategory)
  ) {
    throw new InvalidAgentError(
      `Unknown state category "${input.category}". Allowed: ${AGENT_STATE_CATEGORIES.join(", ")}.`,
    );
  }
  validateStateValues(input.values, "values");
  const updated = await repo.mergeStateValues(
    input.agentId,
    input.category,
    input.values,
  );
  if (!updated) {
    const agent = await repo.getAgent(input.agentId);
    if (!agent) throw new AgentNotFoundError(input.agentId);
    throw new Error(
      `State category "${input.category}" missing for agent "${input.agentId}" — initialization invariant violated.`,
    );
  }
  return toAgentState(updated);
}
