import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Dimension registry — reusable, versioned attribute dimensions used to
 * describe characters and (later) populations. Normalized columns; only
 * allowedValues is JSONB (variable-length list of enum values).
 */
export const dimensionsTable = pgTable("dimensions", {
  id: text("id").primaryKey(),
  // Stable machine name (unique), e.g. "age", "occupation", "risk_tolerance".
  name: text("name").notNull().unique(),
  // demographic | professional | psychological | behavioral | social |
  // preference | capability | technology | domain
  category: text("category").notNull(),
  // string | number | boolean | enum | array
  dataType: text("data_type").notNull(),
  // For enum dimensions: the list of allowed values. Null otherwise.
  allowedValues: jsonb("allowed_values"),
  // Where the dimension came from: "seed" | "user" | "import:<source>".
  source: text("source").notNull().default("seed"),
  version: integer("version").notNull().default(1),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDimensionSchema = createInsertSchema(dimensionsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertDimension = z.infer<typeof insertDimensionSchema>;
export type DimensionRow = typeof dimensionsTable.$inferSelect;
