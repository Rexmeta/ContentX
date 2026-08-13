/**
 * Generic simulation runtime (spec §6–8): Environment / Observation /
 * Action / Policy / StateTransition / SimulationTrace / Outcome as
 * domain-agnostic abstractions. The negotiation implementation
 * (environment.ts + policy.ts) is the FIRST implementation of these
 * contracts, not the contract itself.
 *
 * Behavior ≠ Utterance: a policy proposes a structured Action plus an
 * OPTIONAL utterance. Text is one manifestation of an action, never the
 * action itself — actions without utterances are first-class and are
 * recorded in the trace without an utterance event.
 *
 * Invariants enforced here:
 * - CharacterSnapshots are read-only inside the loop: each agent's
 *   snapshot is replaced by a deep-frozen clone before the first turn, so
 *   any mutation attempt by a policy throws and the caller's snapshot
 *   object is never touched.
 * - Every policy output is validated BEFORE it is applied (generic
 *   behavior validation + environment-specific action validation).
 * - The trace is a gapless total order:
 *   observation → decision(rationale) → action → stateChange? → utterance?
 *   per agent turn, closed by exactly one environment outcome event.
 */
import { mulberry32, deriveSeed, type Rng } from "../population/prng";
import { AGENT_STATE_CATEGORIES } from "../agent/model";
import type { AgentStateCategory, Goal } from "../agent/model";
import type { CharacterSnapshot } from "../character/snapshotModel";
import {
  PolicyExecutionError,
  type InteractionEventType,
  type SimulationParticipant,
} from "./model";

/** Structured, serializable action — the environment defines its shape. */
export type AgentAction = object;

/** Every observation carries the turn number; the rest is per-environment. */
export interface BaseObservation {
  turn: number;
}

/** Runtime state values, keyed category → dimension. */
export type AgentRuntimeState = Record<string, Record<string, number>>;

/**
 * A behavior proposed by a policy for one turn. The engine validates it
 * before anything is applied — policy output NEVER mutates state directly.
 */
export interface ProposedBehavior<TAction extends AgentAction = AgentAction> {
  /** The structured action, independent of any wording. */
  action: TAction;
  /** Reasoning for the decision (recorded as a decision event). */
  rationale: string;
  /** OPTIONAL text manifestation of the action (Behavior ≠ Utterance). */
  utterance?: string;
  /** Runtime state deltas per category, values in [-1, 1] (applied clamped). */
  stateDeltas: Partial<Record<AgentStateCategory, Record<string, number>>>;
}

/** Result of the environment applying a validated action. */
export interface StateTransition {
  /** Environment effects; merged into the action event payload. */
  effects: Record<string, unknown>;
}

export interface Environment<
  TObservation extends BaseObservation = BaseObservation,
  TAction extends AgentAction = AgentAction,
  TOutcome extends object = Record<string, unknown>,
> {
  readonly type: string;
  initialize(participants: SimulationParticipant[], seed: number): void;
  observe(agentId: string): TObservation;
  /** Throws PolicyExecutionError when the action violates environment rules. */
  validateAction(action: TAction): void;
  act(agentId: string, action: TAction, utterance?: string): StateTransition;
  getState(): Record<string, unknown>;
  isDone(): boolean;
  outcome(turnsUsed: number): TOutcome;
  reset(): void;
}

export interface PolicyContext {
  agentId: string;
  name: string;
  role: string;
  /** Read-only inside the loop — deep-frozen before the first turn. */
  snapshot: CharacterSnapshot;
  goals: Goal[];
  /** Current runtime state values, keyed category → dimension. */
  state: AgentRuntimeState;
}

export interface Policy<
  TObservation extends BaseObservation = BaseObservation,
  TAction extends AgentAction = AgentAction,
> {
  readonly type: string;
  /** Model id recorded in provenance; null for deterministic policies. */
  readonly modelVersion: string | null;
  decide(
    observation: TObservation,
    context: PolicyContext,
    rng: Rng,
  ): Promise<ProposedBehavior<TAction>>;
}

export interface EngineAgent {
  participant: SimulationParticipant;
  context: PolicyContext;
}

export interface TraceEntry {
  sequence: number;
  turn: number;
  actorId: string;
  type: InteractionEventType;
  payload: Record<string, unknown>;
  stateBefore: AgentRuntimeState | null;
  stateAfter: AgentRuntimeState | null;
}

export interface EngineResult<TOutcome extends object = Record<string, unknown>> {
  outcome: TOutcome;
  turnsExecuted: number;
  trace: TraceEntry[];
  /** Final runtime state per agentId → category → values. */
  finalStates: Record<string, AgentRuntimeState>;
}

function clamp01(n: number): number {
  return Math.min(Math.max(n, 0), 1);
}

/** Validate state deltas: known categories only, values in [-1, 1]. */
export function validateStateDeltas(
  stateDeltas: ProposedBehavior["stateDeltas"],
): void {
  for (const [category, values] of Object.entries(stateDeltas)) {
    if (!(AGENT_STATE_CATEGORIES as readonly string[]).includes(category)) {
      throw new PolicyExecutionError(
        `Behavior stateDeltas references unknown category "${category}"`,
      );
    }
    for (const [key, delta] of Object.entries(values)) {
      if (!Number.isFinite(delta) || delta < -1 || delta > 1) {
        throw new PolicyExecutionError(
          `Behavior state delta ${category}.${key} must be in [-1, 1], got ${delta}`,
        );
      }
    }
  }
}

