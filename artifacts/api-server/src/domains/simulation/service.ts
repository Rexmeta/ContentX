/**
 * Simulation service — orchestrates: resolve agents + snapshots, run the
 * engine loop, then persist simulation + immutable trace + final agent
 * state + snapshot used-marks in ONE transaction. The canonical Character
 * is never touched by a simulation.
 */
import type { SimulationRow, InteractionEventRow } from "@workspace/db";
import { newId } from "../../shared/id";
import * as agentService from "../agent/service";
import * as snapshotService from "../character/snapshotService";
import { SnapshotNotFoundError } from "../character/snapshotModel";
import { AgentNotFoundError, type Goal } from "../agent/model";
import { TextEnvironment } from "./environment";
import { resolvePolicy, type PolicyContext } from "./policy";
import { runSimulationLoop, type EngineAgent } from "./engine";
import * as repo from "./repository";
import {
  InvalidSimulationError,
  SIMULATION_POLICIES,
  type InteractionEvent,
  type Simulation,
  type SimulationConfig,
  type SimulationOutcome,
  type SimulationParticipant,
  type SimulationProvenance,
} from "./model";

export { SimulationNotFoundError, InvalidSimulationError } from "./model";

const MAX_TURNS_LIMIT = 50;

export function toSimulation(row: SimulationRow): Simulation {
  return {
    id: row.id,
    name: row.name,
    environmentType: row.environmentType as Simulation["environmentType"],
    config: row.config as SimulationConfig,
    participants: row.participants as SimulationParticipant[],
    seed: row.seed,
    status: row.status as Simulation["status"],
    turnsExecuted: row.turnsExecuted,
    outcome: (row.outcome as SimulationOutcome | null) ?? null,
    error: row.error,
    provenance: row.provenance as SimulationProvenance,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export function toInteractionEvent(row: InteractionEventRow): InteractionEvent {
  return {
    id: row.id,
    simulationId: row.simulationId,
    sequence: row.sequence,
    turn: row.turn,
    actorId: row.actorId,
    type: row.type as InteractionEvent["type"],
    payload: row.payload as Record<string, unknown>,
    stateBefore:
      (row.stateBefore as Record<string, Record<string, number>> | null) ??
      null,
    stateAfter:
      (row.stateAfter as Record<string, Record<string, number>> | null) ??
      null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Create AND run a simulation synchronously. Roles map 1:1 to agentIds
 * (same order); when omitted, roles default to "participant N".
 */
export async function runSimulation(input: {
  name: string;
  topic: string;
  agentIds: string[];
  seed: number;
  maxTurns?: number;
  policy?: string;
  roles?: string[];
}): Promise<Simulation> {
  const maxTurns = input.maxTurns ?? 10;
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > MAX_TURNS_LIMIT) {
    throw new InvalidSimulationError(
      `maxTurns must be an integer in [1, ${MAX_TURNS_LIMIT}]`,
    );
  }
  if (!Number.isFinite(input.seed)) {
    throw new InvalidSimulationError("seed must be a finite number");
  }
  const policyType = input.policy ?? "heuristic";
  if (!(SIMULATION_POLICIES as readonly string[]).includes(policyType)) {
    throw new InvalidSimulationError(
      `policy must be one of: ${SIMULATION_POLICIES.join(", ")}`,
    );
  }
  const uniqueAgentIds = new Set(input.agentIds);
  if (input.agentIds.length < 2 || uniqueAgentIds.size !== input.agentIds.length) {
    throw new InvalidSimulationError(
      "A simulation requires at least 2 distinct agentIds",
    );
  }
  if (input.roles && input.roles.length !== input.agentIds.length) {
    throw new InvalidSimulationError(
      "roles, when provided, must match agentIds in length and order",
    );
  }

  // Resolve agents, their runtime state, and their snapshots. State
  // versions are captured for optimistic concurrency at persist time.
  const engineAgents: EngineAgent[] = [];
  const versionsByAgent = new Map<string, Record<string, number>>();
  for (const [i, agentId] of input.agentIds.entries()) {
    const withState = await agentService.getAgentWithState(agentId);
    if (!withState) throw new AgentNotFoundError(agentId);
    const snapshot = await snapshotService.getSnapshot(withState.snapshotId);
    if (!snapshot) throw new SnapshotNotFoundError(withState.snapshotId);
    const participant: SimulationParticipant = {
      agentId,
      snapshotId: snapshot.id,
      characterId: snapshot.characterId,
      name: withState.name,
      role: input.roles?.[i] ?? `participant ${i + 1}`,
    };
    const state: Record<string, Record<string, number>> = {};
    const stateVersions: Record<string, number> = {};
    for (const [category, s] of Object.entries(withState.state)) {
      state[category] = { ...s.values };
      stateVersions[category] = s.version;
    }
    versionsByAgent.set(agentId, stateVersions);
    const context: PolicyContext = {
      agentId,
      name: withState.name,
      role: participant.role,
      snapshot,
      goals: withState.goals as Goal[],
      state,
    };
    engineAgents.push({ participant, context });
  }

  const policy = resolvePolicy(policyType as "heuristic" | "llm");
  const environment = new TextEnvironment({ topic: input.topic });
  const config: SimulationConfig = {
    topic: input.topic,
    maxTurns,
    policy: policy.type,
  };
  const simulationId = newId("simulation");
  const now = new Date();
  const provenance: SimulationProvenance = {
    operation: "simulate",
    createdAt: now.toISOString(),
    seed: input.seed,
    environmentType: "text",
    policy: policy.type,
    modelVersion: policy.modelVersion,
    snapshotIds: engineAgents.map((a) => a.participant.snapshotId),
  };

  const result = await runSimulationLoop({
    environment,
    agents: engineAgents,
    policy,
    seed: input.seed,
    maxTurns,
  });

  // Persist final agent state as absolute values (merge over current rows).
  const stateMerges: repo.StateMerge[] = [];
  for (const agent of engineAgents) {
    const final = result.finalStates[agent.participant.agentId] ?? {};
    const versions = versionsByAgent.get(agent.participant.agentId) ?? {};
    for (const [category, values] of Object.entries(final)) {
      const expectedVersion = versions[category];
      if (expectedVersion === undefined) {
        throw new Error(
          `Missing captured state version for agent "${agent.participant.agentId}" category "${category}"`,
        );
      }
      stateMerges.push({
        agentId: agent.participant.agentId,
        category,
        values,
        expectedVersion,
      });
    }
  }

  const { simulation } = await repo.insertSimulationWithTrace(
    {
      id: simulationId,
      name: input.name,
      environmentType: "text",
      config,
      participants: engineAgents.map((a) => a.participant),
      seed: input.seed,
      status: "completed",
      turnsExecuted: result.turnsExecuted,
      outcome: result.outcome,
      error: null,
      provenance,
      completedAt: new Date(),
    },
    result.trace.map((entry) => ({
      id: newId("interaction"),
      simulationId,
      sequence: entry.sequence,
      turn: entry.turn,
      actorId: entry.actorId,
      type: entry.type,
      payload: entry.payload,
      stateBefore: entry.stateBefore,
      stateAfter: entry.stateAfter,
    })),
    stateMerges,
    // Mark every participating snapshot as used (false→true is the only
    // allowed transition; already-used snapshots stay used).
    engineAgents.map((a) => a.participant.snapshotId),
  );
  return toSimulation(simulation);
}

export async function getSimulation(
  id: string,
): Promise<Simulation | undefined> {
  const row = await repo.getSimulation(id);
  return row ? toSimulation(row) : undefined;
}

export async function listSimulations(): Promise<Simulation[]> {
  return (await repo.listSimulations()).map(toSimulation);
}

export async function listEvents(
  simulationId: string,
): Promise<InteractionEvent[] | undefined> {
  const sim = await repo.getSimulation(simulationId);
  if (!sim) return undefined;
  return (await repo.listEventsForSimulation(simulationId)).map(
    toInteractionEvent,
  );
}

/** Re-export for evaluation domain use (avoids a repo import there). */
export async function getTrace(
  simulationId: string,
): Promise<InteractionEvent[]> {
  return (await repo.listEventsForSimulation(simulationId)).map(
    toInteractionEvent,
  );
}
