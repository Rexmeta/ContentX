import { describe, it, expect } from "vitest";
import { amplifyIdea } from "../ai/mockAmplifier";
import { buildGraphFromScenario } from "../scenario/graphBuilder";
import { ContentOrchestrator, mockAmplifier } from "../ai/orchestrator";
import { MockProvider } from "../ai/mockProvider";

const makeOrchestrator = () =>
  new ContentOrchestrator(new MockProvider(), mockAmplifier);
import { validateGraph } from "../validation/validator";

const DEMO_IDEA = "신제품 출시를 앞둔 회사에서 품질팀과 마케팅팀이 충돌한다.";

describe("idea → amplify → confirm → commit workflow", () => {
  it("amplifies a raw idea into a dramatic scenario (not a quote of the input)", () => {
    const scenario = amplifyIdea(DEMO_IDEA);
    expect(scenario.logline.length).toBeGreaterThan(DEMO_IDEA.length);
    expect(scenario.synopsis.length).toBeGreaterThan(100);
    expect(scenario.acts).toHaveLength(3);
    expect(scenario.acts.every((a) => a.beats.length >= 3)).toBe(true);
    expect(scenario.characters.length).toBeGreaterThanOrEqual(2);
    expect(scenario.twist).toBeTruthy();
    expect(scenario.stakes).toBeTruthy();
    expect(scenario.sourceIdea).toBe(DEMO_IDEA);
  });

  it("amplifies arbitrary ideas with a dramatic 3-act structure", () => {
    const scenario = amplifyIdea("우주 정거장의 마지막 정비공");
    expect(scenario.acts).toHaveLength(3);
    expect(scenario.characters.length).toBeGreaterThanOrEqual(3);
  });

  it("builds a valid canonical graph from a confirmed scenario", () => {
    const scenario = amplifyIdea(DEMO_IDEA);
    const graph = buildGraphFromScenario(scenario);
    const kinds = new Set(graph.entities.map((e) => e.kind));
    expect(kinds.has("world")).toBe(true);
    expect(kinds.has("character")).toBe(true);
    expect(kinds.has("conflict")).toBe(true);
    expect(kinds.has("event")).toBe(true);
    expect(kinds.has("theme")).toBe(true);
    // acts become ordered events
    expect(graph.relationships.some((r) => r.type === "precedes")).toBe(true);
    expect(validateGraph({ ...graph }).valid).toBe(true);
  });

  it("rejects structurally empty confirmed scenarios before commit", async () => {
    const orchestratorInstance = makeOrchestrator();
    const scenario = await orchestratorInstance.amplify(DEMO_IDEA);
    expect(() =>
      orchestratorInstance.generateFromScenario(DEMO_IDEA, {
        ...scenario,
        acts: [],
      }),
    ).toThrow(/at least one act/);
    expect(() =>
      orchestratorInstance.generateFromScenario(DEMO_IDEA, {
        ...scenario,
        characters: [],
      }),
    ).toThrow(/at least one character/);
    expect(() =>
      orchestratorInstance.generateFromScenario(DEMO_IDEA, {
        ...scenario,
        logline: "  ",
      }),
    ).toThrow(/logline/);
  });

  it("provenance is server-authoritative, ignoring client scenario metadata", async () => {
    const orchestratorInstance = makeOrchestrator();
    const scenario = await orchestratorInstance.amplify(DEMO_IDEA);
    const tampered = {
      ...scenario,
      sourceIdea: "fake source",
      amplifiedBy: "fake-model",
    };
    const payload = orchestratorInstance.generateFromScenario(DEMO_IDEA, tampered);
    expect(payload.provenance?.sourceTitle).toContain("품질팀");
    expect(payload.provenance?.generatedByModel).toBe("contentx-amplifier-v1");
  });

  it("orchestrator records amplification provenance on commit", async () => {
    const orchestratorInstance = makeOrchestrator();
    const scenario = await orchestratorInstance.amplify(DEMO_IDEA);
    const payload = orchestratorInstance.generateFromScenario(DEMO_IDEA, scenario);
    expect(payload.provenance?.operation).toBe("compose");
    expect(payload.provenance?.sourceType).toBe("scenario");
    expect(payload.provenance?.sourceTitle).toContain("품질팀");
    expect(payload.provenance?.generatedByModel).toContain("amplifier");
  });
});
