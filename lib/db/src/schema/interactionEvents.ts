import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { simulationsTable } from "./simulations";

/**
 * InteractionEvent — IMMUTABLE simulation trace. One row per observation,
 * action, utterance, decision, state change or outcome. `stateBefore` /
 * `stateAfter` capture the acting agent's runtime state around the event.
 * The trace is the source of truth for evaluation, replay and analytics —
 * conversation logs are just one projection of it. No update path exists.
 */
export const interactionEventsTable = pgTable(
  "interaction_events",
  {
    id: text("id").primaryKey(),
    simulationId: text("simulation_id")
      .notNull()
      .references(() => simulationsTable.id, { onDelete: "cascade" }),
    /** 0-based sequence within the simulation (total order of the trace). */
    sequence: integer("sequence").notNull(),
    turn: integer("turn").notNull(),
    /** Acting agent id, or "environment" for environment-emitted events. */
    actorId: text("actor_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    stateBefore: jsonb("state_before"),
    stateAfter: jsonb("state_after"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One total order per simulation — duplicate sequence numbers are a bug.
    uniqueIndex("interaction_events_simulation_sequence").on(
      t.simulationId,
      t.sequence,
    ),
    check(
      "interaction_events_type_check",
      sql`${t.type} in ('observation', 'action', 'utterance', 'decision', 'toolCall', 'stateChange', 'outcome')`,
    ),
  ],
);

export const insertInteractionEventSchema = createInsertSchema(
  interactionEventsTable,
).omit({ createdAt: true });
export type InsertInteractionEvent = z.infer<
  typeof insertInteractionEventSchema
>;
export type InteractionEventRow = typeof interactionEventsTable.$inferSelect;
