/**
 * Negotiation environment — the FIRST implementation of the generic
 * runtime contracts (runtime.ts). The interface is deliberately
 * independent of voice/avatar/UI — those are projections of the trace,
 * never part of the environment contract.
 *
 * NegotiationAction is the structured, wording-independent action; an
 * utterance is only an optional text manifestation passed alongside it.
 * The action's field is named `action` (not `kind`) to keep persisted
 * interaction_events payloads byte-compatible with earlier runs.
 */
import {
  PolicyExecutionError,
  type ProposedBehavior as LegacyProposedBehavior,
  type SimulationOutcome,
  type SimulationParticipant,
} from "./model";
import type { BaseObservation, Environment, StateTransition } from "./runtime";

export const NEGOTIATION_MOVES = [
  "concede",
  "hold",
  "propose",
  "accept",
  "reject",
] as const;
export type NegotiationMove = (typeof NEGOTIATION_MOVES)[number];

/** Structured negotiation action — independent of any wording. */
export type NegotiationAction = {
  action: NegotiationMove;
  /** How far to move toward the counterpart, in [0, 1]. */
  concession: number;
};

/** Throws PolicyExecutionError when the action violates negotiation rules. */
export function validateNegotiationAction(action: NegotiationAction): void {
  if (!(NEGOTIATION_MOVES as readonly string[]).includes(action.action)) {
    throw new PolicyExecutionError(
      `Behavior action "${action.action}" is not one of ${NEGOTIATION_MOVES.join(", ")}`,
    );
  }
  if (
    !Number.isFinite(action.concession) ||
    action.concession < 0 ||
    action.concession > 1
  ) {
    throw new PolicyExecutionError(
      `Behavior concession must be a finite number in [0, 1], got ${action.concession}`,
    );
  }
}

export interface Observation extends BaseObservation {
  turn: number;
  topic: string;
  /** Actor's own current position in [0, 1]. */
  ownPosition: number;
  /** Counterpart positions keyed by agentId. */
  counterpartPositions: Record<string, number>;
  /** Distance still separating the parties, in [0, 1]. */
  gap: number;
  /** Most recent utterance per agentId (text manifestation only). */
  lastUtterances: Record<string, string>;
  /** Whether the counterpart proposed acceptance last turn. */
  pendingAcceptance: boolean;
}

export type NegotiationObservation = Observation;

export interface ActResult extends StateTransition {
  /** Position after the environment applied the validated action. */
  newPosition: number;
  /** Whether this act closed the negotiation (both sides accepted). */
  closed: boolean;
}

interface NegotiationEnvConfig {
  topic: string;
  /** Gap below which an `accept` succeeds. */
  agreementThreshold?: number;
}

/**
 * NegotiationEnvironment — a two-or-more-party negotiation. Each
 * participant holds a position in [0, 1]; positions start spread apart
 * deterministically from the seed. Concessions move a party toward the
 * mean of the others. Agreement is reached when a party accepts while the
 * gap is within the threshold. Purely deterministic given seed + actions.
 *
 * `act` also accepts the legacy flat ProposedBehavior shape (action +
 * concession + utterance in one object) for backward compatibility.
 */
