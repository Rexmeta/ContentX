import type { GraphPayload, Provenance } from "../content/model";
import { validateGraph } from "../validation/validator";
import type { AIProvider } from "./provider";
import { MockProvider } from "./mockProvider";

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
}

export const orchestrator = new ContentOrchestrator();
