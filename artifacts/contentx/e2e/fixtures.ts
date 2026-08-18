/**
 * Shared mock fixtures for ContentX E2E tests.
 *
 * All API responses are pre-built so tests never hit a real LLM or database.
 * The shapes match the generated API schema types exactly.
 */

// ---------------------------------------------------------------------------
// Seed scenarios (always present in the mock library)
// ---------------------------------------------------------------------------

const baseScenario = {
  logline: "E2E test logline — not a real LLM output.",
  synopsis: "E2E test synopsis.",
  theme: "Test theme",
  stakes: "Test stakes",
  twist: "Test twist",
  acts: [
    {
      name: "Act 1",
      summary: "Setup",
      beats: ["Beat 1", "Beat 2"],
    },
    {
      name: "Act 2",
      summary: "Confrontation",
      beats: ["Beat 3", "Beat 4"],
    },
    {
      name: "Act 3",
      summary: "Resolution",
      beats: ["Beat 5", "Beat 6"],
    },
  ],
  characters: [
    {
      name: "Alice",
      role: "Protagonist",
      motivation: "To solve the problem",
    },
    {
      name: "Bob",
      role: "Antagonist",
      motivation: "To resist change",
    },
  ],
};

export const SCENARIO_A = {
  id: "e2e-scenario-a",
  title: "런칭 D-7: 품질과 속도의 전쟁",
  idea: "신제품 출시를 앞두고 품질팀과 마케팅팀의 갈등",
  scenario: { ...baseScenario, title: "런칭 D-7: 품질과 속도의 전쟁" },
  classification: null,
  lineage: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

export const SCENARIO_B = {
  id: "e2e-scenario-b",
  title: "응급실 최후의 밤",
  idea: "응급실 인력 감축을 둘러싼 대립",
  scenario: { ...baseScenario, title: "응급실 최후의 밤" },
  classification: null,
  lineage: null,
  createdAt: "2026-01-02T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

export const SEED_SCENARIOS = [SCENARIO_A, SCENARIO_B];

// ---------------------------------------------------------------------------
// Bridge flow mocks
// ---------------------------------------------------------------------------

export const BRIDGE_ANALYSIS_RESPONSE = {
  summary:
    '"런칭 D-7"의 결말과 "응급실 최후의 밤"의 시작 사이에는 전환이 필요하다. (E2E mock)',
  gaps: [
    { dimension: "timeline",       status: "transition",  explanation: "Time gap between stories",    requirement: "Establish time passage" },
    { dimension: "location",       status: "conflict",    explanation: "Different settings",          requirement: "Show location change"   },
    { dimension: "characters",     status: "compatible",  explanation: "Different character pools",   requirement: null                     },
    { dimension: "goals",          status: "transition",  explanation: "Goals shift between worlds",  requirement: "Bridge character goals" },
    { dimension: "conflict",       status: "conflict",    explanation: "Different conflict types",    requirement: "Link conflict threads"  },
    { dimension: "relationships",  status: "compatible",  explanation: "New relationships possible",  requirement: null                     },
    { dimension: "knowledge",      status: "transition",  explanation: "Knowledge gap",               requirement: "Transfer key info"      },
    { dimension: "threads",        status: "transition",  explanation: "Unresolved threads remain",   requirement: "Resolve or carry threads"},
    { dimension: "contradictions", status: "compatible",  explanation: "No major contradictions",     requirement: null                     },
  ],
  requirements: ["Establish time passage", "Show location change", "Bridge character goals"],
};

export const BRIDGE_LINEAGE = {
  kind: "bridge",
  parents: [
    {
      scenarioId: SCENARIO_A.id,
      title: SCENARIO_A.title,
      elements: [],
      role: "source",
    },
    {
      scenarioId: SCENARIO_B.id,
      title: SCENARIO_B.title,
      elements: [],
      role: "target",
    },
  ],
  requirements: BRIDGE_ANALYSIS_RESPONSE.requirements,
  synthesizedBy: "mock/bridge-v1",
};

export const BRIDGE_GENERATE_RESPONSE = {
  scenario: {
    ...baseScenario,
    title: `다리: ${SCENARIO_A.title} → ${SCENARIO_B.title}`,
    logline: `${SCENARIO_A.title}의 결말과 ${SCENARIO_B.title}의 시작을 잇는 이야기 (E2E mock)`,
    amplifiedBy: "mock/bridge-v1",
  },
  lineage: BRIDGE_LINEAGE,
};

export const SAVED_BRIDGE_SCENARIO = {
  id: "e2e-bridge-saved",
  title: `다리: ${SCENARIO_A.title} → ${SCENARIO_B.title}`,
  idea: `Bridge story: ${SCENARIO_A.title} → ${SCENARIO_B.title}`,
  scenario: BRIDGE_GENERATE_RESPONSE.scenario,
  classification: null,
  lineage: BRIDGE_LINEAGE,
  createdAt: "2026-01-03T00:00:00Z",
  updatedAt: "2026-01-03T00:00:00Z",
};

export const SCENARIOS_WITH_BRIDGE = [...SEED_SCENARIOS, SAVED_BRIDGE_SCENARIO];

// ---------------------------------------------------------------------------
// Synthesize flow mocks
// ---------------------------------------------------------------------------

export const SYNTHESIS_LINEAGE = {
  kind: null, // synthesis uses null kind (the default)
  parents: [
    {
      scenarioId: SCENARIO_A.id,
      title: SCENARIO_A.title,
      elements: ["characters", "conflict"],
      role: null,
    },
    {
      scenarioId: SCENARIO_B.id,
      title: SCENARIO_B.title,
      elements: ["setting", "twist"],
      role: null,
    },
  ],
  synthesizedBy: "mock/synth-v1",
};

export const SYNTHESIS_RESPONSE = {
  scenario: {
    ...baseScenario,
    title: `합성: ${SCENARIO_A.title} + ${SCENARIO_B.title}`,
    logline: "두 이야기의 요소를 결합한 합성 시나리오 (E2E mock)",
    amplifiedBy: "mock/synth-v1",
  },
  lineage: SYNTHESIS_LINEAGE,
};

export const SAVED_SYNTHESIS_SCENARIO = {
  id: "e2e-synth-saved",
  title: `합성: ${SCENARIO_A.title} + ${SCENARIO_B.title}`,
  idea: `Synthesis of: ${SCENARIO_A.title}, ${SCENARIO_B.title}`,
  scenario: SYNTHESIS_RESPONSE.scenario,
  classification: null,
  lineage: SYNTHESIS_LINEAGE,
  createdAt: "2026-01-04T00:00:00Z",
  updatedAt: "2026-01-04T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Other mock payloads
// ---------------------------------------------------------------------------

export const EMPTY_SUMMARY = {
  contentCount: 0,
  entityCount: 0,
  relationshipCount: 0,
};

export const EMPTY_CATEGORIES: unknown[] = [];
export const EMPTY_CONTENT: unknown[] = [];
