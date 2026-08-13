/**
 * MatrAIx import pipeline tests: strict source-format parsing, deterministic
 * mapping (ids, kinds, provenance), duplicate/broken-reference reporting, and
 * proof that the imported canonical graph flows through both projection
 * adapters unchanged (roleplayx deterministic, novel with a mocked LLM).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("../ai/llmClient", () => ({
  LLM_MODEL_ID: "test-model",
  LLMRequestError: class LLMRequestError extends Error {},
  completeJSON: vi.fn(),
}));

import { completeJSON } from "../ai/llmClient";
import { matraixDatasetSchema } from "../import/matraixModel";
import { mapMatraixToCanonical } from "../import/matraixImporter";
import { validateGraph } from "../validation/validator";
import { roleplayxAdapter } from "../projection/roleplayxAdapter";
import { novelAdapter } from "../projection/novelAdapter";
import type { ContentGraph } from "../content/model";

const sample = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../../../../../docs/examples/matraix-import-sample.json"),
    "utf8",
  ),
) as Record<string, unknown>;

function importedGraph(): ContentGraph {
  const dataset = matraixDatasetSchema.parse(sample);
  const { payload } = mapMatraixToCanonical(dataset);
  return {
    id: "content_test",
    title: "MatrAIx import",
    sourcePrompt: null,
    version: 1,
    createdAt: "2026-08-13T00:00:00Z",
    updatedAt: "2026-08-13T00:00:00Z",
    ...payload,
  };
}

describe("matraixDatasetSchema", () => {
  it("accepts the sample export", () => {
    expect(matraixDatasetSchema.safeParse(sample).success).toBe(true);
  });

  it("rejects unknown top-level keys and wrong schemaVersion", () => {
    expect(
      matraixDatasetSchema.safeParse({ ...sample, extra: 1 }).success,
    ).toBe(false);
    expect(
      matraixDatasetSchema.safeParse({ ...sample, schemaVersion: "other/1" })
        .success,
    ).toBe(false);
  });

  it("requires at least one persona", () => {
    expect(
      matraixDatasetSchema.safeParse({ ...sample, personas: [] }).success,
    ).toBe(false);
  });
});

describe("mapMatraixToCanonical", () => {
  it("maps world/population/personas/goals with provenance sourceType matraix", () => {
    const dataset = matraixDatasetSchema.parse(sample);
    const { payload, issues, stats } = mapMatraixToCanonical(dataset);

    expect(issues).toEqual([]);
    expect(stats).toMatchObject({
      worlds: 1,
      populations: 1,
      personas: 2,
      goals: 2,
      skippedRelations: 0,
      skippedDuplicates: 0,
    });

    const kinds = payload.entities.map((e) => e.kind).sort();
    expect(kinds).toEqual([
      "character",
      "character",
      "goal",
      "goal",
      "population",
      "world",
    ]);

    const jiyoung = payload.entities.find((e) => e.name === "Kim Jiyoung")!;
    expect(jiyoung.id).toBe("entity_mx_persona-jiyoung");
    expect(jiyoung.attributes?.["matraixId"]).toBe("persona.jiyoung");
    expect(jiyoung.attributes?.["traits"]).toEqual(["analytical", "brand-loyal"]);

    // memberOf x2 + pursues x2 + explicit relations x2
    expect(payload.relationships).toHaveLength(6);
    expect(
      payload.relationships.filter((r) => r.type === "memberOf"),
    ).toHaveLength(2);

    expect(payload.provenance).toMatchObject({
      operation: "import",
      sourceType: "matraix",
      sourceUri: "matraix://exports/korean-retail-demo",
      sourceTitle: "Korean Retail Customers (demo slice)",
    });

    // The mapped graph passes the shared canonical validator.
    expect(validateGraph(payload).valid).toBe(true);
  });

  it("keeps slug-colliding source ids distinct (a.b vs a-b) and imports validly", () => {
    const dataset = matraixDatasetSchema.parse({
      schemaVersion: "matraix/1.0",
      personas: [
        { id: "a.b", name: "Dot" },
        { id: "a-b", name: "Dash" },
        { id: "a b", name: "Space" },
      ],
      relations: [{ id: "r.1", from: "a.b", type: "knows", to: "a-b" }],
    });
    const { payload, issues } = mapMatraixToCanonical(dataset);

    expect(issues).toEqual([]);
    const entityIds = payload.entities.map((e) => e.id);
    expect(new Set(entityIds).size).toBe(3);
    expect(entityIds[0]).toBe("entity_mx_a-b"); // first slug wins the plain id
    // Later collisions get a deterministic hash suffix.
    expect(entityIds[1]).toMatch(/^entity_mx_a-b-[0-9a-f]{8}$/);
    expect(entityIds[2]).toMatch(/^entity_mx_a-b-[0-9a-f]{8}$/);
    expect(entityIds[1]).not.toBe(entityIds[2]);

    // Relation endpoints resolve to the disambiguated ids.
    const rel = payload.relationships[0]!;
    expect(rel.source).toBe(entityIds[0]);
    expect(rel.target).toBe(entityIds[1]);
    expect(validateGraph(payload).valid).toBe(true);

    // Deterministic: mapping again yields identical ids.
    expect(mapMatraixToCanonical(dataset).payload.entities.map((e) => e.id)).toEqual(entityIds);
  });

  it("keeps generated goal ids distinct from colliding persona ids", () => {
    const dataset = matraixDatasetSchema.parse({
      schemaVersion: "matraix/1.0",
      personas: [
        { id: "x", name: "X", goals: ["win"] },
        { id: "x_goal_1", name: "Trap" },
      ],
    });
    const { payload, issues } = mapMatraixToCanonical(dataset);

    expect(issues).toEqual([]);
    const idsList = payload.entities.map((e) => e.id);
    expect(new Set(idsList).size).toBe(3);
    expect(validateGraph(payload).valid).toBe(true);
  });

  it("reports duplicate ids and broken references without failing the import", () => {
    const dataset = matraixDatasetSchema.parse({
      schemaVersion: "matraix/1.0",
      personas: [
        { id: "p1", name: "A", populationId: "missing-pop" },
        { id: "p1", name: "A duplicate" },
        { id: "p2", name: "B" },
      ],
      relations: [
        { id: "r1", from: "p1", type: "knows", to: "p2" },
        { id: "r1", from: "p2", type: "knows", to: "p1" },
        { from: "p1", type: "knows", to: "ghost" },
      ],
    });
    const { payload, issues, stats } = mapMatraixToCanonical(dataset);

    const codes = issues.map((i) => i.code).sort();
    expect(codes).toEqual([
      "BROKEN_REFERENCE", // missing population
      "BROKEN_REFERENCE", // relation to ghost
      "DUPLICATE_SOURCE_ID", // duplicate persona
      "DUPLICATE_SOURCE_ID", // duplicate relation id
    ]);
    expect(stats.skippedDuplicates).toBe(1);
    expect(stats.skippedRelations).toBe(3);

    // Only the valid relation survives; graph remains referentially sound.
    expect(payload.relationships).toHaveLength(1);
    expect(validateGraph(payload).valid).toBe(true);
  });
});

describe("projections over an imported MatrAIx graph", () => {
  beforeEach(() => vi.mocked(completeJSON).mockReset());

  it("roleplayx adapter projects the imported graph deterministically", async () => {
    const graph = importedGraph();
    const result = await roleplayxAdapter.project({ graph, simulation: null });

    expect(result.target).toBe("roleplayx");
    const payload = result.payload as {
      personas: { name: string }[];
      objectives: string[];
      playerRole: string;
    };
    expect(payload.personas.map((p) => p.name)).toEqual([
      "Kim Jiyoung",
      "Park Minsu",
    ]);
    expect(payload.objectives).toContain(
      "Find reliable products at fair prices",
    );
    expect(result.provenance[0]).toMatchObject({
      layer: "canonical",
      contentId: "content_test",
      contentVersion: 1,
    });
  });

  it("novel adapter projects the imported graph (mocked LLM)", async () => {
    const prose = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
    vi.mocked(completeJSON).mockResolvedValueOnce({
      title: "The Fair Price",
      logline: "Two shoppers navigate a changing retail world.",
      theme: "trust",
      characters: [{ name: "Kim Jiyoung", arc: "learns to negotiate" }],
      scenes: [
        { heading: "Scene 1", prose },
        { heading: "Scene 2", prose },
      ],
    });

    const graph = importedGraph();
    const result = await novelAdapter.project({ graph, simulation: null });

    expect(result.target).toBe("novel");
    expect(result.provenance[0]).toMatchObject({
      layer: "canonical",
      contentId: "content_test",
    });
    // The LLM prompt was built from the imported canonical entities.
    const user = vi.mocked(completeJSON).mock.calls[0]![0].user;
    expect(user).toContain("Kim Jiyoung");
    expect(user).toContain("[population] Retail Customers 30-50");
  });
});
