// @vitest-environment jsdom
/**
 * Component tests: LineageTree with bridge lineage data.
 *
 * Verifies:
 *  1. A bridge scenario shows the BRIDGE badge
 *  2. Role labels ("bridged from (A)" / "bridged into (B)") appear under parent nodes
 *  3. The bridge node appears under BOTH parents in the tree
 *  4. A synthesis scenario shows the SYNTHESIZED badge (regression guard)
 *  5. Ghost nodes (deleted parents) render without crashing
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LineageTree from "../lineage-tree";
import type { ScenarioRecord } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseScenario = {
  logline: "Test logline",
  synopsis: "Test synopsis",
  theme: "Test theme",
  stakes: "Test stakes",
  twist: "Test twist",
  acts: [],
  characters: [],
};

function makeRecord(
  id: string,
  title: string,
  lineage: ScenarioRecord["lineage"] = null,
): ScenarioRecord {
  return {
    id,
    title,
    idea: `idea for ${title}`,
    scenario: { ...baseScenario, title },
    classification: null,
    lineage,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const SCENARIO_A = makeRecord("scenario-a", "런칭 D-7: 품질과 속도의 전쟁");
const SCENARIO_B = makeRecord("scenario-b", "응급실 최후의 밤");

const BRIDGE_SCENARIO = makeRecord("bridge-scenario", "다리: 런칭 D-7 → 응급실 최후의 밤", {
  kind: "bridge",
  parents: [
    { scenarioId: "scenario-a", title: SCENARIO_A.title, elements: [], role: "source" },
    { scenarioId: "scenario-b", title: SCENARIO_B.title, elements: [], role: "target" },
  ],
  requirements: ["Establish time passage", "Show location change"],
  synthesizedBy: "mock/bridge-v1",
});

const SYNTHESIS_SCENARIO = makeRecord("synth-scenario", "합성: D-7 + 응급실", {
  kind: null,
  parents: [
    { scenarioId: "scenario-a", title: SCENARIO_A.title, elements: ["characters", "conflict"], role: null },
    { scenarioId: "scenario-b", title: SCENARIO_B.title, elements: ["setting", "twist"], role: null },
  ],
  synthesizedBy: "mock/synth-v1",
});

const onOpen = vi.fn();

// ---------------------------------------------------------------------------
// Tests: Bridge lineage
// ---------------------------------------------------------------------------

describe("LineageTree — bridge lineage", () => {
  const scenarios = [SCENARIO_A, SCENARIO_B, BRIDGE_SCENARIO];

  it("renders a family tree when bridge scenario is present", () => {
    render(<LineageTree scenarios={scenarios} onOpen={onOpen} />);
    expect(screen.getByText(/family tree/i)).toBeInTheDocument();
  });

  it("shows the BRIDGE chip badge on the bridge node", () => {
    render(<LineageTree scenarios={scenarios} onOpen={onOpen} />);
    // There should be at least one "bridge" label
    const bridgeBadges = screen.getAllByText("bridge");
    expect(bridgeBadges.length).toBeGreaterThan(0);
  });

  it("shows the bridge scenario title in the tree", () => {
    render(<LineageTree scenarios={scenarios} onOpen={onOpen} />);
    // Bridge node appears under both parents, so there may be multiple title elements
    expect(screen.getAllByText(BRIDGE_SCENARIO.title).length).toBeGreaterThan(0);
  });

  it("shows 'bridged from (A)' role label under the source parent", () => {
    render(<LineageTree scenarios={scenarios} onOpen={onOpen} />);
    expect(screen.getByText(/bridged from \(A\)/i)).toBeInTheDocument();
  });

  it("shows 'bridged into (B)' role label under the target parent", () => {
    render(<LineageTree scenarios={scenarios} onOpen={onOpen} />);
    expect(screen.getByText(/bridged into \(B\)/i)).toBeInTheDocument();
  });

  it("renders the bridge node under BOTH parent roots (two role labels total)", () => {
    render(<LineageTree scenarios={scenarios} onOpen={onOpen} />);
    // The bridge node appears once under source A ("bridged from (A)")
    // and once under target B ("bridged into (B)")
    const fromA = screen.getAllByText(/bridged from \(A\)/i);
    const intoB = screen.getAllByText(/bridged into \(B\)/i);
    expect(fromA.length).toBeGreaterThanOrEqual(1);
    expect(intoB.length).toBeGreaterThanOrEqual(1);
  });

  it("both parent titles appear in the tree", () => {
    render(<LineageTree scenarios={scenarios} onOpen={onOpen} />);
    expect(screen.getAllByText(SCENARIO_A.title).length).toBeGreaterThan(0);
    expect(screen.getAllByText(SCENARIO_B.title).length).toBeGreaterThan(0);
  });

  it("calls onOpen with the bridge scenario when the node is clicked", async () => {
    render(<LineageTree scenarios={scenarios} onOpen={onOpen} />);
    // Find the bridge scenario title and click the first occurrence
    const bridgeTitles = screen.getAllByText(BRIDGE_SCENARIO.title);
    bridgeTitles[0].click();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: BRIDGE_SCENARIO.id }));
  });
});

// ---------------------------------------------------------------------------
// Tests: Synthesis lineage (regression guard)
// ---------------------------------------------------------------------------

describe("LineageTree — synthesis lineage (regression)", () => {
  const scenarios = [SCENARIO_A, SCENARIO_B, SYNTHESIS_SCENARIO];

  it("renders the synthesis scenario title", () => {
    render(<LineageTree scenarios={scenarios} onOpen={onOpen} />);
    expect(screen.getAllByText(SYNTHESIS_SCENARIO.title).length).toBeGreaterThan(0);
  });

  it("does NOT show bridge badges for a synthesis scenario", () => {
    render(<LineageTree scenarios={scenarios} onOpen={onOpen} />);
    // "bridge" badges come from isBridge check — synthesis shouldn't have them
    const bridgeBadges = screen.queryAllByText("bridge");
    expect(bridgeBadges).toHaveLength(0);
  });

  it("shows element contribution tags on synthesis children", () => {
    render(<LineageTree scenarios={scenarios} onOpen={onOpen} />);
    // Each parent contributed elements, shown as colored tags on the child node
    expect(screen.getByText("characters")).toBeInTheDocument();
    expect(screen.getByText("conflict")).toBeInTheDocument();
    expect(screen.getByText("setting")).toBeInTheDocument();
    expect(screen.getByText("twist")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: Empty state and ghost nodes
// ---------------------------------------------------------------------------

describe("LineageTree — edge cases", () => {
  it("shows 'No Lineage Yet' when no scenarios have lineage", () => {
    render(<LineageTree scenarios={[SCENARIO_A, SCENARIO_B]} onOpen={onOpen} />);
    expect(screen.getByText(/no lineage yet/i)).toBeInTheDocument();
  });

  it("renders ghost node when a bridge parent was deleted from the library", () => {
    const bridgeWithDeletedParent = makeRecord("bridge-orphan", "Bridge (A deleted)", {
      kind: "bridge",
      parents: [
        // Scenario A NOT in the library (ghost)
        { scenarioId: "deleted-scenario-a", title: "Deleted Story A", elements: [], role: "source" },
        { scenarioId: "scenario-b", title: SCENARIO_B.title, elements: [], role: "target" },
      ],
      requirements: [],
      synthesizedBy: "mock",
    });

    render(
      <LineageTree
        scenarios={[SCENARIO_B, bridgeWithDeletedParent]}
        onOpen={onOpen}
      />
    );

    // Ghost node renders with "deleted" badge (may match multiple elements)
    expect(screen.getAllByText(/deleted/i).length).toBeGreaterThan(0);
    // Ghost title should still show
    expect(screen.getByText("Deleted Story A")).toBeInTheDocument();
  });
});
