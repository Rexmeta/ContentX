// @vitest-environment jsdom
/**
 * Regression test: Graph Explorer mobile pane exclusivity.
 *
 * On mobile (<md) the graph and the inspector are mutually exclusive panes:
 *  1. Initially the graph pane is visible (`flex`) and the inspector hidden.
 *  2. Selecting a graph node auto-opens the inspector — the inspector pane
 *     becomes `flex` and the graph pane becomes `hidden` (mobile), while
 *     `md:flex` keeps both visible on desktop.
 *  3. The close button returns to the graph pane.
 *  4. The header "Inspector" toggle opens/closes the inspector too.
 *
 * All API hooks and the SVG graph are mocked; no network calls are made.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// --- Mock the generated API client: every hook returns empty data ---------
vi.mock("@workspace/api-client-react", () => {
  const emptyList = () => ({ data: [], isLoading: false });
  const emptyOne = () => ({ data: undefined, isLoading: false });
  const key = () => ["k"];
  return {
    useListContent: emptyList,
    useListPopulations: emptyList,
    useListCharacters: emptyList,
    useListSimulations: emptyList,
    useGetContent: emptyOne,
    useGetPopulation: emptyOne,
    useListDimensions: emptyList,
    useListSamplingRuns: emptyList,
    useListDependencyRules: emptyList,
    useGetCharacter: emptyOne,
    useListAgents: emptyList,
    useListSnapshots: emptyList,
    useGetSimulation: emptyOne,
    useListSimulationEvents: emptyList,
    useListEvaluations: emptyList,
    getListContentQueryKey: key,
    getListPopulationsQueryKey: key,
    getListCharactersQueryKey: key,
    getListSimulationsQueryKey: key,
    getGetContentQueryKey: key,
    getGetPopulationQueryKey: key,
    getListDimensionsQueryKey: key,
    getListSamplingRunsQueryKey: key,
    getListDependencyRulesQueryKey: key,
    getGetCharacterQueryKey: key,
    getListAgentsQueryKey: key,
    getListSnapshotsQueryKey: key,
    getGetSimulationQueryKey: key,
    getListSimulationEventsQueryKey: key,
    getListEvaluationsQueryKey: key,
  };
});

// --- Mock the SVG graph: expose a button that selects a node --------------
vi.mock("@/components/stable-graph", () => ({
  StableGraph: ({ onSelectNode }: { onSelectNode: (id: string) => void }) => (
    <button data-testid="mock-node" onClick={() => onSelectNode("node-1")}>
      node
    </button>
  ),
  GraphLegend: () => null,
}));

import Explorer from "../explorer";

function getPanes() {
  return {
    graph: screen.getByTestId("pane-graph"),
    inspector: screen.getByTestId("pane-inspector"),
  };
}

describe("Explorer mobile pane exclusivity", () => {
  it("shows the graph and hides the inspector initially", () => {
    render(<Explorer />);
    const { graph, inspector } = getPanes();
    expect(graph.className).toContain("flex");
    expect(graph.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(inspector.className).toMatch(/(^|\s)hidden(\s|$)/);
    // Desktop keeps both visible regardless of mobile state
    expect(graph.className).toContain("md:flex");
    expect(inspector.className).toContain("md:flex");
  });

  it("selecting a node opens the inspector and hides the graph on mobile", () => {
    render(<Explorer />);
    fireEvent.click(screen.getByTestId("mock-node"));
    const { graph, inspector } = getPanes();
    expect(inspector.className).toMatch(/(^|\s)flex(\s|$)/);
    expect(graph.className).toMatch(/(^|\s)hidden(\s|$)/);
    // Both panes must remain reachable on desktop
    expect(graph.className).toContain("md:flex");
  });

  it("close button returns to the graph pane", () => {
    render(<Explorer />);
    fireEvent.click(screen.getByTestId("mock-node"));
    fireEvent.click(screen.getByTestId("button-close-inspector"));
    const { graph, inspector } = getPanes();
    expect(graph.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(inspector.className).toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("header toggle opens and closes the inspector", () => {
    render(<Explorer />);
    const toggle = screen.getByTestId("button-toggle-inspector");
    fireEvent.click(toggle);
    expect(getPanes().inspector.className).toMatch(/(^|\s)flex(\s|$)/);
    expect(getPanes().graph.className).toMatch(/(^|\s)hidden(\s|$)/);
    fireEvent.click(toggle);
    expect(getPanes().inspector.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(getPanes().graph.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });
});
