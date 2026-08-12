import type { ContentRow } from "@workspace/db";
import { newId } from "../../shared/id";
import { orchestrator } from "../ai/orchestrator";
import { validateGraph, type ValidationResult } from "../validation/validator";
import type { ContentGraph, GraphPayload } from "./model";
import * as repo from "./repository";

/**
 * Content domain service — the use-case layer between API routes and
 * persistence. Route handlers stay thin; all rules live here.
 */

function toGraphPayload(row: ContentRow): GraphPayload {
  return row.graph as unknown as GraphPayload;
}

export function toContentGraph(row: ContentRow): ContentGraph {
  const payload = toGraphPayload(row);
  return {
    id: row.id,
    title: row.title,
    sourcePrompt: row.sourcePrompt,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    entities: payload.entities ?? [],
    relationships: payload.relationships ?? [],
    ...(payload.provenance ? { provenance: payload.provenance } : {}),
  };
}

export function toSummary(row: ContentRow) {
  const payload = toGraphPayload(row);
  return {
    id: row.id,
    title: row.title,
    sourcePrompt: row.sourcePrompt,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    entityCount: payload.entities?.length ?? 0,
    relationshipCount: payload.relationships?.length ?? 0,
  };
}

export async function createFromPrompt(
  prompt: string,
  title?: string,
): Promise<ContentGraph> {
  const payload = await orchestrator.generate(prompt);
  // Content row and its v1 snapshot are committed atomically.
  const row = await repo.insertContentWithInitialVersion(
    {
      id: newId("content"),
      title: title?.trim() || prompt.trim().slice(0, 80),
      sourcePrompt: prompt,
      version: 1,
      graph: payload,
    },
    {
      id: newId("version"),
      version: 1,
      parentVersion: null,
      note: "Initial generation",
      author: payload.provenance?.generatedByProvider ?? null,
    },
  );
  return toContentGraph(row);
}

export async function updateEntity(
  contentId: string,
  entityId: string,
  patch: {
    name?: string;
    description?: string | null;
    attributes?: Record<string, unknown>;
  },
): Promise<ContentGraph | null> {
  const result = await repo.mutateGraph(contentId, (payload) => {
    const entity = payload.entities.find((e) => e.id === entityId);
    if (!entity) return null;
    if (patch.name !== undefined) entity.name = patch.name;
    if (patch.description !== undefined) entity.description = patch.description;
    if (patch.attributes !== undefined) entity.attributes = patch.attributes;
    return payload;
  });
  if (!result || "error" in result) return null;
  return toContentGraph(result);
}

export async function updateRelationship(
  contentId: string,
  relationshipId: string,
  patch: {
    type?: string;
    source?: string;
    target?: string;
    attributes?: Record<string, unknown>;
  },
): Promise<ContentGraph | null | { error: string }> {
  const result = await repo.mutateGraph(contentId, (payload) => {
    const rel = payload.relationships.find((r) => r.id === relationshipId);
    if (!rel) return null;

    const entityIds = new Set(payload.entities.map((e) => e.id));
    if (patch.source !== undefined && !entityIds.has(patch.source)) {
      return { error: `Source entity "${patch.source}" does not exist.` };
    }
    if (patch.target !== undefined && !entityIds.has(patch.target)) {
      return { error: `Target entity "${patch.target}" does not exist.` };
    }

    if (patch.type !== undefined) rel.type = patch.type;
    if (patch.source !== undefined) rel.source = patch.source;
    if (patch.target !== undefined) rel.target = patch.target;
    if (patch.attributes !== undefined) rel.attributes = patch.attributes;
    return payload;
  });
  if (!result) return null;
  if ("error" in result) return result;
  return toContentGraph(result);
}

export async function validateContent(
  contentId: string,
): Promise<ValidationResult | null> {
  const row = await repo.getContent(contentId);
  if (!row) return null;
  return validateGraph(toGraphPayload(row));
}

export async function snapshotVersion(
  contentId: string,
  note?: string,
  author?: string,
) {
  const result = await repo.snapshotNextVersion({
    contentId,
    versionId: newId("version"),
    note: note ?? null,
    author: author ?? null,
  });
  if (!result) return null;
  const { version, snapshot } = result;
  return {
    id: version.id,
    contentId: version.contentId,
    version: version.version,
    parentVersion: version.parentVersion,
    note: version.note,
    author: version.author,
    createdAt: version.createdAt.toISOString(),
    entityCount: snapshot.entities.length,
    relationshipCount: snapshot.relationships.length,
  };
}

export function versionToInfo(v: {
  id: string;
  contentId: string;
  version: number;
  parentVersion: number | null;
  note: string | null;
  author: string | null;
  snapshot: unknown;
  createdAt: Date;
}) {
  const snapshot = v.snapshot as GraphPayload;
  return {
    id: v.id,
    contentId: v.contentId,
    version: v.version,
    parentVersion: v.parentVersion,
    note: v.note,
    author: v.author,
    createdAt: v.createdAt.toISOString(),
    entityCount: snapshot.entities?.length ?? 0,
    relationshipCount: snapshot.relationships?.length ?? 0,
  };
}

/**
 * Canonical export — platform independent, no private DB details
 * (JSONB column layout, row internals) are exposed.
 */
export function exportCanonical(row: ContentRow) {
  return {
    schemaVersion: "contentx.canonical/1.0",
    exportedAt: new Date().toISOString(),
    content: toContentGraph(row),
  };
}

export async function dashboardSummary() {
  const { contents, versions } = await repo.countAll();
  const kindCounts: Record<string, number> = {};
  let entityCount = 0;
  let relationshipCount = 0;
  for (const row of contents) {
    const payload = toGraphPayload(row);
    entityCount += payload.entities?.length ?? 0;
    relationshipCount += payload.relationships?.length ?? 0;
    for (const e of payload.entities ?? []) {
      kindCounts[e.kind] = (kindCounts[e.kind] ?? 0) + 1;
    }
  }
  return {
    contentCount: contents.length,
    entityCount,
    relationshipCount,
    versionCount: versions.length,
    entityKindCounts: kindCounts,
    recentContent: contents.slice(0, 5).map(toSummary),
  };
}
