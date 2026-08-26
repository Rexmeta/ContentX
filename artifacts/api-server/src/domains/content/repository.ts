import { desc, eq, asc, sql, and } from "drizzle-orm";
import {
  db,
  contentsTable,
  contentVersionsTable,
  populationsTable,
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
 * Find the most recently updated content graph whose canonical provenance
 * points at the given source (e.g. sourceType "matraix" + the dataset's
 * source.uri). Used by importers to detect re-imports of the same dataset.
 */
export async function findByProvenanceSource(
  sourceType: string,
  sourceUri: string,
): Promise<ContentRow | undefined> {
  const [row] = await db
    .select()
    .from(contentsTable)
    .where(
      and(
        sql`${contentsTable.graph} -> 'provenance' ->> 'sourceType' = ${sourceType}`,
        sql`${contentsTable.graph} -> 'provenance' ->> 'sourceUri' = ${sourceUri}`,
      ),
    )
    .orderBy(desc(contentsTable.updatedAt))
    .limit(1);
  return row;
}

/**
 * Atomically commit an imported graph for a given source identity: either
 * update the existing graph for that source as a new version, or insert a
 * brand-new content row — decided INSIDE one transaction.
 *
 * The lookup and the write are guarded by a transaction-scoped advisory lock
 * keyed on (sourceType, sourceUri), because `contents` has no unique
 * constraint on the JSONB provenance and a plain lookup-then-insert would
 * let two simultaneous first imports of the same source both see "no
 * existing row" and create duplicates. The advisory lock serializes the
 * whole decide-and-write step; the row is additionally SELECT ... FOR UPDATE
 * locked so concurrent non-import writers (PATCH/snapshot) serialize too.
 *
 * `previous` is the actual locked predecessor row state (id/version/graph at
 * the moment of replacement), so callers can compute an accurate diff.
 */
export async function upsertContentBySource(input: {
  sourceType: string;
  sourceUri: string;
  content: {
    id: string;
    title: string;
    sourcePrompt: string | null;
    graph: GraphPayload;
  };
  versionId: string;
  insertNote: string | null;
  updateNote: string | null;
  author: string | null;
  /** Only override the existing title when explicitly provided. */
  overrideTitle?: string | undefined;
}): Promise<{
  row: ContentRow;
  previous: { id: string; version: number; graph: GraphPayload } | null;
}> {
  return db.transaction(async (tx) => {
    await tx.execute(
      // NB: PostgreSQL text cannot contain NUL bytes, so a printable
      // separator is used for the lock key.
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`import-source:${input.sourceType}:${input.sourceUri}`}, 0))`,
    );
    const [existing] = await tx
      .select()
      .from(contentsTable)
      .where(
        and(
          sql`${contentsTable.graph} -> 'provenance' ->> 'sourceType' = ${input.sourceType}`,
          sql`${contentsTable.graph} -> 'provenance' ->> 'sourceUri' = ${input.sourceUri}`,
        ),
      )
      .orderBy(desc(contentsTable.updatedAt))
      .limit(1)
      .for("update");

    if (!existing) {
      const [inserted] = await tx
        .insert(contentsTable)
        .values({ ...input.content, version: 1 })
        .returning();
      await tx.insert(contentVersionsTable).values({
        id: input.versionId,
        contentId: input.content.id,
        version: 1,
        parentVersion: null,
        note: input.insertNote,
        author: input.author,
        snapshot: input.content.graph,
      });
      return { row: inserted!, previous: null };
    }

    const nextVersion = existing.version + 1;
    await tx.insert(contentVersionsTable).values({
      id: input.versionId,
      contentId: existing.id,
      version: nextVersion,
      parentVersion: existing.version,
      note: input.updateNote,
      author: input.author,
      snapshot: input.content.graph,
    });
    const [updated] = await tx
      .update(contentsTable)
      .set({
        graph: input.content.graph,
        version: nextVersion,
        ...(input.overrideTitle ? { title: input.overrideTitle } : {}),
      })
      .where(eq(contentsTable.id, existing.id))
      .returning();
    return {
      row: updated!,
      previous: {
        id: existing.id,
        version: existing.version,
        graph: existing.graph as unknown as GraphPayload,
      },
    };
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

/**
 * Thrown when content cannot be deleted because downstream domain rows
 * (e.g. populations bridged from a MatrAIx import) still reference it as
 * their provenance source. Deleting it would silently break lineage.
 */
export class ContentReferencedError extends Error {
  constructor(id: string, referencedBy: string) {
    super(
      `Content "${id}" cannot be deleted: it is still referenced as provenance by ${referencedBy}.`,
    );
    this.name = "ContentReferencedError";
  }
}

/**
 * Serialize content deletion against bridge creation (import → population).
 * Both sides take this advisory xact lock so a delete cannot slip between
 * the bridge's content read and its provenance-row commit.
 */
export function lineageLockSql(contentId: string) {
  return sql`SELECT pg_advisory_xact_lock(hashtext(${`content-lineage:${contentId}`}))`;
}

export async function deleteContent(id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(lineageLockSql(id));
    const [referencing] = await tx
      .select({ id: populationsTable.id })
      .from(populationsTable)
      .where(sql`${populationsTable.provenance}->>'importId' = ${id}`)
      .limit(1);
    if (referencing) {
      throw new ContentReferencedError(id, `population "${referencing.id}"`);
    }
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

export async function getVersion(
  contentId: string,
  version: number,
): Promise<ContentVersionRow | undefined> {
  const [row] = await db
    .select()
    .from(contentVersionsTable)
    .where(
      and(
        eq(contentVersionsTable.contentId, contentId),
        eq(contentVersionsTable.version, version),
      ),
    );
  return row;
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
