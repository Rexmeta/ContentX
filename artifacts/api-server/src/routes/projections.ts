import { Router, type IRouter } from "express";
import {
  CreateProjectionBody,
  CreateProjectionResponse,
  ProjectRoleplayXResponse,
} from "@workspace/api-zod";
import * as repo from "../domains/content/repository";
import { toContentGraph } from "../domains/content/service";
import { projectToRoleplayX } from "../domains/projection/roleplayxAdapter";
import * as projectionService from "../domains/projection/service";
import {
  InvalidProjectionError,
  ProjectionExecutionError,
} from "../domains/projection/contract";
import { SimulationNotFoundError } from "../domains/simulation/model";

const router: IRouter = Router();

router.post("/v1/projections", async (req, res): Promise<void> => {
  const parsed = CreateProjectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const result = await projectionService.project(parsed.data);
    res.json(CreateProjectionResponse.parse(result));
  } catch (err) {
    if (err instanceof InvalidProjectionError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (
      err instanceof projectionService.ContentNotFoundError ||
      err instanceof SimulationNotFoundError
    ) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof ProjectionExecutionError) {
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get(
  "/v1/projections/roleplayx/:id",
  async (req, res): Promise<void> => {
    const raw = req.params["id"];
    const id = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
    const row = await repo.getContent(id);
    if (!row) {
      res.status(404).json({ error: "Content not found" });
      return;
    }
    const scenario = await projectToRoleplayX(toContentGraph(row));
    res.json(ProjectRoleplayXResponse.parse(scenario));
  },
);

export default router;
