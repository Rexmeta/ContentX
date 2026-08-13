import { newId } from "../../shared/id";
import type { ContentGraph } from "../content/model";
import * as contentService from "../content/service";
import * as contentRepo from "../content/repository";
import {
  validateGraph,
  type ValidationIssue,
  type ValidationResult,
} from "../validation/validator";
import { matraixDatasetSchema } from "./matraixModel";
import {
  mapMatraixToCanonical,
  type MatraixImportStats,
} from "./matraixImporter";
import { diffGraphPayloads, type GraphDiff } from "./graphDiff";
import type { GraphPayload } from "../content/model";

/** Raw MatrAIx payload failed schema validation — a 400 at the boundary. */
export class MatraixParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatraixParseError";
  }
}

export interface MatraixReimportInfo {
  /** Id of the existing graph that was updated instead of duplicated. */
  existingContentId: string;
  /** Version of the existing graph before this re-import. */
  previousVersion: number;
  /** Structural diff of the incoming graph against the existing one. */
  diff: GraphDiff;
}

export interface MatraixImportReport {
  /** Issues found while mapping the MatrAIx source (duplicates, broken refs). */
  importIssues: ValidationIssue[];
  /** Canonical validation of the committed graph (same checks as /validate). */
  validation: ValidationResult;
  stats: MatraixImportStats;
  /**
   * Present when the dataset's source.uri matches an already imported graph.
   * The existing graph is then updated in place (version +1) instead of
   * creating a duplicate.
   */
  reimport?: MatraixReimportInfo;
}

export interface MatraixImportResult {
  content: ContentGraph;
  report: MatraixImportReport;
}

/**
 * Import a MatrAIx dataset as a new canonical content graph.
 *
 * - Strict schema validation of the raw dataset (unknown keys are rejected).
 * - Deterministic mapping with an explicit issue report; broken references
 *   and duplicates are skipped and reported, never silently repaired.
 * - The committed graph is re-validated with the shared canonical validator
 *   and is only persisted when it passes (no invalid graph ever lands).
 * - `dryRun` performs mapping + validation without committing.
 */
export async function importMatraix(input: {
  dataset: unknown;
  title?: string | undefined;
  dryRun?: boolean | undefined;
}): Promise<MatraixImportResult> {
  const parsed = matraixDatasetSchema.safeParse(input.dataset);
  if (!parsed.success) {
    throw new MatraixParseError(
      `Invalid MatrAIx dataset: ${parsed.error.message}`,
    );
  }
  const dataset = parsed.data;

  const { payload, issues, stats } = mapMatraixToCanonical(dataset);
  const validation = validateGraph(payload);
  if (!validation.valid) {
    // The mapper guarantees referential soundness; a failure here is a bug,
    // not user input — fail loudly instead of committing a broken graph.
    throw new MatraixParseError(
      `Mapped MatrAIx graph failed canonical validation: ${validation.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message)
        .join(" ")}`,
    );
  }

  const title =
    input.title?.trim() ||
    dataset.source?.title?.trim() ||
    dataset.world?.name ||
    `MatrAIx import (${dataset.schemaVersion})`;

  // Re-import policy: the same dataset (identified by source.uri) must
  // update the existing graph as a new version instead of piling up
  // duplicate graphs. Datasets without a source.uri cannot be identified
  // and always create a new graph.
  const sourceUri = dataset.source?.uri;

  if (input.dryRun) {
    // Read-only preview: the lookup here is advisory (no lock is taken, so
    // it may race with a concurrent commit), which is acceptable for a dry
    // run that never writes.
    const existing = sourceUri
      ? await contentRepo.findByProvenanceSource("matraix", sourceUri)
      : undefined;
    const reimport: MatraixReimportInfo | undefined = existing
      ? {
          existingContentId: existing.id,
          previousVersion: existing.version,
          diff: diffGraphPayloads(
            existing.graph as unknown as GraphPayload,
            payload,
          ),
        }
      : undefined;
    const nowIso = new Date().toISOString();
    return {
      content: {
        id: existing?.id ?? "content_dryrun",
        title,
        sourcePrompt: null,
        version: existing?.version ?? 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...payload,
      },
      report: {
        importIssues: issues,
        validation,
        stats,
        ...(reimport ? { reimport } : {}),
      },
    };
  }

  if (sourceUri) {
    // Lookup + insert-or-replace happen atomically inside the repository
    // (advisory lock on the source identity), so two simultaneous imports of
    // the same source.uri cannot both create a graph. The diff is computed
    // from the actual locked predecessor, never a stale pre-lock read.
    const { row, previous } = await contentRepo.upsertContentBySource({
      sourceType: "matraix",
      sourceUri,
      content: {
        id: newId("content"),
        title,
        sourcePrompt: null,
        graph: payload,
      },
      versionId: newId("version"),
      insertNote: `MatrAIx import (${dataset.schemaVersion})`,
      updateNote: `MatrAIx re-import (${dataset.schemaVersion})`,
      author: "matraix-importer",
      // Only override the title when the caller explicitly provided one;
      // a re-import must not silently rename a graph the user may have edited.
      overrideTitle: input.title?.trim() || undefined,
    });
    const reimport: MatraixReimportInfo | undefined = previous
      ? {
          existingContentId: previous.id,
          previousVersion: previous.version,
          diff: diffGraphPayloads(previous.graph, payload),
        }
      : undefined;
    return {
      content: contentService.toContentGraph(row),
      report: {
        importIssues: issues,
        validation,
        stats,
        ...(reimport ? { reimport } : {}),
      },
    };
  }

  const row = await contentRepo.insertContentWithInitialVersion(
    {
      id: newId("content"),
      title,
      sourcePrompt: null,
      version: 1,
      graph: payload,
    },
    {
      id: newId("version"),
      version: 1,
      parentVersion: null,
      note: `MatrAIx import (${dataset.schemaVersion})`,
      author: "matraix-importer",
    },
  );

  return {
    content: contentService.toContentGraph(row),
    report: { importIssues: issues, validation, stats },
  };
}
