/**
 * Trace-based evaluators. All three read ONLY the immutable trace and the
 * simulation record + snapshots — evaluation never re-runs anything and
 * never mutates anything.
 */
import type { CharacterSnapshot } from "../character/snapshotModel";
import type { InteractionEvent, Simulation } from "../simulation/model";

export const EVALUATOR_VERSION = "1.0.0";

function clamp01(n: number): number {
  return Math.min(Math.max(n, 0), 1);
}

function eventsByActor(
  trace: InteractionEvent[],
  actorId: string,
): InteractionEvent[] {
  return trace.filter((e) => e.actorId === actorId);
}

export interface EvaluatorResult {
  scores: Record<string, number>;
  findings: Record<string, unknown>;
}

/**
 * BehaviorEvaluation (subject: agent) — how the agent behaved: activity,
 * initiative, cooperativeness of moves, and state volatility, all counted
 * from the trace.
 */
export function evaluateBehavior(
  trace: InteractionEvent[],
  agentId: string,
): EvaluatorResult {
  const own = eventsByActor(trace, agentId);
  const decisions = own.filter((e) => e.type === "decision");
  const counts: Record<string, number> = {};
  for (const d of decisions) {
    const action = String(d.payload["action"]);
    counts[action] = (counts[action] ?? 0) + 1;
  }
  const total = decisions.length;
  const cooperativeMoves = (counts["concede"] ?? 0) + (counts["accept"] ?? 0);
  const stateChanges = own.filter((e) => e.type === "stateChange");
  let totalDeltaMagnitude = 0;
  let deltaCount = 0;
  for (const sc of stateChanges) {
    const deltas = sc.payload["deltas"] as
      | Record<string, Record<string, number>>
      | undefined;
    if (!deltas) continue;
    for (const values of Object.values(deltas)) {
      for (const d of Object.values(values)) {
        totalDeltaMagnitude += Math.abs(d);
        deltaCount++;
      }
    }
  }
  return {
    scores: {
      activityScore: clamp01(total === 0 ? 0 : 1),
      cooperativenessScore: clamp01(total === 0 ? 0 : cooperativeMoves / total),
      stateVolatility: clamp01(
        deltaCount === 0 ? 0 : totalDeltaMagnitude / deltaCount,
      ),
    },
    findings: {
      decisionCount: total,
      actionCounts: counts,
      utteranceCount: own.filter((e) => e.type === "utterance").length,
      stateChangeCount: stateChanges.length,
    },
  };
}

/**
 * PersonaFidelityEvaluation (subject: agent) — did observed behavior match
 * the snapshot's psychological profile? E.g. expected riskTolerance=low →
 * high concession rate expected; deviation lowers fidelityScore.
 */
export function evaluatePersonaFidelity(
  trace: InteractionEvent[],
  agentId: string,
  snapshot: CharacterSnapshot,
): EvaluatorResult {
  const decisions = eventsByActor(trace, agentId).filter(
    (e) => e.type === "decision",
  );
  const total = decisions.length;
  const conceding = decisions.filter((d) =>
    ["concede", "accept"].includes(String(d.payload["action"])),
  ).length;
  const observedConcessionRate = total === 0 ? 0 : conceding / total;

  const raw = snapshot.behavioralProfile.psychological["risk_tolerance"];
  let expectedRate: number;
  let expectedLabel: string;
  if (raw === "low") {
    expectedRate = 0.7; // risk-averse negotiators concede readily
    expectedLabel = "low";
  } else if (raw === "high") {
    expectedRate = 0.3; // risk-tolerant negotiators hold out
    expectedLabel = "high";
  } else if (typeof raw === "number" && Number.isFinite(raw)) {
    expectedRate = 1 - clamp01(raw);
    expectedLabel = String(raw);
  } else {
    expectedRate = 0.5;
    expectedLabel = raw === undefined ? "unspecified" : String(raw);
  }
  const deviation = Math.abs(observedConcessionRate - expectedRate);
  return {
    scores: {
      fidelityScore: clamp01(1 - deviation),
    },
    findings: {
      trait: "risk_tolerance",
      expected: expectedLabel,
      expectedConcessionRate: expectedRate,
      observedConcessionRate,
      deviation,
      decisionCount: total,
      note:
        total === 0
          ? "No decisions observed; fidelity computed against zero activity."
          : undefined,
    },
  };
}

/**
 * OutcomeEvaluation (subject: simulation) — did the interaction reach its
 * goal, how efficiently, and how far apart the parties ended.
 */
export function evaluateOutcome(
  simulation: Simulation,
  trace: InteractionEvent[],
): EvaluatorResult {
  const outcome = simulation.outcome;
  if (!outcome) {
    return {
      scores: { successScore: 0, efficiencyScore: 0 },
      findings: { note: "Simulation has no recorded outcome." },
    };
  }
  const efficiency =
    simulation.config.maxTurns === 0
      ? 0
      : 1 - (outcome.turnsUsed - 1) / simulation.config.maxTurns;
  return {
    scores: {
      successScore: outcome.agreementReached ? 1 : clamp01(1 - outcome.finalGap),
      efficiencyScore: outcome.agreementReached ? clamp01(efficiency) : 0,
      convergenceScore: clamp01(1 - outcome.finalGap),
    },
    findings: {
      agreementReached: outcome.agreementReached,
      finalGap: outcome.finalGap,
      finalPositions: outcome.finalPositions,
      turnsUsed: outcome.turnsUsed,
      maxTurns: simulation.config.maxTurns,
      traceEventCount: trace.length,
      summary: outcome.summary,
    },
  };
}
