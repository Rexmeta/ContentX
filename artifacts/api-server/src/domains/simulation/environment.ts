/**
 * Environment abstraction: initialize / observe / act / getState / reset.
 * The first implementation is a TextEnvironment (negotiation over a topic).
 * The interface is deliberately independent of voice/avatar/UI — those are
 * projections of the trace, never part of the environment contract.
 */
import type {
  ProposedBehavior,
  SimulationOutcome,
  SimulationParticipant,
} from "./model";

export interface Observation {
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

export interface ActResult {
  /** Position after the environment applied the validated behavior. */
  newPosition: number;
  /** Whether this act closed the negotiation (both sides accepted). */
  closed: boolean;
}

export interface Environment {
  readonly type: string;
  initialize(participants: SimulationParticipant[], seed: number): void;
  observe(agentId: string): Observation;
  act(agentId: string, behavior: ProposedBehavior): ActResult;
  getState(): Record<string, unknown>;
  isDone(): boolean;
  outcome(turnsUsed: number): SimulationOutcome;
  reset(): void;
}

interface TextEnvConfig {
  topic: string;
  /** Gap below which an `accept` succeeds. */
  agreementThreshold?: number;
}

/**
 * TextEnvironment — a two-or-more-party negotiation. Each participant
 * holds a position in [0, 1]; positions start spread apart deterministically
 * from the seed. Concessions move a party toward the mean of the others.
 * Agreement is reached when a party accepts while the gap is within the
 * threshold. Purely deterministic given seed + behaviors.
 */
export class TextEnvironment implements Environment {
  readonly type = "text";
  private readonly topic: string;
  private readonly threshold: number;
  private participants: SimulationParticipant[] = [];
  private positions = new Map<string, number>();
  private utterances = new Map<string, string>();
  private acceptedBy = new Set<string>();
  private closed = false;
  private seed = 0;

  constructor(config: TextEnvConfig) {
    this.topic = config.topic;
    this.threshold = config.agreementThreshold ?? 0.15;
  }

  initialize(participants: SimulationParticipant[], seed: number): void {
    if (participants.length < 2) {
      throw new Error("TextEnvironment requires at least 2 participants");
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

  act(agentId: string, behavior: ProposedBehavior): ActResult {
    const own = this.positions.get(agentId);
    if (own === undefined) {
      throw new Error(`Unknown participant "${agentId}"`);
    }
    let next = own;
    if (behavior.action === "concede" || behavior.action === "propose") {
      const target = this.meanOfOthers(agentId);
      next = own + (target - own) * Math.min(Math.max(behavior.concession, 0), 1);
      this.acceptedBy.delete(agentId);
    } else if (behavior.action === "accept") {
      if (this.gap() <= this.threshold) {
        this.acceptedBy.add(agentId);
      }
    } else if (behavior.action === "reject") {
      this.acceptedBy.clear();
    }
    // "hold" changes nothing.
    this.positions.set(agentId, next);
    this.utterances.set(agentId, behavior.utterance);
    if (this.acceptedBy.size >= this.participants.length) {
      this.closed = true;
    }
    return { newPosition: next, closed: this.closed };
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
