// @vitest-environment jsdom
/**
 * Component tests: World page — Bridge Story flow.
 *
 * Verifies the full UI state machine without needing a real browser:
 *  1. "Bridge Mode" button enters bridge mode
 *  2. Clicking two scenarios tags them A and B
 *  3. "Analyze Connection" button opens the bridge panel
 *  4. Bridge panel shows A → Bridge → B header
 *  5. Running analysis renders the summary and gap dimensions
 *  6. "Generate Bridge Story" → lands on SCENARIO DRAFT step with bridge banner
 *  7. Bridge candidates bar is visible
 *  8. "Save to Library" → BRIDGE badge appears in the scenario list
 *
 * All API hooks are mocked with immediate synchronous onSuccess calls so
 * no network or LLM calls are ever made.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseScenario = {
  logline: "Test logline",
  synopsis: "Test synopsis",
  theme: "Test theme",
  stakes: "Test stakes",
  twist: "Test twist",
  acts: [{ name: "Act 1", summary: "Setup", beats: ["Beat 1"] }],
  characters: [],
};

const SCENARIO_A = {
  id: "scenario-a",
  title: "런칭 D-7: 품질과 속도의 전쟁",
  idea: "idea A",
  scenario: { ...baseScenario, title: "런칭 D-7: 품질과 속도의 전쟁" },
  classification: null,
  lineage: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const SCENARIO_B = {
  id: "scenario-b",
  title: "응급실 최후의 밤",
  idea: "idea B",
  scenario: { ...baseScenario, title: "응급실 최후의 밤" },
  classification: null,
  lineage: null,
  createdAt: "2026-01-02T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

const BRIDGE_ANALYSIS = {
  summary: "두 이야기 사이에 전환이 필요하다. (test mock)",
  gaps: [
    { dimension: "timeline",       status: "transition", explanation: "시간 차이",      requirement: "시간 경과 명시" },
    { dimension: "location",       status: "conflict",   explanation: "장소 차이",      requirement: "장소 전환" },
    { dimension: "characters",     status: "compatible", explanation: "인물 호환",      requirement: null },
    { dimension: "goals",          status: "transition", explanation: "목표 변화",      requirement: "목표 연결" },
    { dimension: "conflict",       status: "conflict",   explanation: "갈등 차이",      requirement: "갈등 연결" },
    { dimension: "relationships",  status: "compatible", explanation: "관계 호환",      requirement: null },
    { dimension: "knowledge",      status: "transition", explanation: "지식 차이",      requirement: "지식 전달" },
    { dimension: "threads",        status: "transition", explanation: "미결 실마리",    requirement: "실마리 해결" },
    { dimension: "contradictions", status: "compatible", explanation: "모순 없음",      requirement: null },
  ],
  requirements: ["시간 경과 명시", "장소 전환", "목표 연결"],
};

const BRIDGE_LINEAGE = {
  kind: "bridge",
  parents: [
    { scenarioId: "scenario-a", title: SCENARIO_A.title, elements: [], role: "source" },
    { scenarioId: "scenario-b", title: SCENARIO_B.title, elements: [], role: "target" },
  ],
  requirements: BRIDGE_ANALYSIS.requirements,
  synthesizedBy: "mock/bridge-v1",
};

const BRIDGE_GENERATE_RESULT = {
  scenario: {
    ...baseScenario,
    title: `다리: ${SCENARIO_A.title} → ${SCENARIO_B.title}`,
    logline: "두 이야기를 잇는 다리 이야기 (test mock)",
    amplifiedBy: "mock/bridge-v1",
  },
  lineage: BRIDGE_LINEAGE,
};

const SAVED_BRIDGE = {
  id: "bridge-saved",
  title: BRIDGE_GENERATE_RESULT.scenario.title,
  idea: `Bridge: ${SCENARIO_A.title} → ${SCENARIO_B.title}`,
  scenario: BRIDGE_GENERATE_RESULT.scenario,
  classification: null,
  lineage: BRIDGE_LINEAGE,
  createdAt: "2026-01-03T00:00:00Z",
  updatedAt: "2026-01-03T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Mock state helpers (controlled by each test)
// ---------------------------------------------------------------------------

let _scenarios = [SCENARIO_A, SCENARIO_B];
let _analyzeMutateFn: (args: any, cbs: any) => void = (_, cbs) => cbs?.onSuccess?.(BRIDGE_ANALYSIS);
let _bridgeMutateFn: (args: any, cbs: any) => void = (_, cbs) => cbs?.onSuccess?.(BRIDGE_GENERATE_RESULT);
let _createMutateFn: (args: any, cbs: any) => void = (_, cbs) => {
  _scenarios = [..._scenarios, SAVED_BRIDGE];
  cbs?.onSuccess?.(SAVED_BRIDGE);
};

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@workspace/api-client-react", () => ({
  useListContent: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useGetDashboardSummary: () => ({ data: { contentCount: 0, entityCount: 0, relationshipCount: 0 }, isLoading: false, refetch: vi.fn() }),
  useCreateContent: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteContent: () => ({ mutate: vi.fn() }),
  useDraftScenario: () => ({ mutate: vi.fn(), isPending: false }),
  useListScenarios: () => ({ data: _scenarios, isLoading: false, refetch: vi.fn() }),
  useCreateScenario: () => ({
    mutate: (args: any, cbs: any) => _createMutateFn(args, cbs),
    isPending: false,
  }),
  useUpdateScenario: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteScenario: () => ({ mutate: vi.fn() }),
  useListCategories: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useClassifyScenario: () => ({ mutate: vi.fn(), isPending: false }),
  useReclassifyScenarios: () => ({ mutate: vi.fn(), isPending: false }),
  useListSimilarScenarios: () => ({ data: [], isLoading: false }),
  useSynthesizeScenario: () => ({ mutate: vi.fn(), isPending: false }),
  useAnalyzeBridge: () => ({
    mutate: (args: any, cbs: any) => _analyzeMutateFn(args, cbs),
    isPending: false,
  }),
  useBridgeScenario: () => ({
    mutate: (args: any, cbs: any) => _bridgeMutateFn(args, cbs),
    isPending: false,
  }),
  getListScenariosQueryKey: () => ["scenarios"],
  getListCategoriesQueryKey: () => ["categories"],
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/world", vi.fn()],
  Link: ({ children, href, className }: any) =>
    React.createElement("a", { href, className }, children),
  Router: ({ children }: any) => children,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  QueryClient: class {},
  QueryClientProvider: ({ children }: any) => children,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: any) => React.createElement("div", { "data-testid": "layout" }, children),
}));

vi.mock("@/components/lineage-tree", () => ({
  default: () => React.createElement("div", { "data-testid": "lineage-tree" }, "LineageTree"),
}));

vi.mock("date-fns", () => ({
  format: () => "2026-01-01 00:00",
}));

// ---------------------------------------------------------------------------
// Import the component under test AFTER mocks are registered
// ---------------------------------------------------------------------------

// Dynamic import to ensure mocks are set up first
let World: React.ComponentType;

beforeEach(async () => {
  _scenarios = [SCENARIO_A, SCENARIO_B];
  _analyzeMutateFn = (_, cbs) => cbs?.onSuccess?.(BRIDGE_ANALYSIS);
  _bridgeMutateFn = (_, cbs) => cbs?.onSuccess?.(BRIDGE_GENERATE_RESULT);
  _createMutateFn = (_, cbs) => {
    _scenarios = [..._scenarios, SAVED_BRIDGE];
    cbs?.onSuccess?.(SAVED_BRIDGE);
  };

  if (!World) {
    const mod = await import("../world");
    World = mod.default;
  }
});

function renderWorld() {
  return render(React.createElement(World));
}

// ---------------------------------------------------------------------------
// Helper: navigate to the SCENARIOS tab
// ---------------------------------------------------------------------------

function clickScenariosTab() {
  const btn = screen.getByRole("button", { name: /Scenario Library/i });
  fireEvent.click(btn);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("World — Bridge Mode UI", () => {
  it("'Bridge Mode' button is visible in the Scenario Library tab", () => {
    renderWorld();
    clickScenariosTab();
    expect(screen.getByRole("button", { name: /^Bridge Mode$/i })).toBeInTheDocument();
  });

  it("clicking 'Bridge Mode' toggles bridge mode on", () => {
    renderWorld();
    clickScenariosTab();
    fireEvent.click(screen.getByRole("button", { name: /^Bridge Mode$/i }));
    // Button text changes to "Cancel Bridge"
    expect(screen.getByRole("button", { name: /Cancel Bridge/i })).toBeInTheDocument();
  });

  it("in bridge mode, scenario cards show A/B markers", () => {
    renderWorld();
    clickScenariosTab();
    fireEvent.click(screen.getByRole("button", { name: /^Bridge Mode$/i }));
    // Initial state: '·' markers for all unselected scenarios
    // Click scenario A → it becomes A
    fireEvent.click(screen.getByText(SCENARIO_A.title));
    // After selecting A, at least one "A" marker should be visible
    expect(screen.getAllByText("A").length).toBeGreaterThan(0);
  });

  it("after selecting two scenarios, 'Analyze Connection' button is enabled", () => {
    renderWorld();
    clickScenariosTab();
    fireEvent.click(screen.getByRole("button", { name: /^Bridge Mode$/i }));
    fireEvent.click(screen.getByText(SCENARIO_A.title));
    fireEvent.click(screen.getByText(SCENARIO_B.title));
    const analyzeBtn = screen.getByRole("button", { name: /Analyze Connection/i });
    expect(analyzeBtn).not.toBeDisabled();
  });

  it("clicking 'Analyze Connection' opens the bridge panel", () => {
    renderWorld();
    clickScenariosTab();
    fireEvent.click(screen.getByRole("button", { name: /^Bridge Mode$/i }));
    fireEvent.click(screen.getByText(SCENARIO_A.title));
    fireEvent.click(screen.getByText(SCENARIO_B.title));
    fireEvent.click(screen.getByRole("button", { name: /Analyze Connection/i }));
    // Bridge panel shows "Bridge Story" heading
    expect(screen.getByText("Bridge Story")).toBeInTheDocument();
    expect(screen.getByText("Source A")).toBeInTheDocument();
    expect(screen.getByText("Target B")).toBeInTheDocument();
  });

  it("panel 'Analyze Connection' populates bridge analysis summary", () => {
    renderWorld();
    clickScenariosTab();
    fireEvent.click(screen.getByRole("button", { name: /^Bridge Mode$/i }));
    fireEvent.click(screen.getByText(SCENARIO_A.title));
    fireEvent.click(screen.getByText(SCENARIO_B.title));
    // Open panel
    fireEvent.click(screen.getByRole("button", { name: /Analyze Connection/i }));
    // Click the "Analyze Connection" button inside the panel
    const panelAnalyzeBtn = screen.getAllByRole("button", { name: /Analyze Connection/i }).at(-1)!;
    fireEvent.click(panelAnalyzeBtn);
    // Bridge analysis summary should appear
    expect(screen.getByText(BRIDGE_ANALYSIS.summary)).toBeInTheDocument();
    // Gap dimensions should appear
    expect(screen.getByText("timeline")).toBeInTheDocument();
  });

  it("'Generate Bridge Story' → SCENARIO DRAFT step with Bridge Story banner", async () => {
    renderWorld();
    clickScenariosTab();
    fireEvent.click(screen.getByRole("button", { name: /^Bridge Mode$/i }));
    fireEvent.click(screen.getByText(SCENARIO_A.title));
    fireEvent.click(screen.getByText(SCENARIO_B.title));
    fireEvent.click(screen.getByRole("button", { name: /Analyze Connection/i }));
    // Run analysis
    const panelAnalyzeBtn = screen.getAllByRole("button", { name: /Analyze Connection/i }).at(-1)!;
    fireEvent.click(panelAnalyzeBtn);
    // Generate bridge
    fireEvent.click(screen.getByRole("button", { name: /Generate Bridge Story/i }));
    // Should land on SCENARIO DRAFT step — stepper shows "2. SCENARIO DRAFT"
    await waitFor(() => {
      expect(screen.getByText(/SCENARIO DRAFT/i)).toBeInTheDocument();
    });
    // Bridge Story banner should be visible
    expect(screen.getAllByText(/Bridge Story/i).length).toBeGreaterThan(0);
    // Bridge candidates bar
    expect(screen.getByText("Bridge Candidates")).toBeInTheDocument();
  });

  it("'Save to Library' → 'SAVED IN LIBRARY' badge shown; back to library reveals BRIDGE badge", async () => {
    renderWorld();
    clickScenariosTab();
    fireEvent.click(screen.getByRole("button", { name: /^Bridge Mode$/i }));
    fireEvent.click(screen.getByText(SCENARIO_A.title));
    fireEvent.click(screen.getByText(SCENARIO_B.title));
    fireEvent.click(screen.getByRole("button", { name: /Analyze Connection/i }));
    const panelAnalyzeBtn = screen.getAllByRole("button", { name: /Analyze Connection/i }).at(-1)!;
    fireEvent.click(panelAnalyzeBtn);
    fireEvent.click(screen.getByRole("button", { name: /Generate Bridge Story/i }));
    await waitFor(() => expect(screen.getByText(/SCENARIO DRAFT/i)).toBeInTheDocument());

    // Click save
    fireEvent.click(screen.getByRole("button", { name: /Save to Library/i }));

    // After save the component stays on the SCENARIO DRAFT view but marks the
    // scenario as saved — "SAVED IN LIBRARY" badge appears in the core panel header.
    await waitFor(() => {
      expect(screen.getByText(/SAVED IN LIBRARY/i)).toBeInTheDocument();
    });

    // Navigate back to the library
    fireEvent.click(screen.getByRole("button", { name: /Back to Library/i }));

    // Library now shows — the saved bridge scenario card carries a badge whose
    // text starts with "BRIDGE (" (e.g. "BRIDGE (Source → Target)").
    // This is distinct from the "Bridge Mode" button or "Bridge Candidates" bar.
    await waitFor(() => {
      const bridgeBadges = screen.getAllByText((content) => content.startsWith("BRIDGE ("));
      expect(bridgeBadges.length).toBeGreaterThan(0);
    });
  });
});

describe("World — Synthesize Mode regression", () => {
  it("'Synthesize Mode' button is visible in the Scenario Library tab", () => {
    renderWorld();
    clickScenariosTab();
    expect(screen.getByRole("button", { name: /^Synthesize Mode$/i })).toBeInTheDocument();
  });

  it("clicking 'Synthesize Mode' shows checkboxes", () => {
    renderWorld();
    clickScenariosTab();
    fireEvent.click(screen.getByRole("button", { name: /^Synthesize Mode$/i }));
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it("Bridge Mode button remains accessible after toggling Synthesize Mode", () => {
    renderWorld();
    clickScenariosTab();
    fireEvent.click(screen.getByRole("button", { name: /^Synthesize Mode$/i }));
    expect(screen.getByRole("button", { name: /Cancel Synthesis/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel Synthesis/i }));
    expect(screen.getByRole("button", { name: /^Bridge Mode$/i })).toBeInTheDocument();
  });

  it("selecting two scenarios enables the 'Synthesize (2)' button", () => {
    renderWorld();
    clickScenariosTab();
    fireEvent.click(screen.getByRole("button", { name: /^Synthesize Mode$/i }));
    fireEvent.click(screen.getByText(SCENARIO_A.title));
    fireEvent.click(screen.getByText(SCENARIO_B.title));
    expect(screen.getByRole("button", { name: /Synthesize \(2\)/i })).not.toBeDisabled();
  });

  it("Bridge Mode and Synthesize Mode are mutually exclusive", () => {
    renderWorld();
    clickScenariosTab();
    // Enter bridge mode
    fireEvent.click(screen.getByRole("button", { name: /^Bridge Mode$/i }));
    expect(screen.getByRole("button", { name: /Cancel Bridge/i })).toBeInTheDocument();
    // Synthesize Mode button should still exist but bridge disables it (clicking synthesize exits bridge)
    fireEvent.click(screen.getByRole("button", { name: /^Synthesize Mode$/i }));
    // Now in synthesize mode, bridge mode should be off
    expect(screen.queryByRole("button", { name: /Cancel Bridge/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel Synthesis/i })).toBeInTheDocument();
  });
});
