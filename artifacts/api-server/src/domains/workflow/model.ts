/**
 * Workflow domain model — the outcome-first UX layer (P1).
 *
 * A Workflow is an AI-recommended, user-adjustable plan of steps. Each step
 * binds to an existing engine capability (scenario draft, content graph,
 * sampling, simulation, evaluation, projection); the workflow layer never
 * reimplements the engine, it only orchestrates it and records progress.
 */

export const OUTPUT_TYPES = [
  "movie",
  "novel",
  "roleplay",
  "product-reaction",
  "game",
  "advertisement",
  "remix",
  "external-transform",
] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

/** Output types fully executable end-to-end in P1. Others plan-only. */
export const SUPPORTED_OUTPUT_TYPES: readonly OutputType[] = [
  "novel",
  "roleplay",
  "product-reaction",
];

export const STEP_TYPES = [
  "input",
  "generate",
  "extract",
  "analyze",
  "transform",
  "compose",
  "remix",
  "simulate",
  "validate",
  "compare",
  "export",
  "project",
] as const;
export type StepType = (typeof STEP_TYPES)[number];

export type StepImportance = "required" | "recommended" | "optional";
export type StepStatus =
  | "pending"
  | "ready"
  | "running"
  | "complete"
  | "failed"
  | "skipped";

/** Executor action keys. Every runnable step names exactly one. */
export const STEP_ACTIONS = [
  "provide_input",
  "draft_story",
  "classify_story",
  "build_world",
  "validate_world",
  "project_novel",
  "project_roleplay",
  "define_audience",
  "generate_personas",
  "prepare_actors",
  "run_simulation",
  "analyze_results",
] as const;
export type StepAction = (typeof STEP_ACTIONS)[number];

export interface StepBinding {
  action: StepAction;
  /** Human-readable existing API the step reuses (display only). */
  api: string;
  params?: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  type: StepType;
  title: string;
  description?: string | null;
  importance: StepImportance;
  status: StepStatus;
  input: string[];
  output: string[];
  dependencies: string[];
  binding?: StepBinding | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
}

export interface OutputIntent {
  outputType: OutputType;
  description: string;
  extractedInputs: Record<string, string>;
}

export type WorkflowStatus = "draft" | "running" | "complete" | "failed";

export interface Workflow {
  id: string;
  title: string;
  intent: OutputIntent;
  steps: WorkflowStep[];
  artifacts: Record<string, string>;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
}

export class WorkflowNotFoundError extends Error {
  constructor(id: string) {
    super(`Workflow "${id}" not found`);
    this.name = "WorkflowNotFoundError";
  }
}

export class StepNotFoundError extends Error {
  constructor(id: string) {
    super(`Workflow step "${id}" not found`);
    this.name = "StepNotFoundError";
  }
}

export class InvalidWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWorkflowError";
  }
}

/** Thrown when a step's dependencies are not complete/skipped yet (→ 400). */
export class StepDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StepDependencyError";
  }
}

/** Thrown when downstream engine/AI execution fails (→ 502). */
export class StepExecutionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StepExecutionError";
  }
}
