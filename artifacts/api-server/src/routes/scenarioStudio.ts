import { Router, type IRouter } from "express";
import {
  CommitScenarioGraphBody,
  CommitScenarioGraphResponse,
  ComposeScenarioGraphBody,
  ResearchScenarioMaterialBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { commitGraph } from "../domains/content/service";
import { researchScenarioMaterial } from "../domains/scenario/studioResearch";
import { composeScenarioGraph, scenarioDraftProblem } from "../domains/scenario/studioComposition";

const router: IRouter = Router();

router.post("/v1/scenario-studio/research", async (req, res): Promise<void> => {
  const parsed = ResearchScenarioMaterialBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.industry.trim() || !parsed.data.organization.trim()) {
    res.status(400).json({ error: "산업과 조직을 입력하세요." });
    return;
  }
  try {
    res.json(await researchScenarioMaterial(parsed.data));
  } catch (err) {
    logger.warn({ err }, "Scenario research failed");
    res.status(502).json({ error: "소재 후보를 생성하지 못했습니다. 다시 시도하거나 직접 설정을 입력하세요." });
  }
});

router.post("/v1/scenario-studio/draft", async (req, res): Promise<void> => {
  const parsed = ComposeScenarioGraphBody.safeParse(req.body);
  if (!parsed.success || (!parsed.data.candidates.length && !parsed.data.direction.trim())) {
    res.status(400).json({ error: "소재를 선택하거나 작성 방향을 입력하세요." });
    return;
  }
  try {
    res.json(await composeScenarioGraph(parsed.data));
  } catch (err) {
    logger.warn({ err }, "Scenario graph composition failed");
    res.status(502).json({ error: "그래프 초안을 만들지 못했습니다. 설정을 확인하고 다시 시도하세요." });
  }
});

router.post("/v1/scenario-studio/commit", async (req, res): Promise<void> => {
  const parsed = CommitScenarioGraphBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "그래프 입력 형식이 올바르지 않습니다." });
    return;
  }
  const draft = parsed.data;
  const problem = scenarioDraftProblem(draft);
  if (problem) {
    res.status(422).json({ error: problem });
    return;
  }
  const graph = await commitGraph(draft.sourcePrompt, {
    entities: draft.entities,
    relationships: draft.relationships,
    provenance: { operation: "scenario_studio", createdAt: new Date().toISOString(), sourceType: "ai_assisted_authoring" },
  }, draft.title);
  res.status(201).json(CommitScenarioGraphResponse.parse(graph));
});

export default router;
