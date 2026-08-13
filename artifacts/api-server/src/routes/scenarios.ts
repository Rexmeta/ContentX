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
  ListCategoriesResponse,
  ClassifyScenarioResponse,
  ReclassifyScenariosResponse,
  ListSimilarScenariosResponse,
  SynthesizeScenarioBody,
  SynthesizeScenarioResponse,
} from "@workspace/api-zod";
import {
  synthesizeWithLLM,
  SynthesisError,
  type Lineage,
  type ScenarioElement,
} from "../domains/scenario/synthesizer";
import {
  validateLineage,
  InvalidLineageError,
} from "../domains/scenario/lineageService";
import * as repo from "../domains/scenario/repository";
import { listCategories } from "../domains/scenario/categoryService";
import {
  classifyScenario,
  acceptManualClassification,
  InvalidClassificationError,
} from "../domains/scenario/classificationService";
import { ClassificationError } from "../domains/scenario/classifier";
import type { Classification } from "../domains/scenario/taxonomy";
import { newId } from "../shared/id";
import type { ScenarioRow } from "@workspace/db";
import type { DramaticScenario } from "../domains/scenario/model";
import { logger } from "../lib/logger";

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
    classification: (row.classification as Classification | null) ?? null,
    lineage: (row.lineage as Lineage | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Classify for the save pipeline: a failure never blocks the save — the
 * scenario is stored explicitly unclassified (classification: null) and the
 * failure is logged.
 */
async function tryClassify(
  scenario: DramaticScenario,
): Promise<Classification | null> {
  try {
    return await classifyScenario(scenario);
  } catch (err) {
    logger.warn(
      { err },
      "Scenario classification failed; saving as unclassified",
    );
    return null;
  }
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

router.get("/v1/categories", async (_req, res): Promise<void> => {
  const rows = await listCategories();
  res.json(
    ListCategoriesResponse.parse(
      rows.map((r) => ({
        id: r.id,
        axis: r.axis,
        name: r.name,
        description: r.description ?? null,
        origin: r.origin,
      })),
    ),
  );
});

router.post("/v1/scenarios/synthesize", async (req, res): Promise<void> => {
  const parsed = SynthesizeScenarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ids = parsed.data.sources.map((s) => s.scenarioId);
  if (new Set(ids).size !== ids.length) {
    res.status(400).json({ error: "Duplicate source scenario ids." });
    return;
  }
  const rows = await Promise.all(ids.map((id) => repo.getScenario(id)));
  const missing = ids.filter((_, i) => !rows[i]);
  if (missing.length > 0) {
    res
      .status(400)
      .json({ error: `Unknown source scenarios: ${missing.join(", ")}` });
    return;
  }
  const sources = parsed.data.sources.map((s, i) => ({
    scenario: rows[i]!.scenario as DramaticScenario,
    elements: s.elements as ScenarioElement[],
  }));
  try {
    const scenario = await synthesizeWithLLM(
      sources,
      parsed.data.instruction,
    );
    // Lineage is server-authoritative: derived from the validated sources.
    const lineage: Lineage = {
      parents: parsed.data.sources.map((s, i) => ({
        scenarioId: s.scenarioId,
        title: rows[i]!.title,
        elements: s.elements as ScenarioElement[],
      })),
      instruction: parsed.data.instruction?.trim() || null,
      synthesizedBy: scenario.amplifiedBy ?? null,
    };
    res.json(SynthesizeScenarioResponse.parse({ scenario, lineage }));
  } catch (err) {
    if (err instanceof SynthesisError) {
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/v1/scenarios/reclassify", async (_req, res): Promise<void> => {
  const rows = await repo.listScenarios();
  let classified = 0;
  let failed = 0;
  for (const row of rows) {
    const classification = await tryClassify(
      row.scenario as DramaticScenario,
    );
    if (classification) {
      await repo.updateScenario(row.id, { classification });
      classified++;
    } else {
      failed++;
    }
  }
  res.json(ReclassifyScenariosResponse.parse({ classified, failed }));
});

router.post("/v1/scenarios/:id/classify", async (req, res): Promise<void> => {
  const row = await repo.getScenario(pathParam(req.params["id"]));
  if (!row) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }
  try {
    const classification = await classifyScenario(
      row.scenario as DramaticScenario,
    );
    const updated = await repo.updateScenario(row.id, { classification });
    if (!updated) {
      res.status(404).json({ error: "Scenario not found" });
      return;
    }
    res.json(ClassifyScenarioResponse.parse(toRecord(updated)));
  } catch (err) {
    if (err instanceof ClassificationError) {
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/v1/scenarios/:id/similar", async (req, res): Promise<void> => {
  const row = await repo.getScenario(pathParam(req.params["id"]));
  if (!row) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }
  const base = row.classification as Classification | null;
  if (!base) {
    res.json(ListSimilarScenariosResponse.parse([]));
    return;
  }
  const all = await repo.listScenarios();
  const similar = all.filter((s) => {
    if (s.id === row.id) return false;
    const c = s.classification as Classification | null;
    if (!c) return false;
    return c.domain === base.domain || c.conflictType === base.conflictType;
  });
  res.json(ListSimilarScenariosResponse.parse(similar.map(toRecord)));
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
  // Lineage on save is server-authoritative: parents must exist, titles and
  // synthesizer identity are rebuilt server-side (no forged provenance).
  let lineage: Lineage | null = null;
  if (parsed.data.lineage) {
    try {
      lineage = await validateLineage(parsed.data.lineage);
    } catch (err) {
      if (err instanceof InvalidLineageError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  }
  const classification = await tryClassify(parsed.data.scenario);
  const row = await repo.insertScenario({
    id: newId("scenario"),
    title: parsed.data.scenario.title,
    idea: parsed.data.idea,
    scenario: parsed.data.scenario,
    classification,
    lineage,
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
  const { scenario, classification: manual } = parsed.data;
  if (!scenario && !manual) {
    res.status(400).json({ error: "scenario or classification is required" });
    return;
  }
  if (scenario) {
    const problem = checkScenarioCompleteness(scenario);
    if (problem) {
      res.status(400).json({ error: problem });
      return;
    }
  }
  // Manual classification override wins (normalized + catalog-registered);
  // otherwise a scenario change triggers auto-classify (failure → explicit
  // unclassified). Classification-only PATCH leaves the scenario untouched.
  let classification: Classification | null | undefined;
  try {
    classification = manual
      ? await acceptManualClassification(manual)
      : scenario
        ? await tryClassify(scenario)
        : undefined;
  } catch (err) {
    if (err instanceof InvalidClassificationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
  const updated = await repo.updateScenario(pathParam(req.params["id"]), {
    ...(scenario ? { title: scenario.title, scenario } : {}),
    ...(classification !== undefined ? { classification } : {}),
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
