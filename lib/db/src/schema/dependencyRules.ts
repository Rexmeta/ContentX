import {
  pgTable,
  text,
  integer,
  jsonb,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { populationsTable } from "./populations";

/**
 * DependencyRule — STATISTICAL dependency between dimensions of a
 * population (e.g. occupation=manager → authority_level high 0.72).
 * Completely separate from SemanticRelationship (worksAt, conflictsWith).
 */
export const dependencyRulesTable = pgTable("dependency_rules", {
  id: text("id").primaryKey(),
  populationId: text("population_id")
    .notNull()
    .references(() => populationsTable.id, { onDelete: "cascade" }),
  sourceDimension: text("source_dimension").notNull(),
  targetDimension: text("target_dimension").notNull(),
  // conditional | constraint | exclusion | implication | correlation
  type: text("type").notNull(),
  // Conditions on the source dimension, e.g. [{ equals: "manager" }].
  conditions: jsonb("conditions").notNull(),
  // Effect payload: conditional distribution / fixed value / excluded values.
  effect: jsonb("effect").notNull(),
  strength: real("strength"),
  provenance: jsonb("provenance").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDependencyRuleSchema = createInsertSchema(
  dependencyRulesTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertDependencyRule = z.infer<typeof insertDependencyRuleSchema>;
export type DependencyRuleRow = typeof dependencyRulesTable.$inferSelect;
