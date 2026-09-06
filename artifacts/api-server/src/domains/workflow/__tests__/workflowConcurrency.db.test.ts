/**
 * Real PostgreSQL concurrency coverage for workflow execution.
 *
 * These tests intentionally use the workflow repository and Express routes
 * without mocking the database. They are skipped when DATABASE_URL is absent.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { pool, type WorkflowRow } from "@workspace/db";
import app from "../../../app";
import * as scenarioRepo from "../../scenario/repository";
import * as repo from "../repository";
import { recoverStaleRun, runStep, STALE_RUNNING_MS } from "../executor";
import type { WorkflowStep } from "../model";

const amplifyIdeaWithLLM = vi.hoisted(() => vi.fn());

vi.mock("../../ai/llmAmplifier", () => ({
  AmplificationError: class AmplificationError extends Error {},
  amplifyIdeaWithLLM,
}));

const hasDb = Boolean(process.env["DATABASE_URL"]);
const d = hasDb ? describe : describe.skip;
const runTag = `workflow-concurrency-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;
const createdWorkflowIds = new Set<string>();
const createdScenarioIds = new Set<string>();

function inputStep(
  id: string,
  status: WorkflowStep["status"] = "ready",
): WorkflowStep {
  return {
    id,
    type: "input",
    title: id,
    description: null,
    importance: "required",
    status,
    input: [],
    output: ["value"],
    dependencies: [],
    binding: { action: "provide_input", api: "—" },
    result: null,
    error: null,
  };
}

function draftStep(id: string): WorkflowStep {
  return {
    id,
    type: "generate",
    title: id,
    description: null,
    importance: "required",
    status: "ready",
    input: ["idea"],
    output: ["scenarioId"],
    dependencies: ["input"],
    binding: { action: "draft_story", api: "POST /v1/scenarios/draft" },
    result: null,
    error: null,
  };
}

async function createWorkflow(
  steps: WorkflowStep[],
  artifacts: Record<string, string> = {},
): Promise<WorkflowRow> {
  const row = await repo.insertWorkflow({
    id: `${runTag}-${createdWorkflowIds.size}`,
    title: "동시성 검증 워크플로",
    intent: {
      outputType: "novel",
      description: "동시성 검증",
      extractedInputs: {},
    },
    steps,
    artifacts,
    status: "draft",
  });
  createdWorkflowIds.add(row.id);
  return row;
}

function workflowSteps(row: WorkflowRow | null): WorkflowStep[] {
  return (row?.steps as WorkflowStep[] | undefined) ?? [];
}

function runningStep(id: string, runId: string): WorkflowStep {
  const step = inputStep(id, "running");
  step.progress = {
    runId,
    startedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    events: [],
    checkpoints: [],
    review: null,
  };
  return step;
}

async function createStaleRunningWorkflow(): Promise<WorkflowRow> {
  const row = await createWorkflow([runningStep("input", "stale-run")]);
  const staleAt = new Date(Date.now() - STALE_RUNNING_MS - 60_000);
  await pool.query(
    `UPDATE workflows SET status = 'running', updated_at = $2 WHERE id = $1`,
    [row.id, staleAt],
  );
  return (await repo.getWorkflow(row.id))!;
}

async function raceAfterRowLock<T, U>(
  workflowId: string,
  first: () => Promise<T>,
  second: () => Promise<U>,
): Promise<[T, U]> {
  const blocker = await pool.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM workflows WHERE id = $1 FOR UPDATE", [
      workflowId,
    ]);
    const firstResult = first();
    await new Promise((resolve) => setTimeout(resolve, 25));
    const secondResult = second();
    await new Promise((resolve) => setTimeout(resolve, 25));
    await blocker.query("COMMIT");
    return await Promise.all([firstResult, secondResult]);
  } catch (error) {
    await blocker.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    blocker.release();
  }
}

const scenario = {
  title: "경합 테스트 이야기",
  logline: "동시에 시작된 실행 중 하나만 저장된다.",
  synopsis: "동시성 회귀 테스트용 시놉시스",
  theme: "신뢰",
  stakes: "상태 보존",
  twist: "원자적 claim",
  acts: [],
  characters: [],
  sourceIdea: "동시성 회귀 테스트",
  amplifiedBy: "workflow-concurrency-test",
};

afterEach(async () => {
  amplifyIdeaWithLLM.mockReset();
  if (createdWorkflowIds.size > 0) {
    await pool.query("DELETE FROM workflows WHERE id = ANY($1::text[])", [
      [...createdWorkflowIds],
    ]);
  }
  for (const id of createdScenarioIds) {
    await scenarioRepo.deleteScenario(id).catch(() => false);
  }
  createdWorkflowIds.clear();
  createdScenarioIds.clear();
});

d("workflow concurrency (real PostgreSQL)", () => {
  it("does not let stale recovery overwrite a completion that wins the row race", async () => {
    const observed = await createStaleRunningWorkflow();
    const completedSteps = structuredClone(observed.steps) as WorkflowStep[];
    completedSteps[0]!.status = "complete";
    completedSteps[0]!.result = { value: "완료 결과" };

    const [completion, recovered] = await raceAfterRowLock(
      observed.id,
      () =>
        repo.updateWorkflowIfRunOwned(
          observed.id,
          "input",
          "stale-run",
          { steps: completedSteps, artifacts: { value: "완료 결과" }, status: "complete" },
        ),
      () => recoverStaleRun(observed),
    );

    expect(completion).not.toBeNull();
    expect(recovered).toBe(false);
    const current = await repo.getWorkflow(observed.id);
    expect(current?.status).toBe("complete");
    expect(workflowSteps(current)[0]).toMatchObject({
      status: "complete",
      result: { value: "완료 결과" },
    });
  });

  it("keeps a retryable failure when stale recovery wins the row race", async () => {
    const observed = await createStaleRunningWorkflow();
    const completedSteps = structuredClone(observed.steps) as WorkflowStep[];
    completedSteps[0]!.status = "complete";

    const [recovered, completion] = await raceAfterRowLock(
      observed.id,
      () => recoverStaleRun(observed),
      () =>
        repo.updateWorkflowIfRunOwned(
          observed.id,
          "input",
          "stale-run",
          { steps: completedSteps, status: "complete" },
        ),
    );

    expect(recovered).toBe(true);
    expect(completion).toBeNull();
    const current = await repo.getWorkflow(observed.id);
    expect(current?.status).toBe("failed");
    expect(workflowSteps(current)[0]).toMatchObject({
      status: "failed",
      error: expect.stringContaining("다시 실행"),
    });
  });

  it("allows only one of two simultaneous ready steps to own the workflow", async () => {
    let release!: (value: typeof scenario) => void;
    amplifyIdeaWithLLM.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    const row = await createWorkflow(
      [
        inputStep("input", "complete"),
        draftStep("draft-a"),
        draftStep("draft-b"),
      ],
      { idea: "동시 실행 아이디어" },
    );

    const first = runStep({
      workflowId: row.id,
      stepId: "draft-a",
    });
    const second = runStep({
      workflowId: row.id,
      stepId: "draft-b",
    });
    // Observe both promises immediately: the losing claim may reject before
    // the winning action is released below.
    const resultsPromise = Promise.allSettled([first, second]);

    await vi.waitFor(() => expect(amplifyIdeaWithLLM).toHaveBeenCalledTimes(1));
    const running = await repo.getWorkflow(row.id);
    expect(
      workflowSteps(running).filter((step) => step.status === "running"),
    ).toHaveLength(1);

    release(scenario);
    const results = await resultsPromise;
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const completed = await repo.getWorkflow(row.id);
    expect(
      workflowSteps(completed).filter((step) => step.status === "complete"),
    ).toHaveLength(2);
    expect(
      workflowSteps(completed).filter((step) => step.status === "failed"),
    ).toHaveLength(0);
    const scenarioId = (completed?.artifacts as Record<string, string>)?.scenarioId;
    expect(scenarioId).toBeTruthy();
    createdScenarioIds.add(scenarioId!);
  });

  it.each(["steps", "artifacts"] as const)(
    "rejects a stale execution snapshot after a %s edit",
    async (editedField) => {
      const row = await createWorkflow([inputStep("input")]);
      const observed = await repo.getWorkflow(row.id);
      expect(observed).not.toBeNull();

      if (editedField === "steps") {
        const steps = structuredClone(observed!.steps) as WorkflowStep[];
        steps[0]!.title = "사용자가 방금 편집한 단계";
        expect(await repo.updateWorkflow(row.id, { steps })).not.toBeNull();
      } else {
        expect(
          await repo.updateWorkflow(row.id, {
            artifacts: { ...(observed!.artifacts as Record<string, string>), edited: "true" },
          }),
        ).not.toBeNull();
      }

      const staleSteps = structuredClone(observed!.steps) as WorkflowStep[];
      staleSteps[0]!.status = "running";
      const claimed = await repo.claimWorkflowStep(
        row.id,
        "input",
        "ready",
        {
          updatedAt: observed!.updatedAt,
          steps: observed!.steps as WorkflowStep[],
          artifacts: observed!.artifacts as Record<string, string>,
          status: observed!.status as "draft" | "running" | "complete" | "failed",
        },
        { steps: staleSteps, status: "running" },
      );

      expect(claimed).toBeNull();
      const current = await repo.getWorkflow(row.id);
      expect(workflowSteps(current)[0]?.status).toBe("ready");
    },
  );

  it("returns 409 for PATCH and DELETE while running, then permits both after completion", async () => {
    let release!: (value: typeof scenario) => void;
    amplifyIdeaWithLLM.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const row = await createWorkflow(
      [inputStep("input", "complete"), draftStep("draft")],
      { idea: "라우트 경합 아이디어" },
    );

    const running = request(app)
      .post(`/api/v1/workflows/${row.id}/steps/draft/run`)
      .send({})
      .then((response) => response);
    await vi.waitFor(() => expect(amplifyIdeaWithLLM).toHaveBeenCalledTimes(1));

    const patchWhileRunning = await request(app)
      .patch(`/api/v1/workflows/${row.id}`)
      .send({ title: "실행 중 편집" });
    expect(patchWhileRunning.status).toBe(409);

    const deleteWhileRunning = await request(app).delete(
      `/api/v1/workflows/${row.id}`,
    );
    expect(deleteWhileRunning.status).toBe(409);

    release(scenario);
    const completed = await running;
    expect(completed.status).toBe(200);
    const scenarioId = completed.body.artifacts.scenarioId as string;
    createdScenarioIds.add(scenarioId);

    const patchAfterCompletion = await request(app)
      .patch(`/api/v1/workflows/${row.id}`)
      .send({ title: "완료 후 편집" });
    expect(patchAfterCompletion.status).toBe(200);

    const deleteAfterCompletion = await request(app).delete(
      `/api/v1/workflows/${row.id}`,
    );
    expect(deleteAfterCompletion.status).toBe(204);
    createdWorkflowIds.delete(row.id);
  });
});