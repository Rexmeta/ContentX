import {
  check,
  index,
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
 * Every remote validate/import attempt. Request credentials are intentionally
 * absent; only redacted structured remote results may be persisted.
 */
export const assessmentPublicationsTable = pgTable(
  "assessment_publications",
  {
    id: text("id").primaryKey(),
    packageId: text("package_id")
      .notNull()
      .references(() => assessmentPackagesTable.id, {
        onDelete: "restrict",
      }),
    packageVersion: integer("package_version").notNull(),
    target: text("target").notNull().default("roleplayx"),
    targetUrl: text("target_url"),
    targetOrganizationId: text("target_organization_id").notNull(),
    targetCategoryId: text("target_category_id").notNull(),
    /** Deterministic key supplied to both remote validate and import calls. */
    idempotencyKey: text("idempotency_key").notNull(),
    requestId: text("request_id"),
    attempt: integer("attempt").notNull(),
    status: text("status").notNull().default("pending"),
    response: jsonb("response"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by"),
  },
  (t) => [
    index("assessment_publications_version_target_idx").on(
      t.packageId,
      t.packageVersion,
      t.target,
      t.targetOrganizationId,
      t.targetCategoryId,
    ),
    uniqueIndex("assessment_publications_attempt_idx").on(
      t.packageId,
      t.packageVersion,
      t.target,
      t.targetOrganizationId,
      t.targetCategoryId,
      t.attempt,
    ),
    // PostgreSQL partial unique index: failed attempts remain auditable, but
    // no target can ever have two successful imports for one version.
    uniqueIndex("assessment_publications_one_successful_target_idx")
      .on(t.packageId, t.packageVersion, t.target, t.targetOrganizationId, t.targetCategoryId)
      .where(sql`${t.status} = 'succeeded'`),
    check(
      "assessment_publications_attempt_positive_check",
      sql`${t.attempt} > 0`,
    ),
    check(
      "assessment_publications_status_check",
      sql`${t.status} in ('pending', 'validating', 'validated', 'importing', 'succeeded', 'failed')`,
    ),
  ],
);

export const insertAssessmentPublicationSchema = createInsertSchema(
  assessmentPublicationsTable,
).omit({ createdAt: true });
export type InsertAssessmentPublication = z.infer<
  typeof insertAssessmentPublicationSchema
>;
export type AssessmentPublicationRow =
  typeof assessmentPublicationsTable.$inferSelect;