import { afterEach, describe, expect, it, vi } from "vitest";

const createCompletion = vi.hoisted(() => vi.fn());

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  },
}));

import { completeJSON, LLMRequestError } from "../llmClient";

describe("completeJSON timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    createCompletion.mockReset();
  });

  it("rejects a provider request that never settles", async () => {
    vi.useFakeTimers();
    createCompletion.mockReturnValue(new Promise(() => undefined));

    const completion = completeJSON({ user: "test", timeoutMs: 50 });
    const assertion = expect(completion).rejects.toThrow(LLMRequestError);

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    const requestOptions = createCompletion.mock.calls[0]?.[1];
    expect(requestOptions?.signal.aborted).toBe(true);
  });

  it("parses a JSON response before the deadline", async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: '{"ok":true}' } }],
    });

    await expect(
      completeJSON({ user: "test", timeoutMs: 50 }),
    ).resolves.toEqual({ ok: true });
  });
});