import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Category system for real-world situation clustering.
 * Axes: domain (직장/가족/...), conflictType (이해충돌/배신/...), tone.
 * origin: "seed" (fixed taxonomy) or "auto" (proposed by the classifier when
 * it encounters a situation type not covered by existing categories).
 */
export const categoriesTable = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    axis: text("axis").notNull(), // "domain" | "conflictType" | "tone"
    name: text("name").notNull(),
    description: text("description"),
    origin: text("origin").notNull().default("seed"), // "seed" | "auto"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("categories_axis_name_idx").on(t.axis, t.name)],
);

export type CategoryRow = typeof categoriesTable.$inferSelect;
