import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Population — first-class canonical domain: a cohort definition over
 * registered dimensions with base distributions and constraints.
 * Statistical dependency rules live in dependency_rules (separate from
 * semantic relationships by architectural decision #4).
 */
export const populationsTable = pgTable("populations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  schemaVersion: text("schema_version").notNull().default("1"),
  // Dimension names (registry references) that define this population.
  dimensions: jsonb("dimensions").notNull(),
  // Base distribution per dimension name (categorical weights / numeric range).
  distributions: jsonb("distributions").notNull(),
  // Hard constraints, e.g. { dimension, allowedValues } / numeric bounds.
  constraints: jsonb("constraints"),
  // Default sampling configuration (strategy, defaultSampleSize...).
  samplingConfig: jsonb("sampling_config"),
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

export const insertPopulationSchema = createInsertSchema(
  populationsTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertPopulation = z.infer<typeof insertPopulationSchema>;
export type PopulationRow = typeof populationsTable.$inferSelect;
