import type { GraphPayload } from "../content/model";

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  objectId?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  checkedAt: string;
  checks: string[];
  issues: ValidationIssue[];
}

const ID_PATTERN = /^(content|entity|relationship|event|narrative|asset|projection|version)_[A-Za-z0-9_-]+$/;

export const VALIDATION_CHECKS = [
  "schema:required-fields",
  "schema:id-format",
  "identity:duplicate-ids",
  "references:relationship-endpoints",
  "relationships:self-reference",
] as const;

/**
 * Pure, deterministic graph validation: schema shape, required fields,
 * duplicate IDs, and broken references.
 */
export function validateGraph(graph: GraphPayload): ValidationResult {
  const issues: ValidationIssue[] = [];

  const seen = new Set<string>();
  for (const e of graph.entities) {
    if (!e.id || !e.kind || !e.name || e.name.trim() === "") {
      issues.push({
        severity: "error",
        code: "MISSING_REQUIRED_FIELD",
        message: `Entity ${e.id || "(no id)"} is missing a required field (id, kind, name).`,
        objectId: e.id || null,
      });
    }
    if (e.id && !ID_PATTERN.test(e.id)) {
      issues.push({
        severity: "warning",
        code: "ID_FORMAT",
        message: `Entity id "${e.id}" does not follow the prefixed stable-id convention.`,
        objectId: e.id,
      });
    }
    if (e.id) {
      if (seen.has(e.id)) {
        issues.push({
          severity: "error",
          code: "DUPLICATE_ID",
          message: `Duplicate id "${e.id}".`,
          objectId: e.id,
        });
      }
      seen.add(e.id);
    }
  }

  for (const r of graph.relationships) {
    if (!r.id || !r.source || !r.target || !r.type || r.type.trim() === "") {
      issues.push({
        severity: "error",
        code: "MISSING_REQUIRED_FIELD",
        message: `Relationship ${r.id || "(no id)"} is missing a required field (id, source, type, target).`,
        objectId: r.id || null,
      });
      continue;
    }
    if (!ID_PATTERN.test(r.id)) {
      issues.push({
        severity: "warning",
        code: "ID_FORMAT",
        message: `Relationship id "${r.id}" does not follow the prefixed stable-id convention.`,
        objectId: r.id,
      });
    }
    if (seen.has(r.id)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_ID",
        message: `Duplicate id "${r.id}".`,
        objectId: r.id,
      });
    }
    seen.add(r.id);

    const entityIds = new Set(graph.entities.map((e) => e.id));
    if (!entityIds.has(r.source)) {
      issues.push({
        severity: "error",
        code: "BROKEN_REFERENCE",
        message: `Relationship "${r.id}" source "${r.source}" does not exist.`,
        objectId: r.id,
      });
    }
    if (!entityIds.has(r.target)) {
      issues.push({
        severity: "error",
        code: "BROKEN_REFERENCE",
        message: `Relationship "${r.id}" target "${r.target}" does not exist.`,
        objectId: r.id,
      });
    }
    if (r.source === r.target) {
      issues.push({
        severity: "warning",
        code: "SELF_REFERENCE",
        message: `Relationship "${r.id}" points from an entity to itself.`,
        objectId: r.id,
      });
    }
  }

  return {
    valid: issues.every((i) => i.severity !== "error"),
    checkedAt: new Date().toISOString(),
    checks: [...VALIDATION_CHECKS],
    issues,
  };
}
