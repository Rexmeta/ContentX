import { openai } from "@workspace/integrations-openai-ai-server";

/**
 * Single LLM provider adapter. All OpenAI calls in the codebase go through
 * `completeJSON`, and the model id is configured here — in exactly one place.
 */
export const LLM_MODEL = "gpt-5.6-terra";
export const LLM_MODEL_ID = `openai/${LLM_MODEL}`;

/** Thrown for provider failures or unusable (empty / non-JSON) output. */
export class LLMRequestError extends Error {}

export interface CompleteJSONInput {
  system?: string;
  user: string;
  maxCompletionTokens?: number;
}

/**
 * Run a JSON-mode chat completion and return the parsed JSON value.
 * Provider failures, empty responses, and invalid JSON raise LLMRequestError;
 * callers wrap it in their domain-specific error (no silent fallbacks).
 */
export async function completeJSON(input: CompleteJSONInput): Promise<unknown> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (input.system) messages.push({ role: "system", content: input.system });
  messages.push({ role: "user", content: input.user });

  let response;
  try {
    response = await openai.chat.completions.create({
      model: LLM_MODEL,
      max_completion_tokens: input.maxCompletionTokens ?? 8192,
      response_format: { type: "json_object" },
      messages,
    });
  } catch (err) {
    throw new LLMRequestError(
      `AI provider request failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new LLMRequestError("AI returned an empty response.");

  try {
    return JSON.parse(raw);
  } catch {
    throw new LLMRequestError("AI response was not valid JSON.");
  }
}
