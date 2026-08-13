/**
 * Real-database concurrency tests for the MatrAIx re-import policy.
 *
 * These hit the actual PostgreSQL instance (DATABASE_URL) because the
 * no-duplicate guarantee rests on a transaction-scoped advisory lock in
 * upsertContentBySource — something mocks cannot exercise:
 * - simultaneous FIRST imports of the same source.uri → exactly one graph
 * - simultaneous RE-imports → sequential versions, no duplicate rows
 *
 * Skipped when DATABASE_URL is not configured.
 */
import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { importMatraix } from "../import/matraixService";
import * as contentRepo from "../content/repository";

const hasDb = Boolean(process.env["DATABASE_URL"]);
const d = hasDb ? describe : describe.skip;

const sample = JSON.parse(
  readFileSync(
    path.resolve(
      __dirname,
      "../../../../../docs/examples/matraix-import-sample.json",
    ),
    "utf8",
  ),
) as Record<string, unknown>;

const createdContentIds = new Set<string>();
const runTag = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function datasetWithUri(uri: string): Record<string, unknown> {
  const source = { ...(sample["source"] as Record<string, unknown>), uri };
  return { ...sample, source };
}

afterAll(async () => {
  for (const id of createdContentIds) {
    await contentRepo.deleteContent(id);
  }
});

d("MatrAIx import concurrency (real DB)", () => {
  it("simultaneous first imports of the same source.uri create exactly one graph", async () => {
    const uri = `matraix://exports/${runTag}/first-import-race`;
    const dataset = datasetWithUri(uri);

    const results = await Promise.all(
      Array.from({ length: 4 }, () => importMatraix({ dataset })),
    );
    for (const r of results) createdContentIds.add(r.content.id);

    const ids = new Set(results.map((r) => r.content.id));
    expect(ids.size).toBe(1);

    // Exactly one racer created (v1, no reimport); the rest updated it.
    const creators = results.filter((r) => !r.report.reimport);
    expect(creators).toHaveLength(1);
    const versions = results
      .map((r) => r.content.version)
      .sort((a, b) => a - b);
    expect(versions).toEqual([1, 2, 3, 4]);

    // Version chain in the DB is contiguous with correct parents.
    const contentId = [...ids][0]!;
    const versionRows = await contentRepo.listVersions(contentId);
    expect(versionRows.map((v) => v.version)).toEqual([1, 2, 3, 4]);
    expect(versionRows.map((v) => v.parentVersion)).toEqual([null, 1, 2, 3]);
  });

  it("simultaneous re-imports serialize into distinct versions with accurate previousVersion", async () => {
    const uri = `matraix://exports/${runTag}/reimport-race`;
    const dataset = datasetWithUri(uri);

    const first = await importMatraix({ dataset });
    createdContentIds.add(first.content.id);
    expect(first.content.version).toBe(1);
    expect(first.report.reimport).toBeUndefined();

    const reimports = await Promise.all(
      Array.from({ length: 3 }, () => importMatraix({ dataset })),
    );
    for (const r of reimports) createdContentIds.add(r.content.id);

    // All hit the same graph; versions are distinct and sequential.
    expect(new Set(reimports.map((r) => r.content.id))).toEqual(
      new Set([first.content.id]),
    );
    const versions = reimports
      .map((r) => r.content.version)
      .sort((a, b) => a - b);
    expect(versions).toEqual([2, 3, 4]);

    // previousVersion in each report is the actual locked predecessor
    // (committed version - 1), never a stale pre-lock read.
    for (const r of reimports) {
      expect(r.report.reimport).toBeDefined();
      expect(r.report.reimport!.previousVersion).toBe(r.content.version - 1);
      // Identical dataset → diff shows no structural changes.
      expect(r.report.reimport!.diff).toMatchObject({
        addedEntities: 0,
        changedEntities: 0,
        removedEntities: 0,
      });
    }

    const versionRows = await contentRepo.listVersions(first.content.id);
    expect(versionRows.map((v) => v.version)).toEqual([1, 2, 3, 4]);
    expect(versionRows.map((v) => v.parentVersion)).toEqual([null, 1, 2, 3]);
  });
});
