import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Immutable version snapshots of a content graph.
 * Versioning is non-destructive: each snapshot preserves the full graph.
 */
export const contentVersionsTable = pgTable("content_versions", {
  id: text("id").primaryKey(),
  contentId: text("content_id").notNull(),
  version: integer("version").notNull(),
  parentVersion: integer("parent_version"),
  note: text("note"),
  author: text("author"),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("content_versions_content_id_version_idx").on(
    table.contentId,
    table.version,
  ),
]);

export const insertContentVersionSchema = createInsertSchema(
  contentVersionsTable,
).omit({ createdAt: true });
export type InsertContentVersion = z.infer<typeof insertContentVersionSchema>;
export type ContentVersionRow = typeof contentVersionsTable.$inferSelect;
