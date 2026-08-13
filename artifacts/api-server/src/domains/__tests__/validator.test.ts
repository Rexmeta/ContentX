import { describe, it, expect } from "vitest";
import { validateGraph } from "../validation/validator";
import { validGraphPayload } from "./fixtures";

describe("validateGraph (schema + reference validation)", () => {
  it("accepts a valid graph", () => {
    const report = validateGraph(validGraphPayload());
    expect(report.valid).toBe(true);
    expect(report.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(report.checks.length).toBeGreaterThan(0);
  });

  it("rejects missing required fields", () => {
    const graph = validGraphPayload();
    graph.entities[0]!.name = "";
    const report = validateGraph(graph);
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === "MISSING_REQUIRED_FIELD")).toBe(true);
  });

  it("rejects duplicate stable IDs", () => {
    const graph = validGraphPayload();
    graph.entities[1]!.id = graph.entities[0]!.id;
    const report = validateGraph(graph);
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === "DUPLICATE_ID")).toBe(true);
  });

  it("rejects relationships pointing to nonexistent entities", () => {
    const graph = validGraphPayload();
    graph.relationships.push({
      id: "relationship_broken",
      source: "entity_qa1",
      type: "knows",
      target: "entity_nope",
    });
    const report = validateGraph(graph);
    expect(report.valid).toBe(false);
    const broken = report.issues.filter((i) => i.code === "BROKEN_REFERENCE");
    expect(broken).toHaveLength(1);
    expect(broken[0]!.objectId).toBe("relationship_broken");
  });

  it("accepts new canonical entity kinds and identity fields", () => {
    const graph = validGraphPayload();
    graph.entities.push({
      id: "entity_person1",
      kind: "person",
      name: "김민준",
      canonicalName: "kim-minjun",
      aliases: ["민준", "MJ Kim"],
    });
    const report = validateGraph(graph);
    expect(report.valid).toBe(true);
    expect(report.issues.some((i) => i.code === "UNKNOWN_KIND")).toBe(false);
  });

  it("warns on unknown entity kind without failing", () => {
    const graph = validGraphPayload();
    graph.entities[0]!.kind = "gizmo";
    const report = validateGraph(graph);
    expect(report.valid).toBe(true);
    expect(
      report.issues.some((i) => i.code === "UNKNOWN_KIND" && i.severity === "warning"),
    ).toBe(true);
  });

  it("rejects empty or whitespace-only aliases", () => {
    const graph = validGraphPayload();
    graph.entities[0]!.aliases = ["valid", "   "];
    const report = validateGraph(graph);
    expect(report.valid).toBe(false);
    expect(report.issues.some((i) => i.code === "EMPTY_ALIAS")).toBe(true);
  });

  it("warns on non-conventional id format without failing", () => {
    const graph = validGraphPayload();
    graph.entities[0]!.id = "0"; // array-index style identity is not allowed
    // relationship r1/r2 now reference a missing entity id → errors expected too
    const report = validateGraph(graph);
    expect(report.issues.some((i) => i.code === "ID_FORMAT" && i.severity === "warning")).toBe(true);
  });
});
