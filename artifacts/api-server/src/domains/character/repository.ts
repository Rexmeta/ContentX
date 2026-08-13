import { desc, eq } from "drizzle-orm";
import { db, charactersTable, type CharacterRow } from "@workspace/db";
import type { CharacterAttributes, CharacterProvenance } from "./model";

/** Persistence boundary for canonical characters. */

export async function listCharacters(): Promise<CharacterRow[]> {
  return db
    .select()
    .from(charactersTable)
    .orderBy(desc(charactersTable.updatedAt));
}

export async function getCharacter(
  id: string,
): Promise<CharacterRow | undefined> {
  const [row] = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.id, id));
  return row;
}

export async function insertCharacter(row: {
  id: string;
  name: string;
  canonicalName: string | null;
  aliases: string[] | null;
  attributes: CharacterAttributes;
  derivedClassifications: Record<string, string> | null;
  provenance: CharacterProvenance;
  schemaVersion: string;
}): Promise<CharacterRow> {
  const [inserted] = await db.insert(charactersTable).values(row).returning();
  if (!inserted) throw new Error("Failed to insert character");
  return inserted;
}

export async function updateCharacter(
  id: string,
  patch: {
    name?: string;
    canonicalName?: string | null;
    aliases?: string[] | null;
    attributes?: CharacterAttributes;
    derivedClassifications?: Record<string, string> | null;
  },
): Promise<CharacterRow | undefined> {
  const [updated] = await db
    .update(charactersTable)
    .set(patch)
    .where(eq(charactersTable.id, id))
    .returning();
  return updated;
}

export async function deleteCharacter(id: string): Promise<boolean> {
  const deleted = await db
    .delete(charactersTable)
    .where(eq(charactersTable.id, id))
    .returning({ id: charactersTable.id });
  return deleted.length > 0;
}
