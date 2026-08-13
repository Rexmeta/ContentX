/**
 * Character domain model — a first-class canonical record built on top of
 * the Entity concept (kind "person"/"character").
 *
 * Persona note (binding decision): Persona is NOT a separate identity model.
 * A "persona" is always a representation of Character + behavioral profile
 * (the behavioral/psychological attribute groups). There is never a parallel
 * persona identity system.
 *
 * MBTI and similar typologies are allowed only as DERIVED classifications
 * (`derivedClassifications`), never as core attributes.
 */

export const ATTRIBUTE_GROUPS = [
  "identity",
  "professional",
  "psychological",
  "behavioral",
  "capabilities",
  "preferences",
  "goals",
  "constraints",
] as const;

export type AttributeGroup = (typeof ATTRIBUTE_GROUPS)[number];

/** Dimension-keyed attribute map for one group. */
export type AttributeMap = Record<string, unknown>;

export interface CharacterAttributes {
  identity?: AttributeMap;
  professional?: AttributeMap;
  psychological?: AttributeMap;
  behavioral?: AttributeMap;
  capabilities?: AttributeMap;
  preferences?: AttributeMap;
  /** Free-form goal statements. */
  goals?: string[];
  /** Free-form constraint statements. */
  constraints?: string[];
}

export interface CharacterProvenance {
  operation: string;
  createdAt: string;
  sourceType?: string | null;
  populationId?: string | null;
  seed?: number | null;
  populationVersion?: number | null;
  schemaVersion?: string | null;
  dependencyGraphVersion?: string | null;
  sampleIndex?: number | null;
  strategy?: string | null;
  generatedByProvider?: string | null;
  generatedByModel?: string | null;
}

export interface Character {
  id: string;
  name: string;
  canonicalName?: string | null;
  aliases?: string[];
  attributes: CharacterAttributes;
  /** Derived typologies only, e.g. { mbti: "INTJ" }. Never core attributes. */
  derivedClassifications?: Record<string, string> | null;
  provenance: CharacterProvenance;
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;
}

export const CHARACTER_SCHEMA_VERSION = "1";
