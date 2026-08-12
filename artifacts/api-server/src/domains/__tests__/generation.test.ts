import { describe, it, expect } from "vitest";
import { MockProvider } from "../ai/mockProvider";
import { ContentOrchestrator } from "../ai/orchestrator";
import { validateGraph } from "../validation/validator";

const DEMO_PROMPT = "신제품 출시를 앞둔 회사에서 품질팀과 마케팅팀이 충돌한다.";

describe("AI generation pipeline (Generate → Validate → Commit)", () => {
  it("mock provider produces a valid graph for the demo prompt", async () => {
    const { graph, provider, model } = await new MockProvider().generateGraph(DEMO_PROMPT);
    expect(provider).toBe("mock");
    expect(model).toBeTruthy();

    const kinds = new Set(graph.entities.map((e) => e.kind));
    expect(kinds.has("character")).toBe(true);
    expect(kinds.has("organization")).toBe(true);
    expect(kinds.has("goal")).toBe(true);
    expect(kinds.has("conflict")).toBe(true);
    expect(kinds.has("event")).toBe(true);

    expect(graph.relationships.some((r) => r.type === "conflicts_with")).toBe(true);

    const report = validateGraph({ ...graph });
    expect(report.valid).toBe(true);
  });

  it("uses stable prefixed IDs, never array indexes", async () => {
    const { graph } = await new MockProvider().generateGraph(DEMO_PROMPT);
    for (const e of graph.entities) expect(e.id).toMatch(/^entity_/);
    for (const r of graph.relationships) expect(r.id).toMatch(/^relationship_/);
  });

  it("orchestrator attaches provenance to generated content", async () => {
    const payload = await new ContentOrchestrator().generate(DEMO_PROMPT);
    expect(payload.provenance).toBeDefined();
    expect(payload.provenance!.operation).toBe("generate");
    expect(payload.provenance!.generatedByProvider).toBe("mock");
    expect(payload.provenance!.generatedByModel).toBeTruthy();
    expect(new Date(payload.provenance!.createdAt).getTime()).not.toBeNaN();
  });

  it("falls back to a generic but valid graph for arbitrary prompts", async () => {
    const payload = await new ContentOrchestrator().generate(
      "A lighthouse keeper discovers a message in a bottle.",
    );
    expect(payload.entities.length).toBeGreaterThan(3);
    expect(validateGraph(payload).valid).toBe(true);
  });
});
