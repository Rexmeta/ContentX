import {
  pgTable,
  text,
  jsonb,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { simulationsTable } from "./simulations";

/**
 * Evaluation — trace-derived assessment of a simulation. `kind` separates
 * evaluation families; `subjectType`/`subjectId` distinguish AGENT
 * evaluations (behavior, persona fidelity) from SIMULATION-level ones
 * (outcome). Learner evaluations are a separate future subjectType — the
 * abstraction never conflates the two.
 */
export const evaluationsTable = pgTable(
  "evaluations",
  {
    id: text("id").primaryKey(),
    simulationId: text("simulation_id")
      .notNull()
      .references(() => simulationsTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    subjectType: text("subject_type").notNull(),
    /** Agent id for agent-subject evaluations; simulation id otherwise. */
    subjectId: text("subject_id").notNull(),
    /** Named numeric scores in [0, 1] (e.g. fidelityScore). */
    scores: jsonb("scores").notNull(),
    /** Structured findings backing the scores (evidence from the trace). */
    findings: jsonb("findings").notNull(),
    provenance: jsonb("provenance").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("evaluations_simulation").on(t.simulationId),
    check(
      "evaluations_kind_check",
      sql`${t.kind} in ('behavior', 'personaFidelity', 'outcome')`,
    ),
    check(
      "evaluations_subject_type_check",
      sql`${t.subjectType} in ('agent', 'simulation')`,
    ),
  ],
);

export const insertEvaluationSchema = createInsertSchema(
  evaluationsTable,
).omit({ createdAt: true });
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type EvaluationRow = typeof evaluationsTable.$inferSelect;
