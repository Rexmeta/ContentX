import { Router, type IRouter } from "express";
import {
  ListSimulationsResponse,
  RunSimulationBody,
  RunSimulationResponse,
  GetSimulationResponse,
  ListSimulationEventsResponse,
  ListEvaluationsResponse,
  EvaluateSimulationBody,
  EvaluateSimulationResponse,
  GetEvaluationResponse,
  GetEvaluationLineageResponse,
} from "@workspace/api-zod";
import * as simulationService from "../domains/simulation/service";
import * as evaluationService from "../domains/evaluation/service";
import {
  resolveEvaluationLineage,
  LineageBrokenError,
} from "../domains/evaluation/lineageService";
import { EvaluationNotFoundError } from "../domains/evaluation/model";
import {
  InvalidSimulationError,
  PolicyExecutionError,
  SimulationNotFoundError,
} from "../domains/simulation/model";
import { StateConflictError } from "../domains/simulation/repository";
import { SnapshotNotFoundError } from "../domains/character/snapshotModel";
import { AgentNotFoundError } from "../domains/agent/model";

const router: IRouter = Router();

function pathParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function handleDomainError(
  err: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
): boolean {
  if (err instanceof InvalidSimulationError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  if (
    err instanceof SimulationNotFoundError ||
    err instanceof AgentNotFoundError ||
    err instanceof SnapshotNotFoundError
  ) {
    res.status(404).json({ error: err.message });
    return true;
  }
  if (err instanceof StateConflictError) {
    res.status(409).json({ error: err.message });
    return true;
  }
  // Defense in depth: Postgres deadlock (40P01) / serialization (40001)
  // aborts are concurrency conflicts, not server faults — surface as 409.
  const pgCode =
    err instanceof Error
      ? ((err as { code?: string }).code ??
        (err.cause instanceof Error
          ? (err.cause as { code?: string }).code
          : undefined))
      : undefined;
  if (pgCode === "40P01" || pgCode === "40001") {
    res.status(409).json({
      error:
        "Simulation conflicted with a concurrent run; nothing was persisted. Retry.",
    });
    return true;
  }
  if (err instanceof PolicyExecutionError) {
    res.status(502).json({ error: err.message });
    return true;
  }
  return false;
}

router.get("/v1/simulations", async (_req, res): Promise<void> => {
  const simulations = await simulationService.listSimulations();
  res.json(ListSimulationsResponse.parse(simulations));
});

router.post("/v1/simulations", async (req, res): Promise<void> => {
  const parsed = RunSimulationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const simulation = await simulationService.runSimulation(parsed.data);
    res.status(201).json(RunSimulationResponse.parse(simulation));
  } catch (err) {
    if (!handleDomainError(err, res)) throw err;
  }
});

router.get("/v1/simulations/:id", async (req, res): Promise<void> => {
  const simulation = await simulationService.getSimulation(
    pathParam(req.params["id"]),
  );
  if (!simulation) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }
  res.json(GetSimulationResponse.parse(simulation));
});

router.get("/v1/simulations/:id/events", async (req, res): Promise<void> => {
  const events = await simulationService.listEvents(
    pathParam(req.params["id"]),
  );
  if (!events) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }
  res.json(ListSimulationEventsResponse.parse(events));
});

router.get("/v1/evaluations", async (req, res): Promise<void> => {
  const simulationId =
    typeof req.query["simulationId"] === "string"
      ? req.query["simulationId"]
      : undefined;
  const evaluations = await evaluationService.listEvaluations(simulationId);
  res.json(ListEvaluationsResponse.parse(evaluations));
});

router.post("/v1/evaluations", async (req, res): Promise<void> => {
  const parsed = EvaluateSimulationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const evaluations = await evaluationService.evaluateSimulation(parsed.data);
    res.status(201).json(EvaluateSimulationResponse.parse(evaluations));
  } catch (err) {
    if (!handleDomainError(err, res)) throw err;
  }
});

router.get(
  "/v1/evaluations/:id/lineage",
  async (req, res): Promise<void> => {
    try {
      const lineage = await resolveEvaluationLineage(
        pathParam(req.params["id"]),
      );
      res.json(GetEvaluationLineageResponse.parse(lineage));
    } catch (err) {
      if (err instanceof EvaluationNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err instanceof LineageBrokenError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
  },
);

router.get("/v1/evaluations/:id", async (req, res): Promise<void> => {
  const evaluation = await evaluationService.getEvaluation(
    pathParam(req.params["id"]),
  );
  if (!evaluation) {
    res.status(404).json({ error: "Evaluation not found" });
    return;
  }
  res.json(GetEvaluationResponse.parse(evaluation));
});

export default router;
