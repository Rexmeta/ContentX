import { createHash } from "node:crypto";
import type { AssessmentScenarioPackageV1 } from "./model";

/** Recursively sorts object keys while deliberately preserving array order. */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJson(object[key])}`).join(",")}}`;
}

export function calculateAssessmentPackageHash(packageValue: Omit<AssessmentScenarioPackageV1, "provenance"> & { provenance: Omit<AssessmentScenarioPackageV1["provenance"], "contentHash"> & Partial<Pick<AssessmentScenarioPackageV1["provenance"], "contentHash">> }): string {
  const packageWithoutHash = {
    ...packageValue,
    provenance: { ...packageValue.provenance },
  };
  delete packageWithoutHash.provenance.contentHash;
  return createHash("sha256").update(canonicalizeJson(packageWithoutHash), "utf8").digest("hex");
}

/** Ignores any externally supplied digest and returns a new package with its trusted hash. */
export function withAssessmentPackageHash(packageValue: AssessmentScenarioPackageV1): AssessmentScenarioPackageV1 {
  return {
    ...packageValue,
    provenance: {
      ...packageValue.provenance,
      contentHash: calculateAssessmentPackageHash(packageValue),
    },
  };
}

export const hashAssessmentScenarioPackage = calculateAssessmentPackageHash;