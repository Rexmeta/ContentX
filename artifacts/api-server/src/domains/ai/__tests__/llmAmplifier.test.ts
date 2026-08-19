import { describe, expect, it, vi } from "vitest";

vi.mock("../llmClient", () => ({
  completeJSON: vi.fn(),
  completeJSONStreaming: vi.fn(),
  LLMRequestError: class LLMRequestError extends Error {},
  LLM_MODEL_ID: "test/model",
}));

import { extractDraftPreview } from "../llmAmplifier";

describe("extractDraftPreview", () => {
  it("emits only completed allowlisted fields from a JSON prefix", () => {
    expect(extractDraftPreview('{"title":"완성 전')).toEqual({});

    expect(
      extractDraftPreview(
        '{"title":"연구소의 밤","logline":"서로 다른 목적이 충돌한다.","reasoning":"숨긴 생각","characters":[{"name":"한지수","role":"연구소장","motivation":"연구 결과를 지킨다."}],"providerTrace":{"requestId":"never expose"}}',
      ),
    ).toEqual({
      title: "연구소의 밤",
      logline: "서로 다른 목적이 충돌한다.",
      characters: [
        {
          name: "한지수",
          role: "연구소장",
          motivation: "연구 결과를 지킨다.",
        },
      ],
    });
  });

  it("projects nested structured values to their explicit public fields", () => {
    const preview = extractDraftPreview(
      '{"acts":[{"name":"1막","summary":"갈등이 시작된다.","beats":["충돌이 시작된다."],"analysis":"hidden"}],"characters":[{"name":"한지수","role":"연구소장","motivation":"연구 결과를 지킨다.","scratchpad":"hidden"}]}',
    );

    expect(preview).toEqual({
      acts: [
        {
          name: "1막",
          summary: "갈등이 시작된다.",
          beats: ["충돌이 시작된다."],
        },
      ],
      characters: [
        {
          name: "한지수",
          role: "연구소장",
          motivation: "연구 결과를 지킨다.",
        },
      ],
    });
    expect(JSON.stringify(preview)).not.toMatch(/analysis|scratchpad/i);
  });

  it("waits for a complete structured collection before returning it", () => {
    expect(
      extractDraftPreview(
        '{"title":"연구소의 밤","characters":[{"name":"한지수","role":"연구소장"',
      ),
    ).toEqual({ title: "연구소의 밤" });
  });
});