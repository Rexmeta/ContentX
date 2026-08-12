import { Router, type IRouter } from "express";
import { ProjectRoleplayXResponse } from "@workspace/api-zod";
import * as repo from "../domains/content/repository";
import { toContentGraph } from "../domains/content/service";
import { projectToRoleplayX } from "../domains/projection/roleplayxAdapter";

const router: IRouter = Router();

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
    const scenario = projectToRoleplayX(toContentGraph(row));
    res.json(ProjectRoleplayXResponse.parse(scenario));
  },
);

export default router;
