import { Router, type IRouter } from "express";
import {
  ListWorkflowsResponse,
  CreateWorkflowBody,
  CreateWorkflowResponse,
  PlanWorkflowBody,
  PlanWorkflowResponse,
  GetWorkflowResponse,
  UpdateWorkflowBody,
  UpdateWorkflowResponse,
  RunWorkflowStepBody,
  RunWorkflowStepResponse,
} from "@workspace/api-zod";
import * as repo from "../domains/workflow/repository";
import { planWorkflow, IntentInterpretationError } from "../domains/workflow/planner";
import { runStep } from "../domains/workflow/executor";
import {
  InvalidWorkflowError,
  StepDependencyError,
  StepExecutionError,
  StepNotFoundError,
  type OutputIntent,
  type OutputType,
  type WorkflowStep,
} from "../domains/workflow/model";
import { validateWorkflowSteps } from "../domains/workflow/validation";
import { newId } from "../shared/id";

const router: IRouter = Router();

function pathParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

router.get("/v1/workflows", async (_req, res): Promise<void> => {
  const rows = await repo.listWorkflows();
  res.json(ListWorkflowsResponse.parse(rows.map(repo.toWorkflow)));
});

router.post("/v1/workflows", async (req, res): Promise<void> => {
  const parsed = CreateWorkflowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    validateWorkflowSteps(parsed.data.steps as WorkflowStep[]);
  } catch (err) {
    if (err instanceof InvalidWorkflowError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
  const row = await repo.insertWorkflow({
    id: newId("workflow"),
    title: parsed.data.title,
    intent: parsed.data.intent as OutputIntent,
    steps: parsed.data.steps as WorkflowStep[],
  });
  res.status(201).json(CreateWorkflowResponse.parse(repo.toWorkflow(row)));
});

router.post("/v1/workflows/plan", async (req, res): Promise<void> => {
  const parsed = PlanWorkflowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!parsed.data.outputType && !parsed.data.description?.trim()) {
    res.status(400).json({
      error: "outputType 또는 description 중 하나는 필요합니다.",
    });
    return;
  }
  try {
    const workflow = await planWorkflow({
      outputType: parsed.data.outputType as OutputType | undefined,
      description: parsed.data.description,
      existingArtifacts: parsed.data.existingArtifacts as Record<string, string> | undefined,
    });
    res.status(201).json(PlanWorkflowResponse.parse(workflow));
  } catch (err) {
    if (err instanceof IntentInterpretationError) {
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/v1/workflows/:id", async (req, res): Promise<void> => {
  const row = await repo.getWorkflow(pathParam(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  res.json(GetWorkflowResponse.parse(repo.toWorkflow(row)));
});

router.patch("/v1/workflows/:id", async (req, res): Promise<void> => {
  const parsed = UpdateWorkflowBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const patch: Parameters<typeof repo.updateWorkflow>[1] = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.steps !== undefined) {
    try {
      validateWorkflowSteps(parsed.data.steps as WorkflowStep[]);
    } catch (err) {
      if (err instanceof InvalidWorkflowError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
    patch.steps = parsed.data.steps as WorkflowStep[];
  }
  if (parsed.data.artifacts !== undefined) {
    patch.artifacts = parsed.data.artifacts;
  }
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "빈 업데이트입니다." });
    return;
  }
  const row = await repo.updateWorkflow(pathParam(req.params.id), patch);
  if (!row) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  res.json(UpdateWorkflowResponse.parse(repo.toWorkflow(row)));
});

router.delete("/v1/workflows/:id", async (req, res): Promise<void> => {
  const deleted = await repo.deleteWorkflow(pathParam(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  res.status(204).end();
});

router.post(
  "/v1/workflows/:id/steps/:stepId/run",
  async (req, res): Promise<void> => {
    const parsed = RunWorkflowStepBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const { workflow } = await runStep({
        workflowId: pathParam(req.params.id),
        stepId: pathParam(req.params.stepId),
        params: parsed.data.params,
      });
      res.json(RunWorkflowStepResponse.parse(workflow));
    } catch (err) {
      if (err instanceof StepNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      if (
        err instanceof InvalidWorkflowError ||
        err instanceof StepDependencyError
      ) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (err instanceof StepExecutionError) {
        res.status(502).json({ error: err.message });
        return;
      }
      req.log.error({ err }, "workflow step execution failed");
      res.status(502).json({
        error: err instanceof Error ? err.message : "step execution failed",
      });
      return;
    }
  },
);

export default router;