export class NegotiationEnvironment
  implements Environment<Observation, NegotiationAction, SimulationOutcome>
{
  readonly type = "text";
  private readonly topic: string;
  private readonly threshold: number;
  private participants: SimulationParticipant[] = [];
  private positions = new Map<string, number>();
  private utterances = new Map<string, string>();
  private acceptedBy = new Set<string>();
  private closed = false;
  private seed = 0;

  constructor(config: NegotiationEnvConfig) {
    this.topic = config.topic;
    this.threshold = config.agreementThreshold ?? 0.15;
  }

  initialize(participants: SimulationParticipant[], seed: number): void {
    if (participants.length < 2) {
      throw new Error("NegotiationEnvironment requires at least 2 participants");
    }
    this.participants = participants;
    this.seed = seed;
    this.positions.clear();
    this.utterances.clear();
    this.acceptedBy.clear();
    this.closed = false;
    // Deterministic starting positions spread across [0.1, 0.9].
    participants.forEach((p, i) => {
      const spread =
        participants.length === 1 ? 0.5 : i / (participants.length - 1);
      this.positions.set(p.agentId, 0.1 + spread * 0.8);
    });
  }

  observe(agentId: string): Observation {
    const own = this.positions.get(agentId);
    if (own === undefined) {
      throw new Error(`Unknown participant "${agentId}"`);
    }
    const counterparts: Record<string, number> = {};
    for (const [id, pos] of this.positions) {
      if (id !== agentId) counterparts[id] = pos;
    }
    return {
      turn: 0, // engine overwrites with the real turn
      topic: this.topic,
      ownPosition: own,
      counterpartPositions: counterparts,
      gap: this.gap(),
      lastUtterances: Object.fromEntries(this.utterances),
      pendingAcceptance: this.acceptedBy.size > 0,
    };
  }

  validateAction(action: NegotiationAction): void {
    validateNegotiationAction(action);
  }

  act(
    agentId: string,
    input: NegotiationAction | LegacyProposedBehavior,
    utterance?: string,
  ): ActResult {
    const own = this.positions.get(agentId);
    if (own === undefined) {
      throw new Error(`Unknown participant "${agentId}"`);
    }
    const action: NegotiationAction = {
      action: input.action,
      concession: input.concession,
    };
    const text =
      "rationale" in input && typeof input.rationale === "string"
        ? input.utterance
        : utterance;

    let next = own;
    if (action.action === "concede" || action.action === "propose") {
      const target = this.meanOfOthers(agentId);
      next = own + (target - own) * Math.min(Math.max(action.concession, 0), 1);
      this.acceptedBy.delete(agentId);
    } else if (action.action === "accept") {
      if (this.gap() <= this.threshold) {
        this.acceptedBy.add(agentId);
      }
    } else if (action.action === "reject") {
      this.acceptedBy.clear();
    }
    // "hold" changes nothing.
    this.positions.set(agentId, next);
    if (text !== undefined) {
      this.utterances.set(agentId, text);
    }
    if (this.acceptedBy.size >= this.participants.length) {
      this.closed = true;
    }
    return {
      newPosition: next,
      closed: this.closed,
      effects: { newPosition: next, closed: this.closed },
    };
  }

  getState(): Record<string, unknown> {
    return {
      topic: this.topic,
      positions: Object.fromEntries(this.positions),
      gap: this.gap(),
      acceptedBy: [...this.acceptedBy],
      closed: this.closed,
    };
  }

  isDone(): boolean {
    return this.closed;
  }

  outcome(turnsUsed: number): SimulationOutcome {
    const gap = this.gap();
    return {
      agreementReached: this.closed,
      finalGap: gap,
      finalPositions: Object.fromEntries(this.positions),
      turnsUsed,
      summary: this.closed
        ? `Agreement reached on "${this.topic}" after ${turnsUsed} turn(s) (final gap ${gap.toFixed(3)}).`
        : `No agreement on "${this.topic}" after ${turnsUsed} turn(s) (final gap ${gap.toFixed(3)}).`,
    };
  }

  reset(): void {
    this.initialize(this.participants, this.seed);
  }

  private gap(): number {
    const values = [...this.positions.values()];
    return Math.max(...values) - Math.min(...values);
  }

  private meanOfOthers(agentId: string): number {
    const others = [...this.positions.entries()]
      .filter(([id]) => id !== agentId)
      .map(([, pos]) => pos);
    return others.reduce((a, b) => a + b, 0) / others.length;
  }
}

/** Backward-compatible alias — TextEnvironment was the original name. */
export { NegotiationEnvironment as TextEnvironment };
