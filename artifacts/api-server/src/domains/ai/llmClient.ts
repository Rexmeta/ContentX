import { openai } from "@workspace/integrations-openai-ai-server";

/**
 * Single LLM provider adapter. All OpenAI calls in the codebase go through
 * `completeJSON`, and the model id is configured here — in exactly one place.
 */
export const LLM_MODEL = "gpt-5.6-terra";
export const LLM_MODEL_ID = `openai/${LLM_MODEL}`;
export const LLM_TIMEOUT_MS = 90_000;

/** Thrown for provider failures or unusable (empty / non-JSON) output. */
export class LLMRequestError extends Error {}

export interface CompleteJSONInput {
  system?: string;
  user: string;
  maxCompletionTokens?: number;
  timeoutMs?: number;
}

export type JSONTextChunkHandler = (raw: string) => Promise<void> | void;

function rejectAfter(
  ms: number,
  onTimeout?: () => void,
): {
  promise: Promise<never>;
  cancel: () => void;
  controller: AbortController;
} {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      const error = new LLMRequestError(
        `AI 응답 시간이 ${Math.round(ms / 1000)}초를 초과했습니다.`,
      );
      reject(error);
      controller.abort(error);
    }, ms);
  });
  return { promise, cancel: () => clearTimeout(timer!), controller };
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
  const timeout = rejectAfter(input.timeoutMs ?? LLM_TIMEOUT_MS);
  try {
    response = await Promise.race([
      openai.chat.completions.create({
        model: LLM_MODEL,
        max_completion_tokens: input.maxCompletionTokens ?? 8192,
        response_format: { type: "json_object" },
        messages,
      }, { signal: timeout.controller.signal }),
      timeout.promise,
    ]);
  } catch (err) {
    if (err instanceof LLMRequestError) throw err;
    throw new LLMRequestError(
      `AI provider request failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  } finally {
    timeout.cancel();
  }

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new LLMRequestError("AI returned an empty response.");

  try {
    return JSON.parse(raw);
  } catch {
    throw new LLMRequestError("AI response was not valid JSON.");
  }
}

/**
 * Run a JSON-mode chat completion as a stream. The callback receives the
 * accumulated response text, never provider metadata. Callers that expose
 * progress must parse and allowlist fields before persisting anything.
 */
export async function completeJSONStreaming(
  input: CompleteJSONInput,
  onTextChunk: JSONTextChunkHandler,
): Promise<unknown> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (input.system) messages.push({ role: "system", content: input.system });
  messages.push({ role: "user", content: input.user });

  let terminal = false;
  const timeout = rejectAfter(input.timeoutMs ?? LLM_TIMEOUT_MS, () => {
    terminal = true;
  });
  let raw = "";
  try {
    const streamPromise = (async () => {
      const response = await openai.chat.completions.create(
        {
          model: LLM_MODEL,
          max_completion_tokens: input.maxCompletionTokens ?? 8192,
          response_format: { type: "json_object" },
          messages,
          stream: true,
        },
        { signal: timeout.controller.signal },
      );

      for await (const chunk of response) {
        // A provider can yield a buffered chunk after aborting. Never allow
        // such a late chunk to invoke a progress callback or persist state.
        if (terminal || timeout.controller.signal.aborted) break;
        const content = chunk.choices[0]?.delta?.content;
        if (typeof content !== "string" || content.length === 0) continue;
        raw += content;
        await onTextChunk(raw);
        if (terminal || timeout.controller.signal.aborted) break;
      }
      return raw;
    })();

    const streamed = await Promise.race([streamPromise, timeout.promise]);
    if (!streamed) throw new LLMRequestError("AI returned an empty response.");
    try {
      return JSON.parse(streamed);
    } catch {
      throw new LLMRequestError("AI response was not valid JSON.");
    }
  } catch (err) {
    if (err instanceof LLMRequestError) throw err;
    throw new LLMRequestError(
      `AI provider request failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  } finally {
    terminal = true;
    timeout.cancel();
  }
}
