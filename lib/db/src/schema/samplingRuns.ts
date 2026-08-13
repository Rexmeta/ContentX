import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { populationsTable } from "./populations";

/**
 * Sampling audit — one row per samplePopulation call. Reproducibility:
 * populationVersion + schemaVersion + dependencyGraphVersion + seed fully
 * determine the sample; requested vs achieved distribution are stored.
 */
export const samplingRunsTable = pgTable("sampling_runs", {
  id: text("id").primaryKey(),
  populationId: text("population_id")
    .notNull()
    .references(() => populationsTable.id, { onDelete: "cascade" }),
  seed: integer("seed").notNull(),
  strategy: text("strategy").notNull(),
  sampleSize: integer("sample_size").notNull(),
  constraints: jsonb("constraints"),
  targetDistribution: jsonb("target_distribution"),
  requestedDistribution: jsonb("requested_distribution").notNull(),
  achievedDistribution: jsonb("achieved_distribution").notNull(),
  characterIds: jsonb("character_ids").notNull(),
  populationVersion: integer("population_version").notNull(),
  schemaVersion: text("schema_version").notNull(),
  dependencyGraphVersion: text("dependency_graph_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSamplingRunSchema = createInsertSchema(
  samplingRunsTable,
).omit({ createdAt: true });
export type InsertSamplingRun = z.infer<typeof insertSamplingRunSchema>;
export type SamplingRunRow = typeof samplingRunsTable.$inferSelect;
