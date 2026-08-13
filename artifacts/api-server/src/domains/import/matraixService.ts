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

/** Raw MatrAIx payload failed schema validation — a 400 at the boundary. */
export class MatraixParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatraixParseError";
  }
}

export interface MatraixImportReport {
  /** Issues found while mapping the MatrAIx source (duplicates, broken refs). */
  importIssues: ValidationIssue[];
  /** Canonical validation of the committed graph (same checks as /validate). */
  validation: ValidationResult;
  stats: MatraixImportStats;
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

  if (input.dryRun) {
    const nowIso = new Date().toISOString();
    return {
      content: {
        id: "content_dryrun",
        title,
        sourcePrompt: null,
        version: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...payload,
      },
      report: { importIssues: issues, validation, stats },
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
