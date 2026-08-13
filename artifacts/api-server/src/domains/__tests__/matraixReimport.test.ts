/**
 * Re-import policy tests: importing the same MatrAIx dataset (same
 * source.uri) twice must update the existing graph as a new version instead
 * of creating a duplicate, and the report must include a structural diff
 * against the previous graph. The persistence boundary is mocked so only the
 * import service policy is exercised.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ContentRow } from "@workspace/db";

vi.mock("../content/repository", () => ({
  findByProvenanceSource: vi.fn(),
  insertContentWithInitialVersion: vi.fn(),
  upsertContentBySource: vi.fn(),
}));

import * as contentRepo from "../content/repository";
import { importMatraix } from "../import/matraixService";
import { matraixDatasetSchema } from "../import/matraixModel";
import { mapMatraixToCanonical } from "../import/matraixImporter";
import { diffGraphPayloads } from "../import/graphDiff";
import type { GraphPayload } from "../content/model";

const sample = JSON.parse(
  readFileSync(
    path.resolve(
      __dirname,
      "../../../../../docs/examples/matraix-import-sample.json",
    ),
    "utf8",
  ),
) as Record<string, unknown>;

function mappedPayload(dataset: unknown): GraphPayload {
  return mapMatraixToCanonical(matraixDatasetSchema.parse(dataset)).payload;
}

function contentRow(overrides: Partial<ContentRow> = {}): ContentRow {
  return {
    id: "content_existing",
    title: "Existing import",
    sourcePrompt: null,
    version: 1,
    graph: mappedPayload(sample),
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  } as ContentRow;
}

beforeEach(() => {
  vi.mocked(contentRepo.findByProvenanceSource).mockReset();
  vi.mocked(contentRepo.insertContentWithInitialVersion).mockReset();
  vi.mocked(contentRepo.upsertContentBySource).mockReset();
});

describe("diffGraphPayloads", () => {
  it("reports all-unchanged for identical payloads regardless of key order", () => {
    const a = mappedPayload(sample);
    const b = mappedPayload(sample);
    // Shuffle attribute key order to prove comparison is key-order-insensitive.
    b.entities = b.entities.map((e) => ({
      attributes: e.attributes,
      id: e.id,
      name: e.name,
      kind: e.kind,
      description: e.description,
      ...(e.canonicalName !== undefined
        ? { canonicalName: e.canonicalName }
        : {}),
      ...(e.aliases !== undefined ? { aliases: e.aliases } : {}),
    }));
    const diff = diffGraphPayloads(a, b);
    expect(diff).toEqual({
      addedEntities: 0,
      changedEntities: 0,
      removedEntities: 0,
      unchangedEntities: a.entities.length,
      addedRelationships: 0,
      changedRelationships: 0,
      removedRelationships: 0,
    });
  });

  it("counts added, changed, and removed objects by id", () => {
    const prev = mappedPayload({
      schemaVersion: "matraix/1.0",
      personas: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
      ],
      relations: [{ id: "r1", from: "p1", type: "knows", to: "p2" }],
    });
    const next = mappedPayload({
      schemaVersion: "matraix/1.0",
      personas: [
        { id: "p1", name: "A renamed" }, // changed
        { id: "p3", name: "C" }, // added; p2 removed
      ],
      // r1 removed → relation endpoints changed anyway
    });
    expect(diffGraphPayloads(prev, next)).toEqual({
      addedEntities: 1,
      changedEntities: 1,
      removedEntities: 1,
      unchangedEntities: 0,
      addedRelationships: 0,
      changedRelationships: 0,
      removedRelationships: 1,
    });
  });
});

describe("importMatraix re-import policy", () => {
  it("first import creates a new graph via the atomic upsert and has no reimport info", async () => {
    vi.mocked(contentRepo.upsertContentBySource).mockImplementation(
      async (input) => ({
        row: contentRow({
          id: input.content.id,
          title: input.content.title,
          graph: input.content.graph,
        }),
        previous: null,
      }),
    );

    const result = await importMatraix({ dataset: sample });

    expect(contentRepo.upsertContentBySource).toHaveBeenCalledOnce();
    expect(
      vi.mocked(contentRepo.upsertContentBySource).mock.calls[0]![0],
    ).toMatchObject({
      sourceType: "matraix",
      sourceUri: "matraix://exports/korean-retail-demo",
      insertNote: "MatrAIx import (matraix/1.0)",
      updateNote: "MatrAIx re-import (matraix/1.0)",
      overrideTitle: undefined, // no explicit title → keep existing on update
    });
    expect(contentRepo.insertContentWithInitialVersion).not.toHaveBeenCalled();
    expect(result.report.reimport).toBeUndefined();
  });

  it("re-import of the same source.uri updates the existing graph (version +1) with a diff", async () => {
    vi.mocked(contentRepo.upsertContentBySource).mockImplementation(
      async (input) => ({
        row: contentRow({
          id: "content_existing",
          version: 2,
          graph: input.content.graph,
        }),
        previous: {
          id: "content_existing",
          version: 1,
          graph: mappedPayload(sample),
        },
      }),
    );

    const result = await importMatraix({ dataset: sample });

    expect(result.content.id).toBe("content_existing");
    expect(result.content.version).toBe(2);
    expect(result.report.reimport).toMatchObject({
      existingContentId: "content_existing",
      previousVersion: 1,
      diff: {
        addedEntities: 0,
        changedEntities: 0,
        removedEntities: 0,
        addedRelationships: 0,
        changedRelationships: 0,
        removedRelationships: 0,
      },
    });
  });

  it("diff reflects dataset changes on re-import", async () => {
    vi.mocked(contentRepo.upsertContentBySource).mockImplementation(
      async (input) => ({
        row: contentRow({
          id: "content_existing",
          version: 2,
          graph: input.content.graph,
        }),
        previous: {
          id: "content_existing",
          version: 1,
          graph: mappedPayload(sample),
        },
      }),
    );

    const personas = (sample["personas"] as Record<string, unknown>[]).map(
      (p, i) => (i === 0 ? { ...p, name: "Renamed Persona" } : p),
    );
    const changed = {
      ...sample,
      personas: [...personas, { id: "persona.new", name: "Newcomer" }],
    };

    const result = await importMatraix({ dataset: changed });

    expect(result.report.reimport?.diff).toMatchObject({
      addedEntities: 1,
      changedEntities: 1,
      removedEntities: 0,
    });
  });

  it("dryRun re-import reports the diff without writing anything", async () => {
    vi.mocked(contentRepo.findByProvenanceSource).mockResolvedValue(
      contentRow(),
    );

    const result = await importMatraix({ dataset: sample, dryRun: true });

    expect(contentRepo.insertContentWithInitialVersion).not.toHaveBeenCalled();
    expect(contentRepo.upsertContentBySource).not.toHaveBeenCalled();
    expect(result.content.id).toBe("content_existing");
    expect(result.report.reimport?.existingContentId).toBe("content_existing");
  });

  it("datasets without a source.uri never match an existing graph", async () => {
    vi.mocked(contentRepo.insertContentWithInitialVersion).mockImplementation(
      async (row) =>
        contentRow({ id: row.id, title: row.title, graph: row.graph }),
    );

    const noSource = { ...sample };
    delete (noSource as Record<string, unknown>)["source"];
    const result = await importMatraix({ dataset: noSource });

    expect(contentRepo.upsertContentBySource).not.toHaveBeenCalled();
    expect(contentRepo.insertContentWithInitialVersion).toHaveBeenCalledOnce();
    expect(result.report.reimport).toBeUndefined();
  });
});
