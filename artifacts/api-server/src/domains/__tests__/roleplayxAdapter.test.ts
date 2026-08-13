import { describe, it, expect } from "vitest";
import { projectToRoleplayX } from "../projection/roleplayxAdapter";
import { validContentGraph } from "./fixtures";

describe("RoleplayX projection adapter", () => {
  it("maps canonical graph to scenario JSON", async () => {
    const graph = validContentGraph();
    const scenario = await projectToRoleplayX(graph);

    expect(scenario.title).toBe(graph.title);
    expect(scenario.context).toContain("Pre-launch company");
    expect(scenario.context).toContain("Schedule vs quality");
    expect(scenario.playerRole).toContain("QA Lead");
    expect(scenario.objectives).toContain("Zero defects: Ship without defects");
    expect(scenario.successCriteria.length).toBeGreaterThan(0);
    expect(scenario.recommendedFlow.length).toBeGreaterThan(0);
  });

  it("maps characters to personas with roles and traits", async () => {
    const scenario = await projectToRoleplayX(validContentGraph());
    expect(scenario.personas).toHaveLength(2);
    const qa = scenario.personas.find((p) => p.name === "QA Lead")!;
    expect(qa.id).toBe("entity_qa1");
    expect(qa.role).toBe("QA lead");
    const mk = scenario.personas.find((p) => p.name === "Marketing Lead")!;
    expect(mk.traits).toContain("stance: aggressive");
  });

  it("records projection meta and does not mutate the canonical graph", async () => {
    const graph = validContentGraph();
    const before = JSON.stringify(graph);
    const scenario = await projectToRoleplayX(graph);
    expect(scenario.meta.sourceContentId).toBe("content_demo1");
    expect(scenario.meta.sourceVersion).toBe(3);
    expect(scenario.meta.adapter).toBe("roleplayx@2.0.0");
    expect(JSON.stringify(graph)).toBe(before);
  });
});