/**
 * Generic validation applied to EVERY proposed behavior, independent of
 * environment. Utterance is optional, but when present it must be
 * non-empty (an empty string is neither an utterance nor its absence).
 */
export function validateProposedBehavior(behavior: ProposedBehavior): void {
  if (!behavior.rationale) {
    throw new PolicyExecutionError("Behavior must include a non-empty rationale");
  }
  if (behavior.utterance !== undefined && behavior.utterance === "") {
    throw new PolicyExecutionError(
      "Behavior utterance, when provided, must be non-empty",
    );
  }
  validateStateDeltas(behavior.stateDeltas);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function cloneState(state: AgentRuntimeState): AgentRuntimeState {
  return structuredClone(state);
}

/**
 * The agent execution loop: Observation → Policy → ProposedBehavior →
 * Action → StateTransition → Trace. Deterministic given (seed,
 * participants, environment, policy) when the policy is deterministic.
 * Runs entirely in memory over the contexts' runtime state; snapshots are
 * never modified; nothing is persisted here.
 */
export async function runGenericSimulationLoop<
  TObservation extends BaseObservation,
  TAction extends AgentAction,
  TOutcome extends object,
>(input: {
  environment: Environment<TObservation, TAction, TOutcome>;
  agents: EngineAgent[];
  policy: Policy<TObservation, TAction>;
  seed: number;
  maxTurns: number;
}): Promise<EngineResult<TOutcome>> {
  const { environment, agents, policy, seed, maxTurns } = input;
  environment.initialize(
    agents.map((a) => a.participant),
    seed,
  );
  // Snapshot immutability: policies read a deep-frozen clone. Mutation
  // attempts throw; the caller's snapshot object is never touched.
  for (const agent of agents) {
    agent.context.snapshot = deepFreeze(
      structuredClone(agent.context.snapshot),
    );
  }

  const trace: TraceEntry[] = [];
  let sequence = 0;
  let turn = 0;

  for (turn = 1; turn <= maxTurns && !environment.isDone(); turn++) {
    for (const agent of agents) {
      if (environment.isDone()) break;
      const agentId = agent.participant.agentId;
      const observation = {
        ...environment.observe(agentId),
        turn,
      };
      trace.push({
        sequence: sequence++,
        turn,
        actorId: agentId,
        type: "observation",
        payload: { ...observation } as unknown as Record<string, unknown>,
        stateBefore: null,
        stateAfter: null,
      });

      const rng = mulberry32(deriveSeed(seed, turn * 1000 + sequence));
      const behavior = await policy.decide(observation, agent.context, rng);
      // Validate BEFORE anything is applied or recorded.
      validateProposedBehavior(behavior);
      environment.validateAction(behavior.action);

      trace.push({
        sequence: sequence++,
        turn,
        actorId: agentId,
        type: "decision",
        payload: {
          ...behavior.action,
          rationale: behavior.rationale,
        } as Record<string, unknown>,
        stateBefore: null,
        stateAfter: null,
      });

      const stateBefore = cloneState(agent.context.state);
      const transition = environment.act(
        agentId,
        behavior.action,
        behavior.utterance,
      );

      trace.push({
        sequence: sequence++,
        turn,
        actorId: agentId,
        type: "action",
        payload: {
          ...behavior.action,
          ...transition.effects,
        } as Record<string, unknown>,
        stateBefore: null,
        stateAfter: null,
      });

      // Apply validated state deltas (clamped to [0, 1]) to in-memory state.
      const deltas = Object.entries(behavior.stateDeltas) as [
        AgentStateCategory,
        Record<string, number>,
      ][];
      if (deltas.length > 0) {
        for (const [category, values] of deltas) {
          const current = agent.context.state[category] ?? {};
          for (const [key, delta] of Object.entries(values)) {
            current[key] = clamp01((current[key] ?? 0.5) + delta);
          }
          agent.context.state[category] = current;
        }
        trace.push({
          sequence: sequence++,
          turn,
          actorId: agentId,
          type: "stateChange",
          payload: { deltas: behavior.stateDeltas },
          stateBefore,
          stateAfter: cloneState(agent.context.state),
        });
      }

      // Utterance is an OPTIONAL manifestation of the action.
      if (behavior.utterance !== undefined) {
        trace.push({
          sequence: sequence++,
          turn,
          actorId: agentId,
          type: "utterance",
          payload: { text: behavior.utterance },
          stateBefore: null,
          stateAfter: null,
        });
      }
    }
  }

  const turnsExecuted = Math.min(turn - 1, maxTurns);
  const outcome = environment.outcome(turnsExecuted);
  trace.push({
    sequence: sequence++,
    turn: turnsExecuted,
    actorId: "environment",
    type: "outcome",
    payload: { ...outcome } as Record<string, unknown>,
    stateBefore: null,
    stateAfter: null,
  });

  const finalStates: EngineResult["finalStates"] = {};
  for (const agent of agents) {
    finalStates[agent.participant.agentId] = cloneState(agent.context.state);
  }
  return { outcome, turnsExecuted, trace, finalStates };
}
