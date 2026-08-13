import { asc, desc, eq } from "drizzle-orm";
import {
  db,
  populationsTable,
  dependencyRulesTable,
  samplingRunsTable,
  charactersTable,
  type PopulationRow,
  type DependencyRuleRow,
  type SamplingRunRow,
  type InsertPopulation,
  type InsertDependencyRule,
  type InsertSamplingRun,
  type InsertCharacter,
} from "@workspace/db";

/** Persistence boundary for populations, dependency rules, sampling audit. */

export async function listPopulations(): Promise<PopulationRow[]> {
  return db
    .select()
    .from(populationsTable)
    .orderBy(desc(populationsTable.updatedAt));
}

export async function getPopulation(
  id: string,
): Promise<PopulationRow | undefined> {
  const [row] = await db
    .select()
    .from(populationsTable)
    .where(eq(populationsTable.id, id));
  return row;
}

export async function insertPopulation(
  row: InsertPopulation,
): Promise<PopulationRow> {
  const [inserted] = await db
    .insert(populationsTable)
    .values(row)
    .returning();
  if (!inserted) throw new Error("Failed to insert population");
  return inserted;
}

export async function deletePopulation(id: string): Promise<boolean> {
  const deleted = await db
    .delete(populationsTable)
    .where(eq(populationsTable.id, id))
    .returning({ id: populationsTable.id });
  return deleted.length > 0;
}

export async function listRulesForPopulation(
  populationId: string,
): Promise<DependencyRuleRow[]> {
  return db
    .select()
    .from(dependencyRulesTable)
    .where(eq(dependencyRulesTable.populationId, populationId))
    .orderBy(asc(dependencyRulesTable.createdAt), asc(dependencyRulesTable.id));
}

export async function insertRule(
  row: InsertDependencyRule,
): Promise<DependencyRuleRow> {
  const [inserted] = await db
    .insert(dependencyRulesTable)
    .values(row)
    .returning();
  if (!inserted) throw new Error("Failed to insert dependency rule");
  return inserted;
}

export async function deleteRule(id: string): Promise<boolean> {
  const deleted = await db
    .delete(dependencyRulesTable)
    .where(eq(dependencyRulesTable.id, id))
    .returning({ id: dependencyRulesTable.id });
  return deleted.length > 0;
}

/**
 * Atomic write of one sampling run: all sampled characters + the audit
 * record commit together or not at all (no orphan characters, no
 * characters without audit).
 */
export async function insertSamplingRunWithCharacters(
  characters: InsertCharacter[],
  run: InsertSamplingRun,
): Promise<SamplingRunRow> {
  return db.transaction(async (tx) => {
    if (characters.length > 0) {
      await tx.insert(charactersTable).values(characters);
    }
    const [inserted] = await tx
      .insert(samplingRunsTable)
      .values(run)
      .returning();
    if (!inserted) throw new Error("Failed to insert sampling run");
    return inserted;
  });
}

/**
 * Serialized rule creation: locks the population row (SELECT ... FOR
 * UPDATE), re-reads the rule set inside the transaction, runs the given
 * cycle check, then inserts — concurrent creations cannot commit a cycle.
 */
export async function insertRuleSerialized(
  row: InsertDependencyRule,
  cycleCheck: (existing: DependencyRuleRow[]) => void,
): Promise<DependencyRuleRow> {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: populationsTable.id })
      .from(populationsTable)
      .where(eq(populationsTable.id, row.populationId))
      .for("update");
    const existing = await tx
      .select()
      .from(dependencyRulesTable)
      .where(eq(dependencyRulesTable.populationId, row.populationId))
      .orderBy(
        asc(dependencyRulesTable.createdAt),
        asc(dependencyRulesTable.id),
      );
    cycleCheck(existing);
    const [inserted] = await tx
      .insert(dependencyRulesTable)
      .values(row)
      .returning();
    if (!inserted) throw new Error("Failed to insert dependency rule");
    return inserted;
  });
}

export async function getSamplingRun(
  id: string,
): Promise<SamplingRunRow | undefined> {
  const [row] = await db
    .select()
    .from(samplingRunsTable)
    .where(eq(samplingRunsTable.id, id));
  return row;
}

export async function listSamplingRuns(
  populationId: string,
): Promise<SamplingRunRow[]> {
  return db
    .select()
    .from(samplingRunsTable)
    .where(eq(samplingRunsTable.populationId, populationId))
    .orderBy(desc(samplingRunsTable.createdAt));
}
