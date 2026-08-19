/**
 * Lineage — neutral shared types describing how a piece of content was
 * derived from earlier scenarios. Lives outside any domain so the content
 * domain never depends on scenario/AI implementation modules.
 */

// ---------------------------------------------------------------------------
// Bridge analysis — stored verbatim with bridge lineage so the analysis can
// be reviewed after the scenario is saved. Defined here (not in bridge.ts)
// so the shared Lineage type doesn't pull in domain-layer dependencies.
// ---------------------------------------------------------------------------

export type BridgeGapStatus = "compatible" | "transition" | "conflict";

export interface BridgeGapItem {
  dimension: string;
  status: BridgeGapStatus;
  explanation: string;
  requirement?: string | null;
}

export interface StoredBridgeAnalysis {
  summary: string;
  gaps: BridgeGapItem[];
  requirements: string[];
}

// ---------------------------------------------------------------------------

export const SCENARIO_ELEMENTS = [
  // Original 5 elements — kept for backward compatibility with stored lineages
  "characters",
  "conflict",
  "setting",
  "twist",
  "structure",
  // Extended element vocabulary (phase 1)
  "relationship", // 인물 간 관계 역학
  "goal",         // 인물들의 목표·동기
  "event",        // 핵심 사건·전환점
  "ending",       // 결말·해소 방식
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
  /** Bridge lineage only: connection analysis produced by /analyze and stored verbatim. */
  bridgeAnalysis?: StoredBridgeAnalysis | null;
}
