import { desc, eq } from "drizzle-orm";
import {
  db,
  evaluationsTable,
  type EvaluationRow,
  type InsertEvaluation,
} from "@workspace/db";

/** Evaluations for one simulation commit together — a partial evaluation
 *  set (behavior without outcome) is not a valid result. */
export async function insertEvaluations(
  rows: InsertEvaluation[],
): Promise<EvaluationRow[]> {
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(evaluationsTable).values(rows).returning();
    if (inserted.length !== rows.length) {
      throw new Error("Failed to persist the full evaluation set");
    }
    return inserted;
  });
}

export async function getEvaluation(
  id: string,
): Promise<EvaluationRow | undefined> {
  const [row] = await db
    .select()
    .from(evaluationsTable)
    .where(eq(evaluationsTable.id, id));
  return row;
}

export async function listEvaluations(
  simulationId?: string,
): Promise<EvaluationRow[]> {
  const query = db.select().from(evaluationsTable);
  if (simulationId) {
    return query
      .where(eq(evaluationsTable.simulationId, simulationId))
      .orderBy(desc(evaluationsTable.createdAt));
  }
  return query.orderBy(desc(evaluationsTable.createdAt));
}
