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

import {
  completeJSON,
  completeJSONStreaming,
  LLMRequestError,
} from "../llmClient";

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

  it("keeps the same timeout protection for a streaming request", async () => {
    vi.useFakeTimers();
    createCompletion.mockReturnValue(new Promise(() => undefined));

    const completion = completeJSONStreaming(
      { user: "test", timeoutMs: 50 },
      () => undefined,
    );
    const assertion = expect(completion).rejects.toThrow(LLMRequestError);

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    const requestOptions = createCompletion.mock.calls[0]?.[1];
    expect(requestOptions?.signal.aborted).toBe(true);
  });

  it("does not report late buffered stream chunks after timing out", async () => {
    vi.useFakeTimers();
    let releaseChunk!: () => void;
    createCompletion.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        await new Promise<void>((resolve) => {
          releaseChunk = resolve;
        });
        yield { choices: [{ delta: { content: '{"title":"late"}' } }] };
      },
    });
    const onChunk = vi.fn();
    const completion = completeJSONStreaming(
      { user: "test", timeoutMs: 50 },
      onChunk,
    );
    const assertion = expect(completion).rejects.toThrow(LLMRequestError);

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    releaseChunk();
    await Promise.resolve();
    await Promise.resolve();

    expect(onChunk).not.toHaveBeenCalled();
  });

  it("parses a JSON response before the deadline", async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: '{"ok":true}' } }],
    });

    await expect(
      completeJSON({ user: "test", timeoutMs: 50 }),
    ).resolves.toEqual({ ok: true });
  });

  it("accumulates JSON stream text without exposing provider metadata", async () => {
    createCompletion.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield {
          choices: [
            {
              delta: { content: '{"title":"연구소' },
              id: "provider-trace-must-not-leave-client",
            },
          ],
        };
        yield { choices: [{ delta: { content: '의 밤"}' } }] };
      },
    });
    const seen: string[] = [];

    await expect(
      completeJSONStreaming({ user: "test", timeoutMs: 50 }, (raw) => {
        seen.push(raw);
      }),
    ).resolves.toEqual({ title: "연구소의 밤" });

    expect(seen).toEqual(['{"title":"연구소', '{"title":"연구소의 밤"}']);
    expect(JSON.stringify(seen)).not.toContain("provider-trace");
    expect(createCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true }),
      expect.any(Object),
    );
  });
});