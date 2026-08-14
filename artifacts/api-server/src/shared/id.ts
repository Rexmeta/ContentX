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
  | "populationversion"
  | "depgraph"
  | "snapshot"
  | "agent"
  | "agentstate"
  | "simulation"
  | "interaction"
  | "evaluation";

/** Stable prefixed identifiers. Never use array indexes as identity. */
export function newId(prefix: IdPrefix): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}
