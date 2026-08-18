import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Outcome-first workflows: an AI-recommended, user-adjusted plan of steps
 * that bind to existing engine APIs. Steps / intent / artifacts are stored
 * as JSONB — their shapes are owned by the api contract (OpenAPI) and the
 * workflow domain layer, not by the DB.
 */
export const workflowsTable = pgTable("workflows", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  /** OutputIntent: { outputType, description, extractedInputs } */
  intent: jsonb("intent").notNull(),
  /** WorkflowStep[] — id/type/title/importance/status/dependencies/binding/result */
  steps: jsonb("steps").notNull(),
  /** artifact key → resource id (scenarioId, contentId, simulationId, …) */
  artifacts: jsonb("artifacts").notNull().default({}),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertWorkflowSchema = createInsertSchema(workflowsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type WorkflowRow = typeof workflowsTable.$inferSelect;
