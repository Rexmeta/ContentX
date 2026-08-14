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
import { populationsTable } from "./populations";

/**
 * PopulationVersion — immutable snapshot of a population definition at a
 * given version number. Written at creation (v1) and on every update, so a
 * SamplingRun's pinned populationVersion can always be resolved back to the
 * exact definition that produced it (reproducibility invariant).
 */
export const populationVersionsTable = pgTable(
  "population_versions",
  {
    id: text("id").primaryKey(),
    populationId: text("population_id")
      .notNull()
      .references(() => populationsTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    // Full definition snapshot: name, domain, schemaVersion, dimensions,
    // distributions, constraints, samplingConfig, provenance.
    definition: jsonb("definition").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("population_versions_pop_version_idx").on(
      t.populationId,
      t.version,
    ),
  ],
);

export const insertPopulationVersionSchema = createInsertSchema(
  populationVersionsTable,
).omit({ createdAt: true });
export type InsertPopulationVersion = z.infer<
  typeof insertPopulationVersionSchema
>;
export type PopulationVersionRow = typeof populationVersionsTable.$inferSelect;
