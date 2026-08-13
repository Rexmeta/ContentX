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

export interface LineageParent {
  scenarioId: string;
  title: string;
  elements: ScenarioElement[];
}

export interface Lineage {
  parents: LineageParent[];
  instruction?: string | null;
  synthesizedBy?: string | null;
}
