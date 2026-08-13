/**
 * Agent domain — the runtime actor layer (binding decision #5).
 *
 * Agent = CharacterSnapshot reference + goals/constraints/policy/
 * runtimeConfig/memory. Mutable runtime state lives in AgentState rows,
 * one per category; NOTHING here is ever written back to the canonical
 * Character.
 */

export const AGENT_STATE_CATEGORIES = [
  "affective",
  "relational",
  "motivational",
  "cognitive",
  "behavioral",
] as const;
export type AgentStateCategory = (typeof AGENT_STATE_CATEGORIES)[number];

/** Default initial values per category — explicit, not hidden. */
export const DEFAULT_STATE_VALUES: Record<
  AgentStateCategory,
  Record<string, number>
> = {
  affective: { stress: 0.2, arousal: 0.3, valence: 0.6 },
  relational: { trust: 0.5, rapport: 0.5, dominance: 0.5 },
  motivational: { engagement: 0.6, goalCommitment: 0.7 },
  cognitive: { attention: 0.7, certainty: 0.5, cognitiveLoad: 0.3 },
  behavioral: { cooperativeness: 0.6, assertiveness: 0.5, verbosity: 0.5 },
};

/** Goal — first-class concept, not free text. */
export interface Goal {
  id: string;
  objective: string;
  /** 1 (lowest) … 5 (highest). */
  priority: number;
  /** 0 … 1. */
  urgency: number;
  successCriteria: string[];
}

export const AGENT_CONSTRAINT_TYPES = [
  "hard",
  "soft",
  "policy",
  "environmental",
] as const;
export type AgentConstraintType = (typeof AGENT_CONSTRAINT_TYPES)[number];

/** Constraint — first-class concept with an explicit type. */
export interface AgentConstraint {
  id: string;
  type: AgentConstraintType;
  description: string;
}

export interface AgentProvenance {
  operation: "instantiate";
  createdAt: string;
  snapshotId: string;
  characterId: string;
}

export interface AgentState {
  id: string;
  agentId: string;
  category: AgentStateCategory;
  values: Record<string, number>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  snapshotId: string;
  name: string;
  goals: Goal[];
  constraints: AgentConstraint[];
  policy: Record<string, unknown> | null;
  runtimeConfig: Record<string, unknown> | null;
  memory: unknown[];
  provenance: AgentProvenance;
  createdAt: string;
  updatedAt: string;
}

export interface AgentWithState extends Agent {
  state: Record<string, AgentState>;
}

export class InvalidAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAgentError";
  }
}

export class AgentNotFoundError extends Error {
  constructor(id: string) {
    super(`Agent "${id}" not found.`);
    this.name = "AgentNotFoundError";
  }
}

export function validateGoalInput(
  goal: { objective: string; priority: number; urgency: number; successCriteria: string[] },
  ctx: string,
): void {
  if (!goal.objective.trim()) {
    throw new InvalidAgentError(`${ctx}: objective must not be empty.`);
  }
  if (!Number.isInteger(goal.priority) || goal.priority < 1 || goal.priority > 5) {
    throw new InvalidAgentError(
      `${ctx}: priority must be an integer between 1 and 5.`,
    );
  }
  if (!Number.isFinite(goal.urgency) || goal.urgency < 0 || goal.urgency > 1) {
    throw new InvalidAgentError(`${ctx}: urgency must be within [0, 1].`);
  }
  for (const c of goal.successCriteria) {
    if (!c.trim()) {
      throw new InvalidAgentError(
        `${ctx}: successCriteria entries must not be empty.`,
      );
    }
  }
}

export function validateConstraintInput(
  constraint: { type: string; description: string },
  ctx: string,
): void {
  if (
    !AGENT_CONSTRAINT_TYPES.includes(constraint.type as AgentConstraintType)
  ) {
    throw new InvalidAgentError(
      `${ctx}: type must be one of ${AGENT_CONSTRAINT_TYPES.join(", ")}.`,
    );
  }
  if (!constraint.description.trim()) {
    throw new InvalidAgentError(`${ctx}: description must not be empty.`);
  }
}

export function validateStateValues(
  values: Record<string, number>,
  ctx: string,
): void {
  const entries = Object.entries(values);
  if (entries.length === 0) {
    throw new InvalidAgentError(`${ctx}: values must not be empty.`);
  }
  for (const [key, v] of entries) {
    if (!key.trim()) {
      throw new InvalidAgentError(`${ctx}: value keys must not be empty.`);
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
      throw new InvalidAgentError(
        `${ctx}: "${key}" must be a finite number within [0, 1].`,
      );
    }
  }
}
