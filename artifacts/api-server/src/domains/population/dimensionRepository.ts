import { asc, eq } from "drizzle-orm";
import { db, dimensionsTable, type DimensionRow } from "@workspace/db";

/** Persistence boundary for the dimension registry. */

export async function listDimensions(): Promise<DimensionRow[]> {
  return db
    .select()
    .from(dimensionsTable)
    .orderBy(asc(dimensionsTable.category), asc(dimensionsTable.name));
}

export async function getDimensionByName(
  name: string,
): Promise<DimensionRow | undefined> {
  const [row] = await db
    .select()
    .from(dimensionsTable)
    .where(eq(dimensionsTable.name, name));
  return row;
}

/**
 * Atomic insert: ON CONFLICT (name) DO NOTHING. Returns the inserted row,
 * or undefined when the name is already registered.
 */
export async function insertDimensionReturningIfAbsent(row: {
  id: string;
  name: string;
  category: string;
  dataType: string;
  allowedValues: string[] | null;
  source: string;
  version: number;
  description: string | null;
}): Promise<DimensionRow | undefined> {
  const [inserted] = await db
    .insert(dimensionsTable)
    .values(row)
    .onConflictDoNothing({ target: dimensionsTable.name })
    .returning();
  return inserted;
}

/** Insert if absent (by unique name); returns nothing on conflict. */
export async function insertDimensionIfAbsent(row: {
  id: string;
  name: string;
  category: string;
  dataType: string;
  allowedValues: string[] | null;
  source: string;
  version: number;
  description: string | null;
}): Promise<void> {
  await db.insert(dimensionsTable).values(row).onConflictDoNothing({
    target: dimensionsTable.name,
  });
}
