/**
 * Bridge Remix integration tests: analyze / generate / save-time bridge
 * lineage validation (anti-forgery). LLM boundaries (bridge analyzer +
 * synthesizer, classifier) and the persistence boundary (repositories) are
 * mocked so only route wiring and the lineage service are exercised.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { ScenarioRow } from "@workspace/db";
import { amplifyIdea } from "../../domains/ai/mockAmplifier";
import {
  BridgeError,
  BRIDGE_SYNTHESIZER_ID,
  mockBridgeAnalyzer,
  mockBridgeSynthesizer,
} from "../../domains/scenario/bridge";
import type { Lineage } from "../../shared/lineage";

vi.mock("../../domains/scenario/repository", () => ({
  getScenario: vi.fn(),
  listScenarios: vi.fn(),
  insertScenario: vi.fn(),
  updateScenario: vi.fn(),
  deleteScenario: vi.fn(),
}));

vi.mock("../../domains/scenario/bridge", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../domains/scenario/bridge")>();
  return {
    ...actual,
    analyzeBridgeWithLLM: vi.fn(),
    bridgeWithLLM: vi.fn(),
  };
});

vi.mock(
  "../../domains/scenario/classificationService",
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import("../../domains/scenario/classificationService")
    >();
    return {
      ...actual,
      classifyScenario: vi.fn().mockResolvedValue(null),
      acceptManualClassification: vi.fn(),
    };
  },
);

import * as scenarioRepo from "../../domains/scenario/repository";
import {
  analyzeBridgeWithLLM,
  bridgeWithLLM,
} from "../../domains/scenario/bridge";
import app from "../../app";

const scenarioA = amplifyIdea("빵집 사장과 프랜차이즈의 갈등");
const scenarioB = amplifyIdea("응급실 인력 감축을 둘러싼 대립");

function row(id: string, scenario = scenarioA): ScenarioRow {
  return {
    id,
    title: scenario.title,
    idea: scenario.sourceIdea ?? "idea",
    scenario,
    classification: null,
    lineage: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  } as ScenarioRow;
}

const getScenario = vi.mocked(scenarioRepo.getScenario);
const insertScenario = vi.mocked(scenarioRepo.insertScenario);
const analyze = vi.mocked(analyzeBridgeWithLLM);
const generate = vi.mocked(bridgeWithLLM);

beforeEach(() => {
  vi.clearAllMocks();
  getScenario.mockImplementation(async (id: string) => {
    if (id === "scenario_a") return row("scenario_a", scenarioA);
    if (id === "scenario_b") return row("scenario_b", scenarioB);
    return undefined;
  });
  analyze.mockImplementation(mockBridgeAnalyzer);
  generate.mockImplementation(mockBridgeSynthesizer);
});

describe("POST /api/v1/scenarios/bridge/analyze", () => {
  it("returns 400 for a malformed body", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/bridge/analyze")
      .send({ sourceScenarioId: "scenario_a" });
    expect(res.status).toBe(400);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("returns 400 when source and target are the same", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/bridge/analyze")
      .send({ sourceScenarioId: "scenario_a", targetScenarioId: "scenario_a" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/different/i);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("returns 400 for unknown scenarios", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/bridge/analyze")
      .send({ sourceScenarioId: "scenario_a", targetScenarioId: "ghost" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("ghost");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("returns 502 when analysis fails", async () => {
    analyze.mockRejectedValueOnce(new BridgeError("AI provider request failed: boom"));
    const res = await request(app)
      .post("/api/v1/scenarios/bridge/analyze")
      .send({ sourceScenarioId: "scenario_a", targetScenarioId: "scenario_b" });
    expect(res.status).toBe(502);
    expect(res.body.error).toContain("AI provider request failed");
  });

  it("returns 502 when the analysis is missing gap dimensions", async () => {
    const full = await mockBridgeAnalyzer(scenarioA, scenarioB);
    analyze.mockResolvedValueOnce({ ...full, gaps: full.gaps.slice(0, 7) });
    const res = await request(app)
      .post("/api/v1/scenarios/bridge/analyze")
      .send({ sourceScenarioId: "scenario_a", targetScenarioId: "scenario_b" });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/missing dimensions: threads, contradictions/);
  });

  it("returns 502 when the analysis duplicates a gap dimension", async () => {
    const full = await mockBridgeAnalyzer(scenarioA, scenarioB);
    analyze.mockResolvedValueOnce({
      ...full,
      gaps: [...full.gaps.slice(0, 8), full.gaps[0]],
    });
    const res = await request(app)
      .post("/api/v1/scenarios/bridge/analyze")
      .send({ sourceScenarioId: "scenario_a", targetScenarioId: "scenario_b" });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/missing dimensions: contradictions/);
    expect(res.body.error).toMatch(/duplicated dimensions: timeline/);
  });

  it("returns the structured connection analysis", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/bridge/analyze")
      .send({ sourceScenarioId: "scenario_a", targetScenarioId: "scenario_b" });
    expect(res.status).toBe(200);
    expect(res.body.summary).toContain(scenarioA.title);
    expect(res.body.gaps).toHaveLength(9);
    expect(res.body.gaps[0]).toMatchObject({
      dimension: "timeline",
      status: "transition",
    });
    expect(res.body.requirements.length).toBeGreaterThan(0);
    expect(analyze).toHaveBeenCalledWith(scenarioA, scenarioB);
  });
});

describe("POST /api/v1/scenarios/bridge", () => {
  const validBody = {
    sourceScenarioId: "scenario_a",
    targetScenarioId: "scenario_b",
    requirements: ["시간 경과를 명시하라", "  주인공 이동 동기  "],
    instruction: "차분한 톤으로",
  };

  it("returns 400 for a malformed body", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/bridge")
      .send({ sourceScenarioId: "scenario_a", targetScenarioId: "scenario_b" });
    expect(res.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns 400 for unknown scenarios", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/bridge")
      .send({ ...validBody, targetScenarioId: "ghost" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("ghost");
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects an instruction over 500 characters before invoking the LLM", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/bridge")
      .send({ ...validBody, instruction: "가".repeat(501) });
    expect(res.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it("trims the instruction before passing it to the synthesizer", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/bridge")
      .send({ ...validBody, instruction: "  조용한 톤으로  " });
    expect(res.status).toBe(200);
    expect(generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      "조용한 톤으로",
    );
    expect(res.body.lineage.instruction).toBe("조용한 톤으로");
  });

  it("returns 502 when bridge generation fails", async () => {
    generate.mockRejectedValueOnce(new BridgeError("AI provider request failed: boom"));
    const res = await request(app)
      .post("/api/v1/scenarios/bridge")
      .send(validBody);
    expect(res.status).toBe(502);
  });

  it("returns the bridge draft with server-built bridge lineage", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/bridge")
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.scenario.title).toContain("다리");
    expect(res.body.lineage).toMatchObject({
      kind: "bridge",
      parents: [
        {
          scenarioId: "scenario_a",
          title: scenarioA.title,
          elements: [],
          role: "source",
        },
        {
          scenarioId: "scenario_b",
          title: scenarioB.title,
          elements: [],
          role: "target",
        },
      ],
      instruction: "차분한 톤으로",
      requirements: ["시간 경과를 명시하라", "주인공 이동 동기"],
    });
    // trimmed requirements are what the generator receives
    expect(generate).toHaveBeenCalledWith(
      scenarioA,
      scenarioB,
      ["시간 경과를 명시하라", "주인공 이동 동기"],
      "차분한 톤으로",
    );
  });
});

describe("POST /api/v1/scenarios (save with bridge lineage)", () => {
  const bridgeLineage = (overrides: Record<string, unknown> = {}) => ({
    kind: "bridge",
    parents: [
      { scenarioId: "scenario_a", title: "위조", elements: [], role: "source" },
      { scenarioId: "scenario_b", title: "위조2", elements: [], role: "target" },
    ],
    instruction: "잇기",
    requirements: ["요구사항 1"],
    synthesizedBy: "hacker/forged-model",
    ...overrides,
  });

  const saveBody = (lineage: unknown) => ({
    idea: "다리 저장 테스트",
    scenario: { ...scenarioA, title: "다리 저장" },
    lineage,
  });

  beforeEach(() => {
    insertScenario.mockImplementation(async (r) => ({
      ...row("scenario_bridge"),
      ...r,
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    }) as ScenarioRow);
  });

  it("rejects bridge lineage with a missing role", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(
        saveBody(
          bridgeLineage({
            parents: [
              { scenarioId: "scenario_a", title: "x", elements: [] },
              { scenarioId: "scenario_b", title: "y", elements: [], role: "target" },
            ],
          }),
        ),
      );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/source parent and one target/i);
    expect(insertScenario).not.toHaveBeenCalled();
  });

  it("rejects bridge lineage with two sources", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(
        saveBody(
          bridgeLineage({
            parents: [
              { scenarioId: "scenario_a", title: "x", elements: [], role: "source" },
              { scenarioId: "scenario_b", title: "y", elements: [], role: "source" },
            ],
          }),
        ),
      );
    expect(res.status).toBe(400);
    expect(insertScenario).not.toHaveBeenCalled();
  });

  it("rejects bridge lineage where source equals target", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(
        saveBody(
          bridgeLineage({
            parents: [
              { scenarioId: "scenario_a", title: "x", elements: [], role: "source" },
              { scenarioId: "scenario_a", title: "x", elements: [], role: "target" },
            ],
          }),
        ),
      );
    expect(res.status).toBe(400);
    expect(insertScenario).not.toHaveBeenCalled();
  });

  it("rejects bridge lineage referencing nonexistent parents", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(
        saveBody(
          bridgeLineage({
            parents: [
              { scenarioId: "scenario_a", title: "x", elements: [], role: "source" },
              { scenarioId: "scenario_ghost", title: "y", elements: [], role: "target" },
            ],
          }),
        ),
      );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("scenario_ghost");
    expect(insertScenario).not.toHaveBeenCalled();
  });

  it("rejects unknown lineage kinds", async () => {
    // Rejected at the request-schema boundary (kind is a closed enum).
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(saveBody(bridgeLineage({ kind: "wormhole" })));
    expect(res.status).toBe(400);
    expect(insertScenario).not.toHaveBeenCalled();
  });

  it("saves with server-rebuilt bridge lineage, ignoring forged titles/synthesizedBy", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(saveBody(bridgeLineage()));
    expect(res.status).toBe(201);
    const saved = insertScenario.mock.calls[0]![0];
    const lineage = saved.lineage as Lineage;
    expect(lineage.kind).toBe("bridge");
    expect(lineage.synthesizedBy).toBe(BRIDGE_SYNTHESIZER_ID);
    expect(lineage.parents.map((p) => p.title)).toEqual([
      scenarioA.title,
      scenarioB.title,
    ]);
    expect(lineage.parents.map((p) => p.role)).toEqual(["source", "target"]);
    expect(lineage.requirements).toEqual(["요구사항 1"]);
    expect(res.body.lineage.kind).toBe("bridge");
    expect(res.body.lineage.synthesizedBy).toBe(BRIDGE_SYNTHESIZER_ID);
  });

  it("orders parents source-first even when the client sends target first", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(
        saveBody(
          bridgeLineage({
            parents: [
              { scenarioId: "scenario_b", title: "y", elements: [], role: "target" },
              { scenarioId: "scenario_a", title: "x", elements: [], role: "source" },
            ],
          }),
        ),
      );
    expect(res.status).toBe(201);
    const lineage = insertScenario.mock.calls[0]![0].lineage as Lineage;
    expect(lineage.parents.map((p) => p.scenarioId)).toEqual([
      "scenario_a",
      "scenario_b",
    ]);
  });

  it("saves bridgeAnalysis from lineage and stores the validated version", async () => {
    const fullAnalysis = await mockBridgeAnalyzer(scenarioA, scenarioB);
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(saveBody(bridgeLineage({ bridgeAnalysis: fullAnalysis })));
    expect(res.status).toBe(201);
    const lineage = insertScenario.mock.calls[0]![0].lineage as Lineage & {
      bridgeAnalysis?: { summary: string; gaps: unknown[]; requirements: string[] } | null;
    };
    expect(lineage.bridgeAnalysis).not.toBeNull();
    expect(lineage.bridgeAnalysis?.summary).toContain(scenarioA.title);
    expect(lineage.bridgeAnalysis?.gaps).toHaveLength(9);
    // Also present on the HTTP response body
    expect(res.body.lineage.bridgeAnalysis).toMatchObject({
      summary: expect.any(String),
      gaps: expect.arrayContaining([
        expect.objectContaining({ dimension: "timeline" }),
      ]),
    });
  });

  it("omits bridgeAnalysis from lineage when not supplied", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(saveBody(bridgeLineage())); // no bridgeAnalysis key
    expect(res.status).toBe(201);
    const lineage = insertScenario.mock.calls[0]![0].lineage as Lineage & {
      bridgeAnalysis?: unknown;
    };
    expect(lineage.bridgeAnalysis ?? null).toBeNull();
  });

  it("rejects bridge lineage with a bridgeAnalysis missing dimensions", async () => {
    const full = await mockBridgeAnalyzer(scenarioA, scenarioB);
    const truncated = { ...full, gaps: full.gaps.slice(0, 7) }; // only 7 of 9 dimensions
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(saveBody(bridgeLineage({ bridgeAnalysis: truncated })));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing dimensions/i);
    expect(insertScenario).not.toHaveBeenCalled();
  });

  it("a saved bridge is a normal scenario reusable as a bridge parent", async () => {
    // Save the bridge, then register it in the mocked repo and use it as a
    // parent of a new bridge lineage — the chain must validate.
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(saveBody(bridgeLineage()));
    expect(res.status).toBe(201);
    const savedRow = {
      ...row("scenario_bridge", { ...scenarioA, title: "다리 저장" }),
      lineage: insertScenario.mock.calls[0]![0].lineage,
    } as ScenarioRow;
    getScenario.mockImplementation(async (id: string) => {
      if (id === "scenario_a") return row("scenario_a", scenarioA);
      if (id === "scenario_b") return row("scenario_b", scenarioB);
      if (id === "scenario_bridge") return savedRow;
      return undefined;
    });
    const res2 = await request(app)
      .post("/api/v1/scenarios")
      .send(
        saveBody(
          bridgeLineage({
            parents: [
              { scenarioId: "scenario_bridge", title: "x", elements: [], role: "source" },
              { scenarioId: "scenario_b", title: "y", elements: [], role: "target" },
            ],
          }),
        ),
      );
    expect(res2.status).toBe(201);
  });
});
