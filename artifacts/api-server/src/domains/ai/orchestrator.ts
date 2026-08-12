import type { GraphPayload, Provenance } from "../content/model";
import { validateGraph } from "../validation/validator";
import type { AIProvider } from "./provider";
import { MockProvider } from "./mockProvider";
import { amplifyIdea, type DramaticScenario } from "./scenarioAmplifier";
import { buildGraphFromScenario } from "./scenarioGraphBuilder";

/** Thrown when a confirmed scenario lacks minimum dramatic structure (→ 400). */
export class ScenarioValidationError extends Error {}

const blank = (s: string | null | undefined) => !s || s.trim() === "";

/** Returns a human-readable problem, or null when the scenario is committable. */
export function checkScenarioCompleteness(
  scenario: DramaticScenario,
): string | null {
  if (blank(scenario.title)) return "Scenario title must not be empty.";
  if (blank(scenario.logline)) return "Scenario logline must not be empty.";
  if (blank(scenario.synopsis)) return "Scenario synopsis must not be empty.";
  if (blank(scenario.theme)) return "Scenario theme must not be empty.";
  if (blank(scenario.stakes)) return "Scenario stakes must not be empty.";
  if (blank(scenario.twist)) return "Scenario twist must not be empty.";
  if (scenario.acts.length === 0) return "Scenario must have at least one act.";
  for (const act of scenario.acts) {
    if (blank(act.name) || blank(act.summary)) {
      return "Every act needs a non-empty name and summary.";
    }
    if (act.beats.length === 0 || act.beats.every(blank)) {
      return `Act "${act.name}" needs at least one non-empty beat.`;
    }
  }
  if (scenario.characters.length === 0) {
    return "Scenario must have at least one character.";
  }
  for (const c of scenario.characters) {
    if (blank(c.name) || blank(c.role) || blank(c.motivation)) {
      return "Every character needs a non-empty name, role, and motivation.";
    }
  }
  return null;
}

/**
 * ContentOrchestrator — the explicit AI boundary.
 * MVP pipeline: Generate → Validate → Commit.
 * Future modules (Planner, Extractor, Composer, Transformer, Critic,
 * Repairer) plug in here without changing callers.
 */
export class ContentOrchestrator {
  constructor(private readonly provider: AIProvider = new MockProvider()) {}

  /**
   * Generate a graph payload from a prompt. Output is schema/reference
   * validated before it is returned for commit; raw provider output is never
   * trusted directly.
   */
  async generate(prompt: string): Promise<GraphPayload> {
    const result = await this.provider.generateGraph(prompt);

    const provenance: Provenance = {
      operation: "generate",
      createdAt: new Date().toISOString(),
      sourceType: "prompt",
      sourceTitle: prompt.slice(0, 120),
      generatedByProvider: result.provider,
      generatedByModel: result.model,
    };

    const payload: GraphPayload = { ...result.graph, provenance };

    const report = validateGraph(payload);
    const errors = report.issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      throw new Error(
        `AI output failed validation: ${errors.map((e) => e.message).join("; ")}`,
      );
    }

    return payload;
  }

  /**
   * Amplify a raw idea into a dramatic scenario draft. Nothing is persisted;
   * the user confirms (possibly after editing) before commit.
   */
  amplify(idea: string, title?: string): DramaticScenario {
    return amplifyIdea(idea, title);
  }

  /**
   * Build and validate a graph from a user-confirmed scenario.
   * The scenario is checked for minimum dramatic structure first; provenance
   * is authoritative from the request prompt and server-side amplifier
   * identity, never from client-supplied scenario metadata.
   */
  generateFromScenario(idea: string, scenario: DramaticScenario): GraphPayload {
    const problem = checkScenarioCompleteness(scenario);
    if (problem) {
      throw new ScenarioValidationError(problem);
    }
    const graph = buildGraphFromScenario(scenario);
    const provenance: Provenance = {
      operation: "compose",
      createdAt: new Date().toISOString(),
      sourceType: "scenario",
      sourceTitle: idea.slice(0, 120),
      generatedByProvider: "mock",
      generatedByModel: "contentx-amplifier-v1",
    };
    const payload: GraphPayload = { ...graph, provenance };

    const report = validateGraph(payload);
    const errors = report.issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      throw new Error(
        `Scenario graph failed validation: ${errors.map((e) => e.message).join("; ")}`,
      );
    }
    return payload;
  }
}

export const orchestrator = new ContentOrchestrator();
