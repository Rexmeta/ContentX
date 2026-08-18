/**
 * Lineage — neutral shared types describing how a piece of content was
 * derived from earlier scenarios. Lives outside any domain so the content
 * domain never depends on scenario/AI implementation modules.
 */

export const SCENARIO_ELEMENTS = [
  "characters",
  "conflict",
  "setting",
  "twist",
  "structure",
] as const;

export type ScenarioElement = (typeof SCENARIO_ELEMENTS)[number];

/** How a derived scenario was produced from its parents. */
export type LineageKind = "synthesis" | "bridge";

/** Which side of a bridge a parent sits on (bridge lineage only). */
export type BridgeRole = "source" | "target";

export interface LineageParent {
  scenarioId: string;
  title: string;
  elements: ScenarioElement[];
  /** Bridge lineage only: source (Story A) or target (Story B). */
  role?: BridgeRole | null;
}

export interface Lineage {
  /** undefined/null/"synthesis" = element remix; "bridge" = connecting story. */
  kind?: LineageKind | null;
  parents: LineageParent[];
  instruction?: string | null;
  /** Bridge lineage only: transition requirements the bridge was generated against. */
  requirements?: string[] | null;
  synthesizedBy?: string | null;
}
