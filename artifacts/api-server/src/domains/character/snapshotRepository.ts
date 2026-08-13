import { desc, eq, and } from "drizzle-orm";
import {
  db,
  characterSnapshotsTable,
  type CharacterSnapshotRow,
  type InsertCharacterSnapshot,
} from "@workspace/db";

/**
 * Snapshot persistence. Deliberately exposes NO generic update function —
 * snapshots are immutable. The only permitted state transition is
 * usedBySimulation false → true (monotonic), and deletion is only allowed
 * while unused.
 */
export async function insertSnapshot(
  row: InsertCharacterSnapshot,
): Promise<CharacterSnapshotRow> {
  const [inserted] = await db
    .insert(characterSnapshotsTable)
    .values(row)
    .returning();
  if (!inserted) throw new Error("Failed to insert character snapshot");
  return inserted;
}

export async function getSnapshot(
  id: string,
): Promise<CharacterSnapshotRow | undefined> {
  const [row] = await db
    .select()
    .from(characterSnapshotsTable)
    .where(eq(characterSnapshotsTable.id, id));
  return row;
}

export async function listSnapshots(): Promise<CharacterSnapshotRow[]> {
  return db
    .select()
    .from(characterSnapshotsTable)
    .orderBy(desc(characterSnapshotsTable.createdAt));
}

/**
 * The ONLY allowed mutation: mark a snapshot as used by a simulation.
 * Monotonic — there is no way back to unused. Returns the updated row or
 * undefined when the snapshot does not exist.
 */
export async function markSnapshotUsed(
  id: string,
): Promise<CharacterSnapshotRow | undefined> {
  const [updated] = await db
    .update(characterSnapshotsTable)
    .set({ usedBySimulation: true })
    .where(eq(characterSnapshotsTable.id, id))
    .returning();
  return updated;
}

/**
 * Delete only while unused — the WHERE clause makes the immutability
 * guarantee atomic (no read-then-delete race). Returns:
 * - "deleted" when removed,
 * - "used" when the snapshot exists but is protected,
 * - "referenced" when an agent was instantiated from it (FK restrict),
 * - "missing" when it does not exist.
 */
export async function deleteSnapshotIfUnused(
  id: string,
): Promise<"deleted" | "used" | "referenced" | "missing"> {
  try {
    const deleted = await db
      .delete(characterSnapshotsTable)
      .where(
        and(
          eq(characterSnapshotsTable.id, id),
          eq(characterSnapshotsTable.usedBySimulation, false),
        ),
      )
      .returning({ id: characterSnapshotsTable.id });
    if (deleted.length > 0) return "deleted";
  } catch (err) {
    // 23503 = foreign_key_violation: an agent still references the snapshot.
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "23503"
    ) {
      return "referenced";
    }
    if (
      err instanceof Error &&
      err.cause instanceof Error &&
      "code" in err.cause &&
      (err.cause as { code?: string }).code === "23503"
    ) {
      return "referenced";
    }
    throw err;
  }
  const existing = await getSnapshot(id);
  return existing ? "used" : "missing";
}
