/**
 * Agent policies: given an observation + the agent's snapshot-derived
 * profile + current runtime state, produce a ProposedBehavior. The engine
 * validates every behavior before applying it — a policy (LLM included)
 * can only PROPOSE, never mutate.
 *
 * - heuristic: fully deterministic given the seed (reproducibility tests).
 * - llm: provider-adapter backed; output schema-validated; failures are
 *   explicit PolicyExecutionError (no silent fallback to the heuristic).
 */
import { z } from "zod/v4";
import type { Rng } from "../population/prng";
import type { CharacterSnapshot } from "../character/snapshotModel";
import { AGENT_STATE_CATEGORIES } from "../agent/model";
import {
  PolicyExecutionError,
  type ProposedBehavior,
} from "./model";
import type { Observation } from "./environment";
import type { PolicyContext } from "./runtime";
import { completeJSON, LLM_MODEL_ID, LLMRequestError } from "../ai/llmClient";

export type { PolicyContext } from "./runtime";

/**
 * Legacy flat negotiation policy contract (NegotiationPolicy). Adapted
 * onto the generic runtime Policy via engine.toRuntimePolicy.
 */
export interface AgentPolicy {
  readonly type: "heuristic" | "llm";
  /** Model id recorded in provenance; null for deterministic policies. */
  readonly modelVersion: string | null;
  decide(
    observation: Observation,
    context: PolicyContext,
    rng: Rng,
  ): Promise<ProposedBehavior>;
}

/** Spec-facing alias: negotiation's policy implementation contract. */
export type NegotiationPolicy = AgentPolicy;

function riskToleranceOf(snapshot: CharacterSnapshot): number {
  const raw = snapshot.behavioralProfile.psychological["risk_tolerance"];
  if (raw === "low") return 0.25;
  if (raw === "high") return 0.75;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(Math.max(raw, 0), 1);
  }
  return 0.5; // "medium" and absent both mean neutral
}

/**
 * Deterministic negotiation heuristic. Concession appetite rises with
 * cooperativeness/trust and falls with risk tolerance (risk-tolerant
 * negotiators hold out longer). Same seed → same behavior sequence.
 */
export const heuristicPolicy: AgentPolicy = {
  type: "heuristic",
  modelVersion: null,
  async decide(observation, context, rng): Promise<ProposedBehavior> {
    const cooperativeness =
      context.state["relational"]?.["cooperativeness"] ?? 0.5;
    const trust = context.state["relational"]?.["trust"] ?? 0.5;
    const stress = context.state["affective"]?.["stress"] ?? 0.5;
    const riskTolerance = riskToleranceOf(context.snapshot);

    const appetite =
      0.35 * cooperativeness + 0.25 * trust + 0.2 * stress + 0.2 * (1 - riskTolerance);
    const noise = (rng() - 0.5) * 0.1;

    if (observation.gap <= 0.15) {
      return {
        action: "accept",
        concession: 0,
        rationale: `Gap ${observation.gap.toFixed(3)} is within acceptable range; closing beats holding out (riskTolerance=${riskTolerance}).`,
        utterance: `I think we're close enough on ${observation.topic} — I can accept these terms.`,
        stateDeltas: {
          relational: { trust: 0.05, rapport: 0.05 },
          affective: { stress: -0.1 },
        },
      };
    }
    const concession = Math.min(Math.max(appetite * 0.5 + noise, 0.02), 0.6);
    const conceding = concession >= 0.15;
    return {
      action: conceding ? "concede" : "hold",
      concession: conceding ? concession : 0,
      rationale: conceding
        ? `Gap ${observation.gap.toFixed(3)} is wide; conceding ${concession.toFixed(3)} (cooperativeness=${cooperativeness.toFixed(2)}, riskTolerance=${riskTolerance}).`
        : `Holding position — appetite ${appetite.toFixed(3)} too low to move (riskTolerance=${riskTolerance}).`,
      utterance: conceding
        ? `On ${observation.topic}, I can move somewhat toward your number, but I need movement from your side too.`
        : `My position on ${observation.topic} stands — the current proposal doesn't work for us.`,
      stateDeltas: conceding
        ? { relational: { rapport: 0.03 }, affective: { stress: 0.02 } }
        : { affective: { stress: 0.05 }, relational: { rapport: -0.02 } },
    };
  },
};

// STRICT: undeclared provider fields are a contract violation (502), never
// silently stripped. Exported for contract tests.
export const llmBehaviorSchema = z.strictObject({
  action: z.enum(["concede", "hold", "propose", "accept", "reject"]),
  concession: z.number().min(0).max(1),
  rationale: z.string().min(1),
  utterance: z.string().min(1),
  // partialRecord: enum-keyed z.record in zod v4 demands ALL keys present;
  // deltas may touch any subset of the five categories.
  stateDeltas: z.partialRecord(
    z.enum(AGENT_STATE_CATEGORIES),
    z.record(z.string(), z.number().min(-1).max(1)),
  ),
});

/**
 * LLM-backed policy. The model only proposes a structured behavior; the
 * output is schema-validated here and re-validated by the engine. Invalid
 * output or provider failure is an explicit PolicyExecutionError.
 */
export const llmPolicy: AgentPolicy = {
  type: "llm",
  modelVersion: LLM_MODEL_ID,
  async decide(observation, context) {
    const goals = context.goals
      .map((g) => `- ${g.objective} (priority ${g.priority}, urgency ${g.urgency})`)
      .join("\n");
    let raw: unknown;
    try {
      raw = await completeJSON({
        system: `You are role-playing ${context.name} (${context.role}) in a negotiation simulation. Decide ONE structured negotiation behavior. Respond with JSON only: {"action":"concede|hold|propose|accept|reject","concession":0..1,"rationale":"...","utterance":"...","stateDeltas":{"affective":{"stress":-1..1},...}} — categories limited to affective/relational/motivational/cognitive/behavioral. Only "accept" when the gap is small. Stay in character; the psychological profile governs risk appetite.`,
        user: JSON.stringify({
          topic: observation.topic,
          turn: observation.turn,
          ownPosition: observation.ownPosition,
          counterpartPositions: observation.counterpartPositions,
          gap: observation.gap,
          lastUtterances: observation.lastUtterances,
          profile: context.snapshot.behavioralProfile,
          goals,
          currentState: context.state,
        }),
      });
    } catch (err) {
      if (err instanceof LLMRequestError) {
        throw new PolicyExecutionError(
          `LLM policy request failed: ${err.message}`,
        );
      }
      throw err;
    }
    const parsed = llmBehaviorSchema.safeParse(raw);
    if (!parsed.success) {
      throw new PolicyExecutionError(
        `LLM policy returned invalid behavior: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  },
};

export function resolvePolicy(type: "heuristic" | "llm"): AgentPolicy {
  return type === "llm" ? llmPolicy : heuristicPolicy;
}
