import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Versioned, user-defined JSON export formats. Active versions are immutable. */
export const jsonFormatsTable = pgTable("json_formats", {
  formatId: text("format_id").notNull(),
  version: integer("version").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  example: jsonb("example"),
  jsonSchema: jsonb("json_schema").notNull(),
  mapping: jsonb("mapping").notNull(),
  mappingHash: text("mapping_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  unique("json_formats_format_version_unique").on(table.formatId, table.version),
  uniqueIndex("json_formats_one_active_version_idx")
    .on(table.formatId)
    .where(sql`${table.status} = 'active'`),
]);

export const insertJsonFormatSchema = createInsertSchema(jsonFormatsTable).omit({ createdAt: true, updatedAt: true });
export type InsertJsonFormat = z.infer<typeof insertJsonFormatSchema>;
export type JsonFormatRow = typeof jsonFormatsTable.$inferSelect;