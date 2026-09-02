import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Immutable commercial-validation documents. A single document envelope keeps
 * benchmark runs, comparisons, and evidence packages versioned together while
 * preserving the original trajectory JSON for later audit/download.
 */
export const commercialValidationArtifactsTable = pgTable("commercial_validation_artifacts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  checksum: text("checksum"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CommercialValidationArtifactRow = typeof commercialValidationArtifactsTable.$inferSelect;