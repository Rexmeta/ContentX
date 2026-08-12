/**
 * Canonical Content Model — platform independent.
 * These types mirror the JSON Schemas in docs/schema/ and the OpenAPI contract.
 * No platform-specific (e.g. RoleplayX) fields are allowed here.
 */

export const ENTITY_KINDS = [
  "character",
  "organization",
  "location",
  "object",
  "event",
  "concept",
  "theme",
  "goal",
  "conflict",
  "emotion",
  "action",
  "dialogue",
  "narrative",
  "rule",
  "constraint",
  "outcome",
  "world",
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface Entity {
  id: string;
  kind: string;
  name: string;
  description?: string | null;
  attributes?: Record<string, unknown>;
}

export interface Relationship {
  id: string;
  source: string;
  type: string;
  target: string;
  attributes?: Record<string, unknown>;
}

export interface Provenance {
  operation: string;
  createdAt: string;
  sourceType?: string | null;
  sourceUri?: string | null;
  sourceTitle?: string | null;
  sourceContentIds?: string[];
  generatedByProvider?: string | null;
  generatedByModel?: string | null;
  lineage?: import("../scenario/synthesizer").Lineage | null;
}

/** The graph payload persisted as JSONB (without DB metadata). */
export interface GraphPayload {
  entities: Entity[];
  relationships: Relationship[];
  provenance?: Provenance;
}

/** Full canonical content graph as exposed by the API. */
export interface ContentGraph extends GraphPayload {
  id: string;
  title: string;
  sourcePrompt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
