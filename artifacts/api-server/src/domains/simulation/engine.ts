/**
 * Negotiation-facing engine facade. The actual loop — observe → decide →
 * validate → act → state-transition → trace — lives in runtime.ts as the
 * generic, environment-agnostic implementation; this module adapts the
 * legacy flat negotiation behavior shape (action + concession + required
 * utterance in one object) onto the generic contracts and preserves the
 * original public API (`runSimulationLoop`, `validateBehavior`).
 */
import {
  PolicyExecutionError,
  type ProposedBehavior,
  type SimulationOutcome,
} from "./model";
import {
  runGenericSimulationLoop,
  validateStateDeltas,
  type EngineAgent,
  type EngineResult as GenericEngineResult,
  type Policy,
  type TraceEntry,
} from "./runtime";
import {
  validateNegotiationAction,
  type NegotiationAction,
  type Observation,
} from "./environment";
import type { Environment } from "./runtime";
import type { AgentPolicy } from "./policy";

export type { EngineAgent, TraceEntry } from "./runtime";

export type EngineResult = GenericEngineResult<SimulationOutcome>;

/**
 * Validate a legacy flat negotiation behavior; throws PolicyExecutionError
 * when invalid. Negotiation policies must always produce an utterance —
 * the generic runtime treats utterances as optional, but the negotiation
 * contract keeps them mandatory.
 */
export function validateBehavior(behavior: ProposedBehavior): void {
  validateNegotiationAction({
    action: behavior.action,
    concession: behavior.concession,
  });
  if (!behavior.utterance || !behavior.rationale) {
    throw new PolicyExecutionError(
      "Behavior must include a non-empty utterance and rationale",
    );
  }
  validateStateDeltas(behavior.stateDeltas);
}

/** Adapt a flat negotiation policy onto the generic Policy contract. */
export function toRuntimePolicy(
  policy: AgentPolicy,
): Policy<Observation, NegotiationAction> {
  return {
    type: policy.type,
    modelVersion: policy.modelVersion,
    async decide(observation, context, rng) {
      const flat = await policy.decide(observation, context, rng);
      validateBehavior(flat);
      return {
        action: { action: flat.action, concession: flat.concession },
        rationale: flat.rationale,
        utterance: flat.utterance,
        stateDeltas: flat.stateDeltas,
      };
    },
  };
}

/**
 * Run the negotiation loop. Deterministic given (seed, participants,
 * environment, policy) when the policy itself is deterministic.
 */
export async function runSimulationLoop(input: {
  environment: Environment<Observation, NegotiationAction, SimulationOutcome>;
  agents: EngineAgent[];
  policy: AgentPolicy;
  seed: number;
  maxTurns: number;
}): Promise<EngineResult> {
  return runGenericSimulationLoop({
    environment: input.environment,
    agents: input.agents,
    policy: toRuntimePolicy(input.policy),
    seed: input.seed,
    maxTurns: input.maxTurns,
  });
}
