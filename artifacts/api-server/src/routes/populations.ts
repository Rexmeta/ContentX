import { Router, type IRouter } from "express";
import {
  ListPopulationsResponse,
  CreatePopulationBody,
  CreatePopulationResponse,
  GetPopulationResponse,
  ListDependencyRulesResponse,
  CreateDependencyRuleBody,
  CreateDependencyRuleResponse,
  SamplePopulationBody,
  SamplePopulationResponse,
  GetSamplingRunResponse,
  ListSamplingRunsResponse,
} from "@workspace/api-zod";
import * as populationService from "../domains/population/service";
import {
  InvalidPopulationError,
  PopulationNotFoundError,
} from "../domains/population/service";
import { InvalidCharacterError } from "../domains/character/service";
import type {
  Distribution,
  RuleCondition,
  RuleEffect,
  SamplingStrategy,
  TargetDistribution,
} from "../domains/population/model";

const router: IRouter = Router();

function pathParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function handleDomainError(err: unknown, res: {
  status: (code: number) => { json: (body: unknown) => void };
}): boolean {
  if (
    err instanceof InvalidPopulationError ||
    err instanceof InvalidCharacterError
  ) {
    res.status(400).json({ error: err.message });
    return true;
  }
  if (err instanceof PopulationNotFoundError) {
    res.status(404).json({ error: err.message });
    return true;
  }
  return false;
}

router.get("/v1/populations", async (_req, res): Promise<void> => {
  const populations = await populationService.listPopulations();
  res.json(ListPopulationsResponse.parse(populations));
});

router.post("/v1/populations", async (req, res): Promise<void> => {
  const parsed = CreatePopulationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const population = await populationService.createPopulation({
      ...parsed.data,
      distributions: parsed.data.distributions as Record<string, Distribution>,
    });
    res.status(201).json(CreatePopulationResponse.parse(population));
  } catch (err) {
    if (!handleDomainError(err, res)) throw err;
  }
});

router.get("/v1/populations/:id", async (req, res): Promise<void> => {
  const population = await populationService.getPopulation(
    pathParam(req.params["id"]),
  );
  if (!population) {
    res.status(404).json({ error: "Population not found" });
    return;
  }
  res.json(GetPopulationResponse.parse(population));
});

router.delete("/v1/populations/:id", async (req, res): Promise<void> => {
  const deleted = await populationService.deletePopulation(
    pathParam(req.params["id"]),
  );
  if (!deleted) {
    res.status(404).json({ error: "Population not found" });
    return;
  }
  res.sendStatus(204);
});

router.get(
  "/v1/populations/:id/dependencies",
  async (req, res): Promise<void> => {
    try {
      const rules = await populationService.listDependencyRules(
        pathParam(req.params["id"]),
      );
      res.json(ListDependencyRulesResponse.parse(rules));
    } catch (err) {
      if (!handleDomainError(err, res)) throw err;
    }
  },
);

router.post("/v1/dependencies", async (req, res): Promise<void> => {
  const parsed = CreateDependencyRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const rule = await populationService.createDependencyRule({
      ...parsed.data,
      conditions: parsed.data.conditions as RuleCondition[],
      effect: parsed.data.effect as RuleEffect,
    });
    res.status(201).json(CreateDependencyRuleResponse.parse(rule));
  } catch (err) {
    if (!handleDomainError(err, res)) throw err;
  }
});

router.delete("/v1/dependencies/:id", async (req, res): Promise<void> => {
  const deleted = await populationService.deleteDependencyRule(
    pathParam(req.params["id"]),
  );
  if (!deleted) {
    res.status(404).json({ error: "Dependency rule not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/v1/sampling", async (req, res): Promise<void> => {
  const parsed = SamplePopulationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const { run } = await populationService.samplePopulation({
      ...parsed.data,
      strategy: parsed.data.strategy as SamplingStrategy,
      targetDistribution:
        (parsed.data.targetDistribution as TargetDistribution | undefined) ??
        null,
    });
    res.status(201).json(SamplePopulationResponse.parse(run));
  } catch (err) {
    if (!handleDomainError(err, res)) throw err;
  }
});

router.get("/v1/sampling/:id", async (req, res): Promise<void> => {
  const run = await populationService.getSamplingRun(
    pathParam(req.params["id"]),
  );
  if (!run) {
    res.status(404).json({ error: "Sampling run not found" });
    return;
  }
  res.json(GetSamplingRunResponse.parse(run));
});

router.get(
  "/v1/populations/:id/sampling",
  async (req, res): Promise<void> => {
    try {
      const runs = await populationService.listSamplingRuns(
        pathParam(req.params["id"]),
      );
      res.json(ListSamplingRunsResponse.parse(runs));
    } catch (err) {
      if (!handleDomainError(err, res)) throw err;
    }
  },
);

export default router;
