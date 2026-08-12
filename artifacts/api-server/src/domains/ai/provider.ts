import type { GraphPayload } from "../content/model";

/**
 * AI provider abstraction. Model/provider configuration stays behind this
 * interface so ContentX is never coupled to a single LLM vendor.
 * The MVP ships with a deterministic MockProvider; real providers
 * (OpenAI / Anthropic / Gemini) can be added without touching domain logic.
 */
export interface GenerationResult {
  graph: Pick<GraphPayload, "entities" | "relationships">;
  provider: string;
  model: string;
}

export interface AIProvider {
  readonly name: string;
  generateGraph(prompt: string): Promise<GenerationResult>;
}
