/**
 * Scenario domain model — the scenario domain owns its own types.
 * AI modules (amplifier/synthesizer/classifier) adapt to these types;
 * they do not define them.
 */

export interface ScenarioAct {
  name: string;
  summary: string;
  beats: string[];
}

export interface ScenarioCharacter {
  name: string;
  role: string;
  motivation: string;
}

export interface DramaticScenario {
  title: string;
  logline: string;
  synopsis: string;
  theme: string;
  stakes: string;
  twist: string;
  acts: ScenarioAct[];
  characters: ScenarioCharacter[];
  sourceIdea?: string | null;
  amplifiedBy?: string | null;
}

export type { Lineage, LineageParent, ScenarioElement } from "../../shared/lineage";
export { SCENARIO_ELEMENTS } from "../../shared/lineage";
