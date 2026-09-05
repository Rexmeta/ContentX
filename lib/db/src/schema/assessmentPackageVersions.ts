import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { assessmentPackagesTable } from "./assessmentPackages";

/**
 * Append-only canonical package snapshots. There is deliberately no
 * `updatedAt`: a snapshot, its validation report, and checksum are audit
 * evidence and must never be overwritten after creation.
 */
export const assessmentPackageVersionsTable = pgTable(
  "assessment_package_versions",
  {
    id: text("id").primaryKey(),
    packageId: text("package_id")
      .notNull()
      .references(() => assessmentPackagesTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    /** AssessmentScenarioPackageV1, including the computed content hash. */
    packageJson: jsonb("package_json").notNull(),
    /** SHA-256 of the canonical package excluding its checksum field. */
    contentHash: text("content_hash").notNull(),
    /** Local strict-schema and semantic validation result. */
    validationReport: jsonb("validation_report").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("assessment_package_versions_package_version_idx").on(
      t.packageId,
      t.version,
    ),
    // Repeating identical compiler input is idempotent within a package.
    uniqueIndex("assessment_package_versions_package_checksum_idx").on(
      t.packageId,
      t.contentHash,
    ),
    check(
      "assessment_package_versions_version_positive_check",
      sql`${t.version} > 0`,
    ),
    check(
      "assessment_package_versions_content_hash_sha256_check",
      sql`${t.contentHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const insertAssessmentPackageVersionSchema = createInsertSchema(
  assessmentPackageVersionsTable,
).omit({ createdAt: true });
export type InsertAssessmentPackageVersion = z.infer<
  typeof insertAssessmentPackageVersionSchema
>;
export type AssessmentPackageVersionRow =
  typeof assessmentPackageVersionsTable.$inferSelect;