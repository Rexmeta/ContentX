import {
  pgTable,
  text,
  integer,
  jsonb,
  doublePrecision,
  timestamp,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Simulation — a run of agents inside an Environment. Records the full
 * reproducibility envelope: seed, environment type + config, participating
 * agents (with their snapshot ids), status and final outcome. The trace
 * lives in `interaction_events`; results are immutable once completed.
 */
export const simulationsTable = pgTable(
  "simulations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    environmentType: text("environment_type").notNull(),
    /** Environment configuration (topic, maxTurns, policy, …). */
    config: jsonb("config").notNull(),
    /** Participants: [{agentId, snapshotId, role}] — resolved at start. */
    participants: jsonb("participants").notNull(),
    seed: doublePrecision("seed").notNull(),
    status: text("status").notNull(),
    turnsExecuted: integer("turns_executed").notNull().default(0),
    /** Final environment outcome (null until completed). */
    outcome: jsonb("outcome"),
    /** Explicit failure reason when status = failed. */
    error: text("error"),
    provenance: jsonb("provenance").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "simulations_status_check",
      sql`${t.status} in ('completed', 'failed')`,
    ),
  ],
);

export const insertSimulationSchema = createInsertSchema(
  simulationsTable,
).omit({ createdAt: true });
export type InsertSimulation = z.infer<typeof insertSimulationSchema>;
export type SimulationRow = typeof simulationsTable.$inferSelect;
