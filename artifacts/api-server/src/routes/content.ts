import { Router, type IRouter } from "express";
import {
  orchestrator,
  ScenarioValidationError,
} from "../domains/ai/orchestrator";
import {
  CreateContentBody,
  DraftScenarioBody,
  DraftScenarioResponse,
  UpdateEntityBody,
  UpdateRelationshipBody,
  CreateVersionBody,
  ListContentResponse,
  CreateContentResponse,
  GetContentResponse,
  UpdateEntityResponse,
  UpdateRelationshipResponse,
  ValidateContentResponse,
  ListVersionsResponse,
  CreateVersionResponse,
  ExportContentResponse,
  GetDashboardSummaryResponse,
} from "@workspace/api-zod";
import * as repo from "../domains/content/repository";
import * as service from "../domains/content/service";

const router: IRouter = Router();

function pathParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

router.get("/v1/content", async (_req, res): Promise<void> => {
  const rows = await repo.listContents();
  res.json(ListContentResponse.parse(rows.map(service.toSummary)));
});

router.post("/v1/content", async (req, res): Promise<void> => {
  const parsed = CreateContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let graph;
  try {
    graph = await service.createFromPrompt(
      parsed.data.prompt,
      parsed.data.title,
      parsed.data.scenario,
    );
  } catch (err) {
    if (err instanceof ScenarioValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
  res.status(201).json(CreateContentResponse.parse(graph));
});

router.post("/v1/scenarios/draft", async (req, res): Promise<void> => {
  const parsed = DraftScenarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const scenario = orchestrator.amplify(parsed.data.prompt, parsed.data.title);
  res.json(DraftScenarioResponse.parse(scenario));
});

router.get("/v1/content/:id", async (req, res): Promise<void> => {
  const id = pathParam(req.params["id"]);
  const row = await repo.getContent(id);
  if (!row) {
    res.status(404).json({ error: "Content not found" });
    return;
  }
  res.json(GetContentResponse.parse(service.toContentGraph(row)));
});

router.delete("/v1/content/:id", async (req, res): Promise<void> => {
  const id = pathParam(req.params["id"]);
  const deleted = await repo.deleteContent(id);
  if (!deleted) {
    res.status(404).json({ error: "Content not found" });
    return;
  }
  res.sendStatus(204);
});

router.patch(
  "/v1/content/:id/entities/:entityId",
  async (req, res): Promise<void> => {
    const parsed = UpdateEntityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const graph = await service.updateEntity(
      pathParam(req.params["id"]),
      pathParam(req.params["entityId"]),
      parsed.data,
    );
    if (!graph) {
      res.status(404).json({ error: "Content or entity not found" });
      return;
    }
    res.json(UpdateEntityResponse.parse(graph));
  },
);

router.patch(
  "/v1/content/:id/relationships/:relationshipId",
  async (req, res): Promise<void> => {
    const parsed = UpdateRelationshipBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const result = await service.updateRelationship(
      pathParam(req.params["id"]),
      pathParam(req.params["relationshipId"]),
      parsed.data,
    );
    if (!result) {
      res.status(404).json({ error: "Content or relationship not found" });
      return;
    }
    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(UpdateRelationshipResponse.parse(result));
  },
);

router.post("/v1/content/:id/validate", async (req, res): Promise<void> => {
  const report = await service.validateContent(pathParam(req.params["id"]));
  if (!report) {
    res.status(404).json({ error: "Content not found" });
    return;
  }
  res.json(ValidateContentResponse.parse(report));
});

router.get("/v1/content/:id/versions", async (req, res): Promise<void> => {
  const versions = await repo.listVersions(pathParam(req.params["id"]));
  res.json(ListVersionsResponse.parse(versions.map(service.versionToInfo)));
});

router.post("/v1/content/:id/versions", async (req, res): Promise<void> => {
  const parsed = CreateVersionBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const version = await service.snapshotVersion(
    pathParam(req.params["id"]),
    parsed.data.note,
    parsed.data.author,
  );
  if (!version) {
    res.status(404).json({ error: "Content not found" });
    return;
  }
  res.status(201).json(CreateVersionResponse.parse(version));
});

router.get("/v1/content/:id/export", async (req, res): Promise<void> => {
  const row = await repo.getContent(pathParam(req.params["id"]));
  if (!row) {
    res.status(404).json({ error: "Content not found" });
    return;
  }
  res.json(ExportContentResponse.parse(service.exportCanonical(row)));
});

router.get("/v1/dashboard/summary", async (_req, res): Promise<void> => {
  const summary = await service.dashboardSummary();
  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;
