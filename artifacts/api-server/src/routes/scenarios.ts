import { Router, type IRouter } from "express";
import {
  orchestrator,
  checkScenarioCompleteness,
} from "../domains/ai/orchestrator";
import { AmplificationError } from "../domains/ai/llmAmplifier";
import {
  DraftScenarioBody,
  DraftScenarioResponse,
  CreateScenarioBody,
  CreateScenarioResponse,
  UpdateScenarioBody,
  UpdateScenarioResponse,
  ListScenariosResponse,
  GetScenarioResponse,
} from "@workspace/api-zod";
import * as repo from "../domains/scenario/repository";
import { newId } from "../shared/id";
import type { ScenarioRow } from "@workspace/db";
import type { DramaticScenario } from "../domains/ai/scenarioAmplifier";

const router: IRouter = Router();

function pathParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function toRecord(row: ScenarioRow) {
  return {
    id: row.id,
    title: row.title,
    idea: row.idea,
    scenario: row.scenario as DramaticScenario,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.post("/v1/scenarios/draft", async (req, res): Promise<void> => {
  const parsed = DraftScenarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const scenario = await orchestrator.amplify(
      parsed.data.prompt,
      parsed.data.title,
    );
    res.json(DraftScenarioResponse.parse(scenario));
  } catch (err) {
    if (err instanceof AmplificationError) {
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/v1/scenarios", async (_req, res): Promise<void> => {
  const rows = await repo.listScenarios();
  res.json(ListScenariosResponse.parse(rows.map(toRecord)));
});

router.post("/v1/scenarios", async (req, res): Promise<void> => {
  const parsed = CreateScenarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const problem = checkScenarioCompleteness(parsed.data.scenario);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const row = await repo.insertScenario({
    id: newId("scenario"),
    title: parsed.data.scenario.title,
    idea: parsed.data.idea,
    scenario: parsed.data.scenario,
  });
  res.status(201).json(CreateScenarioResponse.parse(toRecord(row)));
});

router.get("/v1/scenarios/:id", async (req, res): Promise<void> => {
  const row = await repo.getScenario(pathParam(req.params["id"]));
  if (!row) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }
  res.json(GetScenarioResponse.parse(toRecord(row)));
});

router.patch("/v1/scenarios/:id", async (req, res): Promise<void> => {
  const parsed = UpdateScenarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!parsed.data.scenario) {
    res.status(400).json({ error: "scenario is required" });
    return;
  }
  const problem = checkScenarioCompleteness(parsed.data.scenario);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const updated = await repo.updateScenario(pathParam(req.params["id"]), {
    title: parsed.data.scenario.title,
    scenario: parsed.data.scenario,
  });
  if (!updated) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }
  res.json(UpdateScenarioResponse.parse(toRecord(updated)));
});

router.delete("/v1/scenarios/:id", async (req, res): Promise<void> => {
  const deleted = await repo.deleteScenario(pathParam(req.params["id"]));
  if (!deleted) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
