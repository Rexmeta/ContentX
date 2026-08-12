import { desc, eq } from "drizzle-orm";
import { db, scenariosTable, type ScenarioRow } from "@workspace/db";
import type { DramaticScenario } from "../ai/scenarioAmplifier";

/** Persistence boundary for the scenario library. */

export async function listScenarios(): Promise<ScenarioRow[]> {
  return db
    .select()
    .from(scenariosTable)
    .orderBy(desc(scenariosTable.updatedAt));
}

export async function getScenario(
  id: string,
): Promise<ScenarioRow | undefined> {
  const [row] = await db
    .select()
    .from(scenariosTable)
    .where(eq(scenariosTable.id, id));
  return row;
}

export async function insertScenario(row: {
  id: string;
  title: string;
  idea: string;
  scenario: DramaticScenario;
}): Promise<ScenarioRow> {
  const [inserted] = await db.insert(scenariosTable).values(row).returning();
  if (!inserted) throw new Error("Failed to insert scenario");
  return inserted;
}

export async function updateScenario(
  id: string,
  patch: { title: string; scenario: DramaticScenario },
): Promise<ScenarioRow | undefined> {
  const [updated] = await db
    .update(scenariosTable)
    .set(patch)
    .where(eq(scenariosTable.id, id))
    .returning();
  return updated;
}

export async function deleteScenario(id: string): Promise<boolean> {
  const deleted = await db
    .delete(scenariosTable)
    .where(eq(scenariosTable.id, id))
    .returning({ id: scenariosTable.id });
  return deleted.length > 0;
}
