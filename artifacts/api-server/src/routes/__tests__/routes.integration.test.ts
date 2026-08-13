/**
 * Route-level integration tests: synthesize / save-with-lineage / content
 * provenance. LLM boundaries (synthesizer, classifier) and the persistence
 * boundary (repositories) are mocked so only route wiring is exercised.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { ScenarioRow, ContentRow } from "@workspace/db";
import { amplifyIdea } from "../../domains/ai/scenarioAmplifier";
import {
  SynthesisError,
  SYNTHESIZER_ID,
  type Lineage,
} from "../../domains/scenario/synthesizer";

vi.mock("../../domains/scenario/repository", () => ({
  getScenario: vi.fn(),
  listScenarios: vi.fn(),
  insertScenario: vi.fn(),
  updateScenario: vi.fn(),
  deleteScenario: vi.fn(),
}));

vi.mock("../../domains/scenario/synthesizer", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../domains/scenario/synthesizer")
    >();
  return { ...actual, synthesizeWithLLM: vi.fn() };
});

vi.mock("../../domains/scenario/classificationService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../domains/scenario/classificationService")
  >();
  return {
    ...actual,
    classifyScenario: vi.fn(),
    acceptManualClassification: vi.fn(),
  };
});

vi.mock("../../domains/content/repository", () => ({
  listContents: vi.fn(),
  getContent: vi.fn(),
  deleteContent: vi.fn(),
  insertContentWithInitialVersion: vi.fn(),
  mutateGraph: vi.fn(),
  listVersions: vi.fn(),
  insertVersion: vi.fn(),
}));

import * as scenarioRepo from "../../domains/scenario/repository";
import * as contentRepo from "../../domains/content/repository";
import { synthesizeWithLLM } from "../../domains/scenario/synthesizer";
import {
  classifyScenario,
  acceptManualClassification,
  InvalidClassificationError,
} from "../../domains/scenario/classificationService";
import { ClassificationError } from "../../domains/scenario/classifier";
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
const synthesize = vi.mocked(synthesizeWithLLM);
const classify = vi.mocked(classifyScenario);
const insertContent = vi.mocked(contentRepo.insertContentWithInitialVersion);
const listScenarios = vi.mocked(scenarioRepo.listScenarios);
const updateScenario = vi.mocked(scenarioRepo.updateScenario);
const acceptManual = vi.mocked(acceptManualClassification);

beforeEach(() => {
  vi.clearAllMocks();
  getScenario.mockImplementation(async (id: string) => {
    if (id === "scenario_a") return row("scenario_a", scenarioA);
    if (id === "scenario_b") return row("scenario_b", scenarioB);
    return undefined;
  });
  classify.mockResolvedValue({
    domain: "직장",
    conflictType: "조직 갈등",
    tone: "긴장",
    tags: ["테스트"],
  });
});

describe("POST /api/v1/scenarios/synthesize", () => {
  const validBody = {
    sources: [
      { scenarioId: "scenario_a", elements: ["characters"] },
      { scenarioId: "scenario_b", elements: ["conflict", "twist"] },
    ],
    instruction: "두 이야기를 엮어라",
  };

  it("returns 400 for a malformed body", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/synthesize")
      .send({ sources: [{ scenarioId: "scenario_a", elements: [] }] });
    expect(res.status).toBe(400);
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("returns 400 when a source scenario id is unknown", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/synthesize")
      .send({
        sources: [
          { scenarioId: "scenario_a", elements: ["characters"] },
          { scenarioId: "scenario_missing", elements: ["twist"] },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("scenario_missing");
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("returns 400 for duplicate source ids", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios/synthesize")
      .send({
        sources: [
          { scenarioId: "scenario_a", elements: ["characters"] },
          { scenarioId: "scenario_a", elements: ["twist"] },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duplicate/i);
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("returns 502 when the synthesis provider fails", async () => {
    synthesize.mockRejectedValueOnce(
      new SynthesisError("AI provider request failed: boom"),
    );
    const res = await request(app)
      .post("/api/v1/scenarios/synthesize")
      .send(validBody);
    expect(res.status).toBe(502);
    expect(res.body.error).toContain("AI provider request failed");
  });

  it("returns the synthesized scenario with server-built lineage", async () => {
    synthesize.mockResolvedValueOnce({
      ...scenarioA,
      title: "합성 결과",
      amplifiedBy: SYNTHESIZER_ID,
    });
    const res = await request(app)
      .post("/api/v1/scenarios/synthesize")
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.scenario.title).toBe("합성 결과");
    expect(res.body.lineage).toEqual({
      parents: [
        {
          scenarioId: "scenario_a",
          title: scenarioA.title,
          elements: ["characters"],
        },
        {
          scenarioId: "scenario_b",
          title: scenarioB.title,
          elements: ["conflict", "twist"],
        },
      ],
      instruction: "두 이야기를 엮어라",
      synthesizedBy: SYNTHESIZER_ID,
    });
  });
});

describe("POST /api/v1/scenarios (save with lineage)", () => {
  const lineageBody = (lineage: unknown) => ({
    idea: "합성 저장 테스트",
    scenario: { ...scenarioA, title: "합성 저장" },
    lineage,
  });

  it("returns 400 for lineage with fewer than 2 parents", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(
        lineageBody({
          parents: [
            { scenarioId: "scenario_a", title: "x", elements: ["twist"] },
          ],
        }),
      );
    expect(res.status).toBe(400);
    expect(insertScenario).not.toHaveBeenCalled();
  });

  it("returns 400 for lineage referencing unknown parents", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(
        lineageBody({
          parents: [
            { scenarioId: "scenario_a", title: "x", elements: ["twist"] },
            { scenarioId: "scenario_ghost", title: "y", elements: ["conflict"] },
          ],
        }),
      );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("scenario_ghost");
    expect(insertScenario).not.toHaveBeenCalled();
  });

  it("returns 400 for duplicate lineage parents", async () => {
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(
        lineageBody({
          parents: [
            { scenarioId: "scenario_a", title: "x", elements: ["twist"] },
            { scenarioId: "scenario_a", title: "x", elements: ["conflict"] },
          ],
        }),
      );
    expect(res.status).toBe(400);
    expect(insertScenario).not.toHaveBeenCalled();
  });

  it("saves with server-rebuilt lineage, ignoring forged titles/synthesizedBy", async () => {
    insertScenario.mockImplementation(async (r) => ({
      ...row("scenario_new"),
      ...r,
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    }) as ScenarioRow);
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send(
        lineageBody({
          parents: [
            { scenarioId: "scenario_a", title: "위조된 제목", elements: ["characters"] },
            { scenarioId: "scenario_b", title: "가짜", elements: ["twist"] },
          ],
          synthesizedBy: "hacker/forged-model",
        }),
      );
    expect(res.status).toBe(201);
    const saved = insertScenario.mock.calls[0]![0];
    const lineage = saved.lineage as Lineage;
    expect(lineage.synthesizedBy).toBe(SYNTHESIZER_ID);
    expect(lineage.parents.map((p) => p.title)).toEqual([
      scenarioA.title,
      scenarioB.title,
    ]);
    expect(res.body.lineage.synthesizedBy).toBe(SYNTHESIZER_ID);
  });

  it("saves without lineage when none is provided", async () => {
    insertScenario.mockImplementation(async (r) => ({
      ...row("scenario_new"),
      ...r,
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    }) as ScenarioRow);
    const res = await request(app)
      .post("/api/v1/scenarios")
      .send({ idea: "일반 저장", scenario: scenarioA });
    expect(res.status).toBe(201);
    expect(insertScenario.mock.calls[0]![0].lineage).toBeNull();
  });
});

describe("POST /api/v1/content (lineage → provenance)", () => {
  it("returns 400 when lineage is sent without a scenario", async () => {
    const res = await request(app)
      .post("/api/v1/content")
      .send({
        prompt: "그래프 생성",
        lineage: {
          parents: [
            { scenarioId: "scenario_a", title: "x", elements: ["twist"] },
            { scenarioId: "scenario_b", title: "y", elements: ["conflict"] },
          ],
        },
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/requires a scenario/i);
    expect(insertContent).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid lineage on content creation", async () => {
    const res = await request(app)
      .post("/api/v1/content")
      .send({
        prompt: "그래프 생성",
        scenario: scenarioA,
        lineage: {
          parents: [
            { scenarioId: "scenario_a", title: "x", elements: ["twist"] },
            { scenarioId: "scenario_ghost", title: "y", elements: ["conflict"] },
          ],
        },
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("scenario_ghost");
    expect(insertContent).not.toHaveBeenCalled();
  });

  it("carries validated lineage into provenance on the created graph", async () => {
    insertContent.mockImplementation(async (r) => ({
      ...r,
      sourcePrompt: r.sourcePrompt,
      createdAt: new Date("2026-01-03T00:00:00Z"),
      updatedAt: new Date("2026-01-03T00:00:00Z"),
    }) as ContentRow);
    const res = await request(app)
      .post("/api/v1/content")
      .send({
        prompt: "합성 시나리오로 그래프 생성",
        scenario: scenarioA,
        lineage: {
          parents: [
            { scenarioId: "scenario_a", title: "위조", elements: ["characters"] },
            { scenarioId: "scenario_b", title: "위조2", elements: ["twist"] },
          ],
          instruction: "  섞어라  ",
          synthesizedBy: "forged/model",
        },
      });
    expect(res.status).toBe(201);
    const lineage = res.body.provenance?.lineage;
    expect(lineage).toBeTruthy();
    expect(lineage.synthesizedBy).toBe(SYNTHESIZER_ID);
    expect(lineage.instruction).toBe("섞어라");
    expect(lineage.parents.map((p: { title: string }) => p.title)).toEqual([
      scenarioA.title,
      scenarioB.title,
    ]);
    // The persisted graph payload carries the same provenance lineage.
    const persisted = insertContent.mock.calls[0]![0];
    expect(persisted.graph.provenance?.lineage?.synthesizedBy).toBe(
      SYNTHESIZER_ID,
    );
  });

  it("creates content without provenance lineage when none is given", async () => {
    insertContent.mockImplementation(async (r) => ({
      ...r,
      createdAt: new Date("2026-01-03T00:00:00Z"),
      updatedAt: new Date("2026-01-03T00:00:00Z"),
    }) as ContentRow);
    const res = await request(app)
      .post("/api/v1/content")
      .send({ prompt: "일반 그래프", scenario: scenarioA });
    expect(res.status).toBe(201);
    expect(res.body.provenance?.lineage).toBeUndefined();
  });
});

describe("POST /api/v1/scenarios/:id/classify", () => {
  it("returns 404 for an unknown scenario id", async () => {
    const res = await request(app).post(
      "/api/v1/scenarios/scenario_missing/classify",
    );
    expect(res.status).toBe(404);
    expect(classify).not.toHaveBeenCalled();
  });

  it("returns 502 when the classifier fails", async () => {
    classify.mockRejectedValueOnce(
      new ClassificationError("AI provider request failed: boom"),
    );
    const res = await request(app).post(
      "/api/v1/scenarios/scenario_a/classify",
    );
    expect(res.status).toBe(502);
    expect(res.body.error).toContain("AI provider request failed");
    expect(updateScenario).not.toHaveBeenCalled();
  });

  it("persists the classification and returns the updated record", async () => {
    const classification = {
      domain: "직장",
      conflictType: "조직 갈등",
      tone: "긴장",
      tags: ["테스트"],
    };
    updateScenario.mockImplementation(async (id, patch) => ({
      ...row(id),
      ...patch,
      updatedAt: new Date("2026-01-05T00:00:00Z"),
    }) as ScenarioRow);
    const res = await request(app).post(
      "/api/v1/scenarios/scenario_a/classify",
    );
    expect(res.status).toBe(200);
    expect(updateScenario).toHaveBeenCalledWith("scenario_a", {
      classification,
    });
    expect(res.body.classification).toEqual(classification);
  });
});

describe("POST /api/v1/scenarios/reclassify", () => {
  it("aggregates partial failures into {classified, failed}", async () => {
    listScenarios.mockResolvedValueOnce([
      row("scenario_a", scenarioA),
      row("scenario_b", scenarioB),
      row("scenario_c", scenarioA),
    ]);
    classify
      .mockResolvedValueOnce({
        domain: "직장",
        conflictType: "조직 갈등",
        tone: "긴장",
        tags: ["테스트"],
      })
      .mockRejectedValueOnce(new ClassificationError("boom"))
      .mockResolvedValueOnce({
        domain: "가정",
        conflictType: "세대 갈등",
        tone: "온정",
        tags: ["테스트"],
      });
    updateScenario.mockImplementation(async (id, patch) => ({
      ...row(id),
      ...patch,
    }) as ScenarioRow);
    const res = await request(app).post("/api/v1/scenarios/reclassify");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ classified: 2, failed: 1 });
    // Only successful classifications are persisted.
    expect(updateScenario).toHaveBeenCalledTimes(2);
    expect(updateScenario.mock.calls.map((c) => c[0])).toEqual([
      "scenario_a",
      "scenario_c",
    ]);
  });
});

describe("PATCH /api/v1/scenarios/:id (manual classification)", () => {
  const manualBody = {
    classification: {
      domain: "  ",
      conflictType: "조직 갈등",
      tone: "긴장",
      tags: ["테스트"],
    },
  };

  it("returns 400 when the manual classification is invalid", async () => {
    acceptManual.mockRejectedValueOnce(
      new InvalidClassificationError("domain must not be empty."),
    );
    const res = await request(app)
      .patch("/api/v1/scenarios/scenario_a")
      .send(manualBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("domain must not be empty");
    expect(updateScenario).not.toHaveBeenCalled();
  });

  it("persists a normalized manual classification", async () => {
    const normalized = {
      domain: "직장",
      conflictType: "조직 갈등",
      tone: "긴장",
      tags: ["테스트"],
      classifiedBy: "manual",
    };
    acceptManual.mockResolvedValueOnce(normalized);
    updateScenario.mockImplementation(async (id, patch) => ({
      ...row(id),
      ...patch,
      updatedAt: new Date("2026-01-05T00:00:00Z"),
    }) as ScenarioRow);
    const res = await request(app)
      .patch("/api/v1/scenarios/scenario_a")
      .send(manualBody);
    expect(res.status).toBe(200);
    expect(updateScenario).toHaveBeenCalledWith("scenario_a", {
      classification: normalized,
    });
    expect(res.body.classification).toEqual(normalized);
  });
});
