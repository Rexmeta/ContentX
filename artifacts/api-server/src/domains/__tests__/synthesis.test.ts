import { describe, it, expect } from "vitest";
import { amplifyIdea } from "../ai/mockAmplifier";
import {
  extractElements,
  mockSynthesizer,
  SynthesisError,
  type SynthesisSourceInput,
} from "../scenario/synthesizer";
import {
  validateLineage,
  InvalidLineageError,
} from "../scenario/lineageService";

const makeSources = (): SynthesisSourceInput[] => [
  { scenario: amplifyIdea("빵집 사장과 프랜차이즈"), elements: ["characters"] },
  { scenario: amplifyIdea("응급실 인력 감축"), elements: ["conflict", "twist"] },
];

describe("scenario synthesis", () => {
  it("extractElements includes only selected elements", () => {
    const scenario = amplifyIdea("테스트 아이디어");
    const onlyChars = extractElements(scenario, ["characters"]);
    expect(onlyChars).toContain("- 인물:");
    expect(onlyChars).not.toContain("- 반전:");
    const onlyTwist = extractElements(scenario, ["twist"]);
    expect(onlyTwist).toContain(scenario.twist);
    expect(onlyTwist).not.toContain("- 인물:");
  });

  it("extractElements structure includes acts and beats", () => {
    const scenario = amplifyIdea("구조 테스트");
    const out = extractElements(scenario, ["structure"]);
    for (const act of scenario.acts) {
      expect(out).toContain(act.name);
    }
  });

  it("mock synthesizer combines sources into a new scenario draft", async () => {
    const result = await mockSynthesizer(makeSources(), "지시문");
    expect(result.title).toContain("합성");
    expect(result.logline).toContain("2개");
    expect(result.amplifiedBy).toBe("mock/synthesizer-v1");
    expect(result.acts.length).toBeGreaterThan(0);
    expect(result.characters.length).toBeGreaterThan(0);
  });

  it("SynthesisError is a distinct error type", () => {
    expect(new SynthesisError("boom")).toBeInstanceOf(Error);
  });
});

describe("lineage validation invariants", () => {
  it("rejects fewer than 2 parents", async () => {
    await expect(
      validateLineage({
        parents: [{ scenarioId: "scenario_x", elements: ["twist"] }],
      }),
    ).rejects.toBeInstanceOf(InvalidLineageError);
  });

  it("rejects duplicate parents", async () => {
    await expect(
      validateLineage({
        parents: [
          { scenarioId: "scenario_x", elements: ["twist"] },
          { scenarioId: "scenario_x", elements: ["conflict"] },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidLineageError);
  });

  it("rejects empty or unknown element lists", async () => {
    await expect(
      validateLineage({
        parents: [
          { scenarioId: "scenario_x", elements: [] },
          { scenarioId: "scenario_y", elements: ["twist"] },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidLineageError);
    await expect(
      validateLineage({
        parents: [
          { scenarioId: "scenario_x", elements: ["plot-armor"] },
          { scenarioId: "scenario_y", elements: ["twist"] },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidLineageError);
  });

  it("rejects overlong instructions", async () => {
    await expect(
      validateLineage({
        parents: [
          { scenarioId: "scenario_x", elements: ["twist"] },
          { scenarioId: "scenario_y", elements: ["conflict"] },
        ],
        instruction: "가".repeat(501),
      }),
    ).rejects.toBeInstanceOf(InvalidLineageError);
  });
});
