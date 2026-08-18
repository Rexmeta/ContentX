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

vi.mock("../repository", () => ({
  getWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
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
    expect(workflow.artifacts["idea"]).toBe("우주 정거장 미스터리");
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
