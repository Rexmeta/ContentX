/**
 * Simulation domain model. Behavior is represented independently of text:
 * a Behavior is an Action/Decision/Utterance/StateChange — utterances are
 * one manifestation, never the model itself.
 */
import type { AgentStateCategory } from "../agent/model";

export const INTERACTION_EVENT_TYPES = [
  "observation",
  "action",
  "utterance",
  "decision",
  "toolCall",
  "stateChange",
  "outcome",
] as const;
export type InteractionEventType = (typeof INTERACTION_EVENT_TYPES)[number];

export const SIMULATION_ENVIRONMENTS = ["text"] as const;
export type SimulationEnvironmentType =
  (typeof SIMULATION_ENVIRONMENTS)[number];

export const SIMULATION_POLICIES = ["heuristic", "llm"] as const;
export type SimulationPolicyType = (typeof SIMULATION_POLICIES)[number];

export interface SimulationParticipant {
  agentId: string;
  snapshotId: string;
  characterId: string;
  name: string;
  role: string;
}

export interface SimulationConfig {
  topic: string;
  maxTurns: number;
  policy: SimulationPolicyType;
}

export interface SimulationProvenance {
  operation: "simulate";
  createdAt: string;
  seed: number;
  environmentType: SimulationEnvironmentType;
  policy: SimulationPolicyType;
  /** Model id when policy = llm; null for the deterministic heuristic. */
  modelVersion: string | null;
  snapshotIds: string[];
}

export interface SimulationOutcome {
  agreementReached: boolean;
  finalGap: number;
  finalPositions: Record<string, number>;
  turnsUsed: number;
  summary: string;
}

export interface Simulation {
  id: string;
  name: string;
  environmentType: SimulationEnvironmentType;
  config: SimulationConfig;
  participants: SimulationParticipant[];
  seed: number;
  status: "completed" | "failed";
  turnsExecuted: number;
  outcome: SimulationOutcome | null;
  error: string | null;
  provenance: SimulationProvenance;
  createdAt: string;
  completedAt: string | null;
}

export interface InteractionEvent {
  id: string;
  simulationId: string;
  sequence: number;
  turn: number;
  actorId: string;
  type: InteractionEventType;
  payload: Record<string, unknown>;
  stateBefore: Record<string, Record<string, number>> | null;
  stateAfter: Record<string, Record<string, number>> | null;
  createdAt: string;
}

/**
 * A behavior proposed by an agent policy for one turn. The engine
 * validates it before anything is applied — LLM output NEVER mutates
 * state directly.
 */
export interface ProposedBehavior {
  /** Negotiation move — the structured action, independent of wording. */
  action: "concede" | "hold" | "propose" | "accept" | "reject";
  /** How far to move toward the counterpart, in [0, 1]. */
  concession: number;
  /** Reasoning for the decision (recorded as a decision event). */
  rationale: string;
  /** Text manifestation of the action. */
  utterance: string;
  /** Runtime state deltas per category, values in [-1, 1] (applied clamped). */
  stateDeltas: Partial<Record<AgentStateCategory, Record<string, number>>>;
}

export class SimulationNotFoundError extends Error {
  constructor(id: string) {
    super(`Simulation "${id}" not found`);
    this.name = "SimulationNotFoundError";
  }
}

export class InvalidSimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSimulationError";
  }
}

/** Policy produced output that failed validation, or the provider failed. */
export class PolicyExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyExecutionError";
  }
}
