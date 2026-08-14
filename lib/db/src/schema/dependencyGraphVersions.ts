import {
  pgTable,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { populationsTable } from "./populations";

/**
 * DependencyGraphVersion — immutable snapshot of a population's FULL rule
 * set, keyed by the deterministic digest recorded as
 * SamplingRun.dependencyGraphVersion. The digest alone cannot be inverted,
 * so the snapshot is upserted on every rule mutation and at sampling time,
 * guaranteeing every pinned run's graph is restorable.
 */
export const dependencyGraphVersionsTable = pgTable(
  "dependency_graph_versions",
  {
    id: text("id").primaryKey(),
    populationId: text("population_id")
      .notNull()
      .references(() => populationsTable.id, { onDelete: "cascade" }),
    // Digest of sorted ruleId:version pairs ("empty" for no rules).
    graphVersion: text("graph_version").notNull(),
    // Full array of rule definitions (DependencyRule shape) in stable order.
    rules: jsonb("rules").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("dependency_graph_versions_pop_graph_idx").on(
      t.populationId,
      t.graphVersion,
    ),
  ],
);

export const insertDependencyGraphVersionSchema = createInsertSchema(
  dependencyGraphVersionsTable,
).omit({ createdAt: true });
export type InsertDependencyGraphVersion = z.infer<
  typeof insertDependencyGraphVersionSchema
>;
export type DependencyGraphVersionRow =
  typeof dependencyGraphVersionsTable.$inferSelect;
