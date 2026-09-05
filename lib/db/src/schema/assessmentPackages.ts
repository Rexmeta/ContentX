import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * A stable assessment-package identity. Versions below are immutable
 * RoleplayX payload snapshots; this row is only the package's stable handle.
 */
export const assessmentPackagesTable = pgTable(
  "assessment_packages",
  {
    id: text("id").primaryKey(),
    /** Stable, caller-selected RoleplayX package identity. */
    packageKey: text("package_key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    /** Canonical ContentX source identity; never RoleplayX-owned data. */
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    status: text("status").notNull().default("draft"),
    currentVersion: integer("current_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("assessment_packages_package_key_idx").on(t.packageKey),
    check(
      "assessment_packages_status_check",
      sql`${t.status} in ('draft', 'validated', 'approved', 'published', 'archived')`,
    ),
  ],
);

export const insertAssessmentPackageSchema = createInsertSchema(
  assessmentPackagesTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertAssessmentPackage = z.infer<
  typeof insertAssessmentPackageSchema
>;
export type AssessmentPackageRow = typeof assessmentPackagesTable.$inferSelect;