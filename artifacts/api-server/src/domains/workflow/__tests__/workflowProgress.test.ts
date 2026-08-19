import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Workflow } from "../model";

const amplifyIdeaWithLLM = vi.hoisted(() => vi.fn());
const insertScenario = vi.hoisted(() => vi.fn());

vi.mock("../../ai/llmAmplifier", () => ({
  AmplificationError: class AmplificationError extends Error {},
  amplifyIdeaWithLLM,
}));

vi.mock("../../scenario/repository", () => ({
  insertScenario,
}));

vi.mock("../repository", () => ({
  getWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  updateWorkflowIfUntouched: vi.fn(),
  claimWorkflowStep: vi.fn(),
  updateWorkflowIfRunOwned: vi.fn(),
  touchWorkflowRun: vi.fn(),
  toWorkflow: vi.fn(),
}));

import * as repo from "../repository";
import { HEARTBEAT_MS, runStep } from "../executor";

function workflow(): Workflow {
  return {
    id: "workflow_progress",
    title: "롤플레이 만들기",
    intent: {
      outputType: "roleplay",
      description: "폐쇄된 연구소의 갈등",
      extractedInputs: {},
    },
    artifacts: { idea: "폐쇄된 연구소의 갈등" },
    status: "running",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    steps: [
      {
        id: "input",
        type: "input",
        title: "아이디어를 들려주세요",
        importance: "required",
        status: "complete",
        input: [],
        output: ["idea"],
        dependencies: [],
        binding: { action: "provide_input", api: "—" },
        result: { idea: "폐쇄된 연구소의 갈등" },
        error: null,
      },
      {
        id: "draft",
        type: "generate",
        title: "이야기 초안 만들기",
        importance: "required",
        status: "ready",
        input: ["idea"],
        output: ["scenarioId"],
        dependencies: ["input"],
        binding: { action: "draft_story", api: "POST /v1/scenarios/draft" },
        result: null,
        error: null,
      },
    ],
  };
}

describe("workflow generation progress", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    let state = workflow();
    let revision = 0;

    vi.mocked(repo.getWorkflow).mockImplementation(async () => ({
      ...state,
      createdAt: new Date(state.createdAt),
      updatedAt: new Date(state.updatedAt),
    }) as never);
    vi.mocked(repo.toWorkflow).mockImplementation((row: any) => ({
      ...row,
      createdAt:
        row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt:
        row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    }));
    const persist = async (...args: any[]) => {
      const patch = args.at(-1);
      revision += 1;
      const updatedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, revision));
      state = {
        ...state,
        ...patch,
        updatedAt: updatedAt.toISOString(),
      };
      return {
        ...state,
        createdAt: new Date(state.createdAt),
        updatedAt,
      } as never;
    };
    vi.mocked(repo.claimWorkflowStep).mockImplementation(persist);
    vi.mocked(repo.updateWorkflowIfRunOwned).mockImplementation(persist);

    amplifyIdeaWithLLM.mockImplementation(
      async (
        _idea: string,
        _title: string | undefined,
        _constraints: string | undefined,
        onProgress: (phase: string, label: string) => Promise<void>,
      ) => {
        await onProgress("character-conflict", "인물과 갈등 구성 확인");
        await onProgress("validating", "결과 형식 검증");
        return {
          title: "연구소의 밤",
          logline: "서로 다른 목적을 가진 연구원들이 충돌한다.",
          synopsis: "시놉시스",
          theme: "책임",
          stakes: "연구소의 생존",
          twist: "통제 시스템의 진짜 목적",
          acts: [],
          characters: [],
          sourceIdea: "폐쇄된 연구소의 갈등",
          amplifiedBy: "test",
        };
      },
    );
    insertScenario.mockResolvedValue({ id: "scenario_progress" });
  });

  it("persists safe phases in order and settles them on completion", async () => {
    const result = await runStep({
      workflowId: "workflow_progress",
      stepId: "draft",
    });
    const progress = result.workflow.steps[1]!.progress!;

    expect(progress.events.map((event) => event.phase)).toEqual([
      "preparing",
      "story-outline",
      "character-conflict",
      "validating",
      "saving",
    ]);
    expect(progress.events.every((event) => event.status === "complete")).toBe(
      true,
    );
    expect(result.workflow.steps[1]!.status).toBe("complete");
    expect(result.workflow.artifacts.scenarioId).toBe("scenario_progress");
  });

  it("refreshes the durable run lease during a long action", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.mocked(repo.touchWorkflowRun).mockResolvedValue(true);

    let release!: (value: any) => void;
    amplifyIdeaWithLLM.mockImplementation(
      () => new Promise((resolve) => {
        release = resolve;
      }),
    );

    const running = runStep({
      workflowId: "workflow_progress",
      stepId: "draft",
    });
    await vi.waitFor(() => expect(amplifyIdeaWithLLM).toHaveBeenCalled());

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(repo.touchWorkflowRun).toHaveBeenCalledWith(
      "workflow_progress",
      "draft",
      expect.any(String),
    );

    release({
      title: "연구소의 밤",
      logline: "로그라인",
      synopsis: "시놉시스",
      theme: "책임",
      stakes: "생존",
      twist: "반전",
      acts: [],
      characters: [],
      sourceIdea: "폐쇄된 연구소의 갈등",
      amplifiedBy: "test",
    });
    await running;
  });

  it("stops heartbeats even when failure persistence throws", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.mocked(repo.touchWorkflowRun).mockResolvedValue(true);
    amplifyIdeaWithLLM.mockRejectedValue(new Error("provider failed"));

    const persist = vi.mocked(repo.updateWorkflowIfRunOwned).getMockImplementation()!;
    vi.mocked(repo.updateWorkflowIfRunOwned)
      .mockImplementationOnce(persist)
      .mockRejectedValueOnce(new Error("database unavailable"));

    await expect(
      runStep({ workflowId: "workflow_progress", stepId: "draft" }),
    ).rejects.toThrow("database unavailable");

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
    expect(repo.touchWorkflowRun).not.toHaveBeenCalled();
  });
});