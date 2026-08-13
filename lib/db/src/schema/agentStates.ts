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
import { agentsTable } from "./agents";

/**
 * AgentState — MUTABLE runtime state, one row per (agent, category).
 * Categories: affective / relational / motivational / cognitive /
 * behavioral. Values are dimension-keyed numbers in [0, 1]
 * (e.g. trust/stress/rapport/cooperativeness). State changes bump
 * `version` and are NEVER written back to the canonical character.
 */
export const agentStatesTable = pgTable(
  "agent_states",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id")
      .notNull()
      .references(() => agentsTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    values: jsonb("values").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("agent_states_agent_category").on(t.agentId, t.category),
    // Durable invariant: only the five runtime state categories exist.
    check(
      "agent_states_category_check",
      sql`${t.category} in ('affective', 'relational', 'motivational', 'cognitive', 'behavioral')`,
    ),
  ],
);

export const insertAgentStateSchema = createInsertSchema(agentStatesTable).omit(
  { createdAt: true, updatedAt: true },
);
export type InsertAgentState = z.infer<typeof insertAgentStateSchema>;
export type AgentStateRow = typeof agentStatesTable.$inferSelect;
