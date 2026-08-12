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

  it("warns on non-conventional id format without failing", () => {
    const graph = validGraphPayload();
    graph.entities[0]!.id = "0"; // array-index style identity is not allowed
    // relationship r1/r2 now reference a missing entity id → errors expected too
    const report = validateGraph(graph);
    expect(report.issues.some((i) => i.code === "ID_FORMAT" && i.severity === "warning")).toBe(true);
  });
});
