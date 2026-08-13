import {
  pgTable,
  text,
  integer,
  jsonb,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { charactersTable } from "./characters";

/**
 * CharacterSnapshot — IMMUTABLE record of exactly what an agent was
 * instantiated from. There is deliberately NO updatedAt column and no
 * update path anywhere in the codebase: once written, a snapshot never
 * changes. `usedBySimulation` may only flip false → true (single
 * monotonic transition, enforced in the repository), after which even
 * deletion is forbidden.
 */
export const characterSnapshotsTable = pgTable("character_snapshots", {
  id: text("id").primaryKey(),
  characterId: text("character_id")
    .notNull()
    .references(() => charactersTable.id, { onDelete: "restrict" }),
  // Sampling lineage copied from character provenance at snapshot time —
  // kept denormalized so the snapshot stays self-contained even if the
  // population is later deleted.
  populationId: text("population_id"),
  schemaVersion: text("schema_version").notNull(),
  dependencyGraphVersion: text("dependency_graph_version"),
  seed: integer("seed"),
  // Fully resolved attribute groups at snapshot time (deep copy).
  resolvedAttributes: jsonb("resolved_attributes").notNull(),
  // Behavioral profile derived from psychological/behavioral groups.
  behavioralProfile: jsonb("behavioral_profile").notNull(),
  provenance: jsonb("provenance").notNull(),
  usedBySimulation: boolean("used_by_simulation").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCharacterSnapshotSchema = createInsertSchema(
  characterSnapshotsTable,
).omit({ createdAt: true });
export type InsertCharacterSnapshot = z.infer<
  typeof insertCharacterSnapshotSchema
>;
export type CharacterSnapshotRow = typeof characterSnapshotsTable.$inferSelect;
