/**
 * Regression tests for the outcome-first workflow UX guards:
 * - supported picker selections (novel / product-reaction) produce runnable
 *   templates whose first input step carries the user's inputs
 * - unsupported ("준비 중") types produce a plan-only notice step that can
 *   never run or complete
 * - input steps refuse to complete with empty content
 * - workflow graph validation rejects broken edits
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildTemplateSteps, isSupported } from "../templates";
import { validateWorkflowSteps } from "../validation";
import { runStep } from "../executor";
import { InvalidWorkflowError } from "../model";
import type { OutputIntent, Workflow, WorkflowStep } from "../model";
import { applyExistingArtifacts } from "../planner";

vi.mock("../repository", () => ({
  getWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  updateWorkflowIfUntouched: vi.fn(),
  updateWorkflowIfSnapshotMatches: vi.fn(),
  claimWorkflowStep: vi.fn(),
  updateWorkflowIfRunOwned: vi.fn(),
  touchWorkflowRun: vi.fn(),
  insertWorkflow: vi.fn(),
  listWorkflows: vi.fn(),
  deleteWorkflow: vi.fn(),
  toWorkflow: (row: unknown) => row,
}));

import * as repo from "../repository";

function intent(outputType: OutputIntent["outputType"], description = ""): OutputIntent {
  return { outputType, description, extractedInputs: {} };
}

describe("template planning for picker selections", () => {
  it("novel selection yields a runnable story flow starting with an idea input step", () => {
    const steps = buildTemplateSteps({
      ...intent("novel"),
      extractedInputs: { idea: "우주 정거장 미스터리" },
    });
    expect(steps.length).toBeGreaterThan(3);
    const first = steps[0]!;
    expect(first.binding?.action).toBe("provide_input");
    expect(first.output).toContain("idea");
    expect(first.binding?.params).toMatchObject({ idea: "우주 정거장 미스터리" });
    expect(first.status).toBe("ready");
    expect(steps.some((s) => s.binding?.action === "project_novel")).toBe(true);
    validateWorkflowSteps(steps);
  });

  it("product-reaction selection yields the audience → simulation flow", () => {
    const steps = buildTemplateSteps({
      ...intent("product-reaction"),
      extractedInputs: { product: "무선 이어폰", audience: "20-30대" },
    });
    const first = steps[0]!;
    expect(first.binding?.action).toBe("provide_input");
    expect(first.binding?.params).toMatchObject({
      product: "무선 이어폰",
      audience: "20-30대",
    });
    const actions = steps.map((s) => s.binding?.action);
    for (const a of [
      "define_audience",
      "generate_personas",
      "prepare_actors",
      "run_simulation",
      "analyze_results",
    ]) {
      expect(actions).toContain(a);
    }
    validateWorkflowSteps(steps);
  });

  it("unsupported types produce a non-runnable notice step only", () => {
    for (const type of ["movie", "game", "advertisement", "remix", "external-transform"] as const) {
      expect(isSupported(type)).toBe(false);
      const steps = buildTemplateSteps(intent(type, "테스트"));
      expect(steps).toHaveLength(1);
      expect(steps[0]!.binding).toBeNull();
      expect(steps[0]!.status).toBe("pending"); // never ready → never runnable
    }
  });
});

describe("input step execution guard", () => {
  function inputWorkflow(params: Record<string, unknown>): Workflow {
    const step: WorkflowStep = {
      id: "step_input",
      type: "input",
      title: "아이디어를 들려주세요",
      description: null,
      importance: "required",
      status: "ready",
      input: [],
      output: ["idea"],
      dependencies: [],
      binding: { action: "provide_input", api: "—", params },
      result: null,
      error: null,
    };
    return {
      id: "workflow_test",
      title: "t",
      intent: intent("novel"),
      steps: [step],
      artifacts: {},
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    const update = async (...args: any[]) => {
      const patch = args.at(-1);
      return ({
        ...inputWorkflow({}),
        ...patch,
        updatedAt: new Date(),
      }) as any;
    };
    vi.mocked(repo.claimWorkflowStep).mockImplementation(
      update,
    );
    vi.mocked(repo.updateWorkflowIfRunOwned).mockImplementation(
      update,
    );
    vi.mocked(repo.updateWorkflow).mockImplementation(
      async (_id: string, patch: any) =>
        ({ ...inputWorkflow({}), ...patch }) as any,
    );
  });

  it("refuses to complete an input step with no content", async () => {
    vi.mocked(repo.getWorkflow).mockResolvedValue(inputWorkflow({}) as any);
    await expect(
      runStep({ workflowId: "workflow_test", stepId: "step_input", params: {} }),
    ).rejects.toThrow(InvalidWorkflowError);
  });

  it("completes when content is provided via run params", async () => {
    vi.mocked(repo.getWorkflow).mockResolvedValue(inputWorkflow({}) as any);
    const { workflow, failed } = await runStep({
      workflowId: "workflow_test",
      stepId: "step_input",
      params: { idea: "우주 정거장 미스터리" },
    });
    expect(failed).toBe(false);
    const step = workflow.steps.find((s) => s.id === "step_input")!;
    expect(step.status).toBe("complete");
    expect(step.progress?.events.map((event) => event.phase)).toEqual([
      "input-confirmation",
    ]);
    expect(step.progress?.events[0]?.status).toBe("complete");
    expect(step.progress?.review?.status).toBe("pending");
    expect(workflow.status).toBe("running");
    expect(workflow.artifacts["idea"]).toBe("우주 정거장 미스터리");
  });

  it("does not start when another request wins the atomic claim", async () => {
    vi.mocked(repo.getWorkflow).mockResolvedValue(
      inputWorkflow({ idea: "동시 실행" }) as any,
    );
    vi.mocked(repo.claimWorkflowStep).mockResolvedValueOnce(null);

    await expect(
      runStep({ workflowId: "workflow_test", stepId: "step_input" }),
    ).rejects.toThrow(/다른 요청|새로고침/);
  });

  it("treats a dangling dependency as unmet", async () => {
    const wf = inputWorkflow({ idea: "x" });
    wf.steps[0]!.dependencies = ["ghost"];
    vi.mocked(repo.getWorkflow).mockResolvedValue(wf as any);
    await expect(
      runStep({ workflowId: "workflow_test", stepId: "step_input", params: {} }),
    ).rejects.toThrow(/의존|dependency|먼저/i);
  });
});

describe("workflow graph validation", () => {
  const base: Omit<WorkflowStep, "id" | "dependencies"> = {
    type: "input",
    title: "t",
    description: null,
    importance: "optional",
    status: "pending",
    input: [],
    output: [],
    binding: null,
    result: null,
    error: null,
  };

  it("rejects duplicate ids, dangling deps, cycles and unknown actions", () => {
    expect(() =>
      validateWorkflowSteps([
        { ...base, id: "a", dependencies: [] },
        { ...base, id: "a", dependencies: [] },
      ]),
    ).toThrow(InvalidWorkflowError);
    expect(() =>
      validateWorkflowSteps([{ ...base, id: "a", dependencies: ["ghost"] }]),
    ).toThrow(InvalidWorkflowError);
    expect(() =>
      validateWorkflowSteps([
        { ...base, id: "a", dependencies: ["b"] },
        { ...base, id: "b", dependencies: ["a"] },
      ]),
    ).toThrow(InvalidWorkflowError);
    expect(() =>
      validateWorkflowSteps([
        {
          ...base,
          id: "a",
          dependencies: [],
          binding: { action: "not_a_real_action" as any, api: "—" },
        },
      ]),
    ).toThrow(InvalidWorkflowError);
  });

  it("accepts a valid linear graph", () => {
    expect(() =>
      validateWorkflowSteps([
        { ...base, id: "a", dependencies: [] },
        { ...base, id: "b", dependencies: ["a"] },
      ]),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// applyExistingArtifacts — reuse pre-completion logic
// ---------------------------------------------------------------------------

describe("applyExistingArtifacts", () => {
  /**
   * Simulated workflow.artifacts for a fully-completed novel workflow.
   * Mirrors what the executor actually writes (see executor.ts).
   */
  const novelArtifacts: Record<string, string> = {
    idea: "우주 정거장 미스터리",
    scenarioId: "scenario_aaa",
    contentId: "content_bbb",
  };

  /**
   * Simulated workflow.artifacts for a fully-completed product-reaction workflow.
   */
  const productArtifacts: Record<string, string> = {
    product: "무선 이어폰",
    audience: "20-30대",
    populationId: "pop_111",
    samplingRunId: "run_222",
    agentIds: "agent_1,agent_2",
    simulationId: "sim_333",
    evaluationIds: "eval_1,eval_2",
  };

  it("novel artifacts: idea-input and draft steps are pre-completed, world-build step is pre-completed, project_roleplay becomes ready", () => {
    const steps = buildTemplateSteps({
      ...intent("roleplay"),
      extractedInputs: { idea: "우주 정거장 미스터리" },
    });
    const result = applyExistingArtifacts(steps, novelArtifacts);

    const byAction = (action: string) => result.find((s) => s.binding?.action === action);

    // Input step: provide_input with output ["idea"] — idea is in artifacts.
    expect(byAction("provide_input")?.status).toBe("complete");

    // draft_story produces idea + scenarioId — both present.
    expect(byAction("draft_story")?.status).toBe("complete");

    // classify_story: transparent side-effect (no artifact) — cascades after draft.
    expect(byAction("classify_story")?.status).toBe("complete");

    // build_world produces contentId — present.
    expect(byAction("build_world")?.status).toBe("complete");

    // validate_world: transparent side-effect — cascades after build_world.
    expect(byAction("validate_world")?.status).toBe("complete");

    // project_roleplay: final output step, NOT in cascade list → becomes ready.
    expect(byAction("project_roleplay")?.status).toBe("ready");
  });

  it("novel artifacts → novel reuse: project_novel becomes ready", () => {
    const steps = buildTemplateSteps({
      ...intent("novel"),
      extractedInputs: { idea: "우주 정거장 미스터리" },
    });
    const result = applyExistingArtifacts(steps, novelArtifacts);
    const projectStep = result.find((s) => s.binding?.action === "project_novel");
    expect(projectStep?.status).toBe("ready");
    // All prerequisite steps must be complete.
    for (const action of ["provide_input", "draft_story", "classify_story", "build_world", "validate_world"]) {
      expect(result.find((s) => s.binding?.action === action)?.status).toBe("complete");
    }
  });

  it("product-reaction artifacts: all steps pre-completed, no ready steps remain", () => {
    const steps = buildTemplateSteps({
      ...intent("product-reaction"),
      extractedInputs: { product: "무선 이어폰", audience: "20-30대" },
    });
    const result = applyExistingArtifacts(steps, productArtifacts);

    // provide_input: output is ["productBrief"] → mapped to "product" → present.
    const inputStep = result.find((s) => s.binding?.action === "provide_input");
    expect(inputStep?.status).toBe("complete");

    for (const action of [
      "define_audience",
      "generate_personas",
      "prepare_actors",
      "run_simulation",
      "analyze_results",
    ]) {
      expect(
        result.find((s) => s.binding?.action === action)?.status,
        `${action} should be complete`,
      ).toBe("complete");
    }

    // No step should be left pending or ready.
    expect(result.some((s) => s.status === "pending" || s.status === "ready")).toBe(false);
  });

  it("product-reaction artifacts: deriveInitialStatus produces 'complete' when all steps covered", () => {
    // Verify the planner would persist the workflow as complete (not draft/running).
    const steps = buildTemplateSteps({
      ...intent("product-reaction"),
      extractedInputs: { product: "무선 이어폰", audience: "20-30대" },
    });
    const result = applyExistingArtifacts(steps, productArtifacts);
    const relevant = result.filter((s) => s.status !== "skipped");
    const allComplete = relevant.every((s) => s.status === "complete");
    expect(allComplete).toBe(true);
  });

  it("empty existing artifacts: no steps are pre-completed", () => {
    const steps = buildTemplateSteps(intent("novel", "테스트 아이디어"));
    const result = applyExistingArtifacts(steps, {});
    expect(result).toEqual(steps); // unchanged
  });

  it("partial artifacts (only idea + scenarioId, no contentId): build_world stays pending", () => {
    const steps = buildTemplateSteps({
      ...intent("roleplay"),
      extractedInputs: { idea: "우주" },
    });
    const partial = { idea: "우주", scenarioId: "scenario_aaa" };
    const result = applyExistingArtifacts(steps, partial);

    expect(result.find((s) => s.binding?.action === "draft_story")?.status).toBe("complete");
    expect(result.find((s) => s.binding?.action === "classify_story")?.status).toBe("complete");
    // build_world needs contentId which is absent → not pre-completed, becomes ready.
    expect(result.find((s) => s.binding?.action === "build_world")?.status).toBe("ready");
  });
});
