import { newId } from "../../shared/id";
import type { CharacterRow } from "@workspace/db";
import * as dimensionService from "../population/dimensionService";
import type { Dimension } from "../population/dimensionModel";
import {
  validateCharacterAttributes,
  validateDerivedClassifications,
  InvalidCharacterError,
} from "./attributeValidator";
import {
  CHARACTER_SCHEMA_VERSION,
  type Character,
  type CharacterAttributes,
  type CharacterProvenance,
} from "./model";
import * as repo from "./repository";

export { InvalidCharacterError };

export function toCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    name: row.name,
    canonicalName: row.canonicalName ?? null,
    aliases: (row.aliases as string[] | null) ?? [],
    attributes: (row.attributes as CharacterAttributes) ?? {},
    derivedClassifications:
      (row.derivedClassifications as Record<string, string> | null) ?? null,
    provenance: row.provenance as CharacterProvenance,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function dimensionIndex(): Promise<Map<string, Dimension>> {
  const dims = await dimensionService.listDimensions();
  return new Map(dims.map((d) => [d.name, d]));
}

function checkIdentityFields(input: {
  name?: string;
  aliases?: string[] | null;
}): void {
  if (input.name !== undefined && input.name.trim() === "") {
    throw new InvalidCharacterError("Character name must not be empty.");
  }
  if (input.aliases?.some((a) => !a || a.trim() === "")) {
    throw new InvalidCharacterError("Aliases must be non-empty strings.");
  }
}

export async function createCharacter(input: {
  name: string;
  canonicalName?: string | null;
  aliases?: string[];
  attributes?: CharacterAttributes;
  derivedClassifications?: Record<string, string> | null;
}): Promise<Character> {
  checkIdentityFields(input);
  const attributes = input.attributes ?? {};
  validateCharacterAttributes(attributes, await dimensionIndex());
  validateDerivedClassifications(input.derivedClassifications);

  const provenance: CharacterProvenance = {
    operation: "create",
    createdAt: new Date().toISOString(),
    sourceType: "manual",
  };
  const row = await repo.insertCharacter({
    id: newId("character"),
    name: input.name.trim(),
    canonicalName: input.canonicalName?.trim() || null,
    aliases: input.aliases ?? null,
    attributes,
    derivedClassifications: input.derivedClassifications ?? null,
    provenance,
    schemaVersion: CHARACTER_SCHEMA_VERSION,
  });
  return toCharacter(row);
}

/**
 * Build (and fully validate) a character insert row from a population
 * sample WITHOUT writing it — the population domain commits sampled
 * characters and the sampling audit in one transaction. Provenance records
 * populationId/seed/versions for reproducibility.
 */
export async function buildSampledCharacterRow(input: {
  name: string;
  attributes: CharacterAttributes;
  provenance: CharacterProvenance;
}): Promise<{
  id: string;
  name: string;
  canonicalName: null;
  aliases: null;
  attributes: CharacterAttributes;
  derivedClassifications: null;
  provenance: CharacterProvenance;
  schemaVersion: string;
}> {
  checkIdentityFields(input);
  validateCharacterAttributes(input.attributes, await dimensionIndex());
  return {
    id: newId("character"),
    name: input.name.trim(),
    canonicalName: null,
    aliases: null,
    attributes: input.attributes,
    derivedClassifications: null,
    provenance: input.provenance,
    schemaVersion: CHARACTER_SCHEMA_VERSION,
  };
}

export async function updateCharacter(
  id: string,
  patch: {
    name?: string;
    canonicalName?: string | null;
    aliases?: string[];
    attributes?: CharacterAttributes;
    derivedClassifications?: Record<string, string> | null;
  },
): Promise<Character | null> {
  checkIdentityFields(patch);
  if (patch.attributes !== undefined) {
    validateCharacterAttributes(patch.attributes, await dimensionIndex());
  }
  validateDerivedClassifications(patch.derivedClassifications);

  const updated = await repo.updateCharacter(id, {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.canonicalName !== undefined
      ? { canonicalName: patch.canonicalName?.trim() || null }
      : {}),
    ...(patch.aliases !== undefined ? { aliases: patch.aliases } : {}),
    ...(patch.attributes !== undefined ? { attributes: patch.attributes } : {}),
    ...(patch.derivedClassifications !== undefined
      ? { derivedClassifications: patch.derivedClassifications }
      : {}),
  });
  return updated ? toCharacter(updated) : null;
}

export async function listCharacters(): Promise<Character[]> {
  return (await repo.listCharacters()).map(toCharacter);
}

export async function getCharacter(id: string): Promise<Character | null> {
  const row = await repo.getCharacter(id);
  return row ? toCharacter(row) : null;
}

export async function deleteCharacter(id: string): Promise<boolean> {
  return repo.deleteCharacter(id);
}
