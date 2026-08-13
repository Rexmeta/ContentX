import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { characterSnapshotsTable } from "./characterSnapshots";

/**
 * Agent — the runtime actor instantiated from an immutable
 * CharacterSnapshot. Goals and Constraints are first-class (typed JSONB
 * lists); policy/runtimeConfig are extensible payloads. Mutable runtime
 * state lives in agent_states, NEVER here and NEVER in characters.
 */
export const agentsTable = pgTable("agents", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id")
    .notNull()
    .references(() => characterSnapshotsTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  goals: jsonb("goals").notNull(),
  constraints: jsonb("constraints").notNull(),
  policy: jsonb("policy"),
  runtimeConfig: jsonb("runtime_config"),
  memory: jsonb("memory").notNull(),
  provenance: jsonb("provenance").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type AgentRow = typeof agentsTable.$inferSelect;
