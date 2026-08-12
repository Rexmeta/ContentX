import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Persisted dramatic scenarios — first-class assets of the scenario engine.
 * The scenario column stores the full DramaticScenario JSON; idea keeps the
 * original raw input for provenance and re-amplification.
 */
export const scenariosTable = pgTable("scenarios", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  idea: text("idea").notNull(),
  scenario: jsonb("scenario").notNull(),
  // Classification (domain/conflictType/tone/tags) — null = unclassified.
  classification: jsonb("classification"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertScenarioSchema = createInsertSchema(scenariosTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertScenario = z.infer<typeof insertScenarioSchema>;
export type ScenarioRow = typeof scenariosTable.$inferSelect;
