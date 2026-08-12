import { describe, it, expect } from "vitest";
import type { ContentRow } from "@workspace/db";
import { exportCanonical, versionToInfo, toContentGraph } from "../content/service";
import { validGraphPayload } from "./fixtures";

function row(): ContentRow {
  return {
    id: "content_demo1",
    title: "Launch Clash",
    sourcePrompt: "신제품 출시를 앞둔 회사에서 품질팀과 마케팅팀이 충돌한다.",
    version: 2,
    graph: validGraphPayload(),
    createdAt: new Date("2026-08-12T00:00:00.000Z"),
    updatedAt: new Date("2026-08-12T01:00:00.000Z"),
  } as ContentRow;
}

describe("versioning and canonical export", () => {
  it("versionToInfo derives counts from the immutable snapshot", () => {
    const info = versionToInfo({
      id: "version_v2",
      contentId: "content_demo1",
      version: 2,
      parentVersion: 1,
      note: "After edits",
      author: "user",
      snapshot: validGraphPayload(),
      createdAt: new Date("2026-08-12T01:00:00.000Z"),
    });
    expect(info.version).toBe(2);
    expect(info.parentVersion).toBe(1);
    expect(info.entityCount).toBe(7);
    expect(info.relationshipCount).toBe(5);
    expect(info.createdAt).toBe("2026-08-12T01:00:00.000Z");
  });

  it("canonical export is platform independent and complete", () => {
    const exported = exportCanonical(row());
    expect(exported.schemaVersion).toBe("contentx.canonical/1.0");
    expect(exported.content.id).toBe("content_demo1");
    expect(exported.content.version).toBe(2);
    expect(exported.content.entities).toHaveLength(7);
    expect(exported.content.relationships).toHaveLength(5);
    expect(exported.content.provenance?.operation).toBe("generate");
    // No platform-specific fields leak into canonical export
    const json = JSON.stringify(exported);
    expect(json).not.toContain("playerRole");
    expect(json).not.toContain("persona");
  });

  it("toContentGraph preserves provenance from storage", () => {
    const graph = toContentGraph(row());
    expect(graph.provenance?.generatedByProvider).toBe("mock");
    expect(graph.sourcePrompt).toContain("품질팀");
  });
});
