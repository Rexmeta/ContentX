import { randomBytes } from "node:crypto";

export type IdPrefix =
  | "content"
  | "entity"
  | "relationship"
  | "event"
  | "narrative"
  | "asset"
  | "projection"
  | "version"
  | "scenario"
  | "category"
  | "dimension"
  | "character"
  | "population"
  | "dependency"
  | "samplingrun"
  | "snapshot"
  | "agent"
  | "agentstate";

/** Stable prefixed identifiers. Never use array indexes as identity. */
export function newId(prefix: IdPrefix): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}
