import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Canonical content record. The graph column stores the platform-independent
 * Content Graph (entities, relationships, provenance) as JSONB.
 * IDs use stable prefixed identifiers (content_...), never array indexes.
 */
export const contentsTable = pgTable("contents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  sourcePrompt: text("source_prompt"),
  version: integer("version").notNull().default(1),
  graph: jsonb("graph").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertContentSchema = createInsertSchema(contentsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertContent = z.infer<typeof insertContentSchema>;
export type ContentRow = typeof contentsTable.$inferSelect;
