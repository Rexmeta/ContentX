import { desc, eq, asc } from "drizzle-orm";
import {
  db,
  contentsTable,
  contentVersionsTable,
  type ContentRow,
  type ContentVersionRow,
} from "@workspace/db";
import type { GraphPayload } from "./model";

/**
 * Persistence boundary for canonical content. All DB access for the content
 * domain goes through this repository so storage can evolve (e.g. a future
 * graph projection) without touching domain logic.
 */

export async function listContents(): Promise<ContentRow[]> {
  return db.select().from(contentsTable).orderBy(desc(contentsTable.updatedAt));
}

export async function getContent(id: string): Promise<ContentRow | undefined> {
  const [row] = await db
    .select()
    .from(contentsTable)
    .where(eq(contentsTable.id, id));
  return row;
}

/**
 * Atomically insert a content row plus its initial version snapshot.
 */
export async function insertContentWithInitialVersion(
  row: {
    id: string;
    title: string;
    sourcePrompt: string | null;
    version: number;
    graph: GraphPayload;
  },
  versionRow: {
    id: string;
    version: number;
    parentVersion: number | null;
    note: string | null;
    author: string | null;
  },
): Promise<ContentRow> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx.insert(contentsTable).values(row).returning();
    await tx.insert(contentVersionsTable).values({
      ...versionRow,
      contentId: row.id,
      snapshot: row.graph,
    });
    return inserted!;
  });
}

/**
 * Atomically read-modify-write the graph under SELECT ... FOR UPDATE so
 * concurrent PATCHes serialize instead of overwriting each other.
 * The mutator returns the new payload, or an error string to abort.
 */
export async function mutateGraph(
  id: string,
  mutator: (graph: GraphPayload) => GraphPayload | { error: string } | null,
): Promise<ContentRow | null | { error: string }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(contentsTable)
      .where(eq(contentsTable.id, id))
      .for("update");
    if (!row) return null;
    const result = mutator(row.graph as unknown as GraphPayload);
    if (result === null) return null;
    if ("error" in result && typeof result.error === "string") {
      return result as { error: string };
    }
    const [updated] = await tx
      .update(contentsTable)
      .set({ graph: result as GraphPayload })
      .where(eq(contentsTable.id, id))
      .returning();
    return updated ?? null;
  });
}

export async function deleteContent(id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx
      .delete(contentVersionsTable)
      .where(eq(contentVersionsTable.contentId, id));
    const [deleted] = await tx
      .delete(contentsTable)
      .where(eq(contentsTable.id, id))
      .returning();
    return Boolean(deleted);
  });
}

export async function listVersions(
  contentId: string,
): Promise<ContentVersionRow[]> {
  return db
    .select()
    .from(contentVersionsTable)
    .where(eq(contentVersionsTable.contentId, contentId))
    .orderBy(asc(contentVersionsTable.version));
}

/**
 * Atomically snapshot the current graph as the next version and bump the
 * content's version counter. Uses SELECT ... FOR UPDATE so concurrent
 * snapshots serialize and cannot derive the same version number (also
 * guarded by the unique (content_id, version) index).
 */
export async function snapshotNextVersion(input: {
  contentId: string;
  versionId: string;
  note: string | null;
  author: string | null;
}): Promise<{ version: ContentVersionRow; snapshot: GraphPayload } | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(contentsTable)
      .where(eq(contentsTable.id, input.contentId))
      .for("update");
    if (!row) return null;
    const snapshot = row.graph as unknown as GraphPayload;
    const nextVersion = row.version + 1;
    const [version] = await tx
      .insert(contentVersionsTable)
      .values({
        id: input.versionId,
        contentId: input.contentId,
        version: nextVersion,
        parentVersion: row.version,
        note: input.note,
        author: input.author,
        snapshot,
      })
      .returning();
    await tx
      .update(contentsTable)
      .set({ version: nextVersion })
      .where(eq(contentsTable.id, input.contentId));
    return { version: version!, snapshot };
  });
}

export async function countAll(): Promise<{
  contents: ContentRow[];
  versions: ContentVersionRow[];
}> {
  const contents = await listContents();
  const versions = await db.select().from(contentVersionsTable);
  return { contents, versions };
}
