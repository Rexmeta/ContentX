/**
 * Simulation engine — the observe → decide → act → state-transition loop.
 * Runs entirely in memory over cloned agent state; nothing is persisted
 * here. Every policy output is validated BEFORE it is applied (LLM output
 * never mutates state directly), and every step is recorded as an
 * InteractionEvent with stateBefore/stateAfter around state transitions.
 */
import { mulberry32, deriveSeed } from "../population/prng";
import { AGENT_STATE_CATEGORIES } from "../agent/model";
import type { AgentStateCategory } from "../agent/model";
import {
  PolicyExecutionError,
  type InteractionEventType,
  type ProposedBehavior,
  type SimulationOutcome,
  type SimulationParticipant,
} from "./model";
import type { Environment } from "./environment";
import type { AgentPolicy, PolicyContext } from "./policy";

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
  stateBefore: Record<string, Record<string, number>> | null;
  stateAfter: Record<string, Record<string, number>> | null;
}

export interface EngineResult {
  outcome: SimulationOutcome;
  turnsExecuted: number;
  trace: TraceEntry[];
  /** Final runtime state per agentId → category → values. */
  finalStates: Record<string, Record<string, Record<string, number>>>;
}

function clamp01(n: number): number {
  return Math.min(Math.max(n, 0), 1);
}

/** Validate a proposed behavior; throws PolicyExecutionError when invalid. */
export function validateBehavior(behavior: ProposedBehavior): void {
  const actions = ["concede", "hold", "propose", "accept", "reject"];
  if (!actions.includes(behavior.action)) {
    throw new PolicyExecutionError(
      `Behavior action "${behavior.action}" is not one of ${actions.join(", ")}`,
    );
  }
  if (
    !Number.isFinite(behavior.concession) ||
    behavior.concession < 0 ||
    behavior.concession > 1
  ) {
    throw new PolicyExecutionError(
      `Behavior concession must be a finite number in [0, 1], got ${behavior.concession}`,
    );
  }
  if (!behavior.utterance || !behavior.rationale) {
    throw new PolicyExecutionError(
      "Behavior must include a non-empty utterance and rationale",
    );
  }
  for (const [category, values] of Object.entries(behavior.stateDeltas)) {
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

function cloneState(
  state: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> {
  return structuredClone(state);
}

/**
 * Run the loop. Deterministic given (seed, participants, environment,
 * policy) when the policy itself is deterministic.
 */
export async function runSimulationLoop(input: {
  environment: Environment;
  agents: EngineAgent[];
  policy: AgentPolicy;
  seed: number;
  maxTurns: number;
}): Promise<EngineResult> {
  const { environment, agents, policy, seed, maxTurns } = input;
  environment.initialize(
    agents.map((a) => a.participant),
    seed,
  );
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
        payload: { ...observation },
        stateBefore: null,
        stateAfter: null,
      });

      const rng = mulberry32(deriveSeed(seed, turn * 1000 + sequence));
      const behavior = await policy.decide(observation, agent.context, rng);
      validateBehavior(behavior);

      trace.push({
        sequence: sequence++,
        turn,
        actorId: agentId,
        type: "decision",
        payload: {
          action: behavior.action,
          concession: behavior.concession,
          rationale: behavior.rationale,
        },
        stateBefore: null,
        stateAfter: null,
      });

      const stateBefore = cloneState(agent.context.state);
      const actResult = environment.act(agentId, behavior);

      trace.push({
        sequence: sequence++,
        turn,
        actorId: agentId,
        type: "action",
        payload: {
          action: behavior.action,
          concession: behavior.concession,
          newPosition: actResult.newPosition,
          closed: actResult.closed,
        },
        stateBefore: null,
        stateAfter: null,
      });
      trace.push({
        sequence: sequence++,
        turn,
        actorId: agentId,
        type: "utterance",
        payload: { text: behavior.utterance },
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
    }
  }

  const turnsExecuted = Math.min(turn - 1, maxTurns);
  const outcome = environment.outcome(turnsExecuted);
  trace.push({
    sequence: sequence++,
    turn: turnsExecuted,
    actorId: "environment",
    type: "outcome",
    payload: { ...outcome },
    stateBefore: null,
    stateAfter: null,
  });

  const finalStates: EngineResult["finalStates"] = {};
  for (const agent of agents) {
    finalStates[agent.participant.agentId] = cloneState(agent.context.state);
  }
  return { outcome, turnsExecuted, trace, finalStates };
}
