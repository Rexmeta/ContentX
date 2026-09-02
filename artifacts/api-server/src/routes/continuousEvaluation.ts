import { Router } from "express";
import {
  AgentVersionSchema,
  type SimulationSpec,
} from "@workspace/simulation-contract";
import { agentVersionRegistry } from "../domains/evaluation/continuous/agentVersionRegistry";
import { evaluationJobService } from "../domains/evaluation/continuous/evaluationJobService";
import { simulationSpecService } from "../domains/simulation/specService";

const router = Router();

// POST /v1/agent-versions — Register a new version of an AI Agent
router.post("/v1/agent-versions", (req, res) => {
  try {
    const { agentId, version, endpoint, metadata, status } = req.body || {};
    if (!agentId || !version || !endpoint) {
      res.status(400).json({ error: "agentId, version, and endpoint are required" });
      return;
    }

    const reg = agentVersionRegistry.registerVersion({
      agentId,
      version,
      endpoint,
      metadata,
      status,
    });

    res.status(201).json(reg);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Version registration failed";
    res.status(500).json({ error: message });
  }
});

// GET /v1/agent-versions — List agent versions
router.get("/v1/agent-versions", (req, res) => {
  const agentId = req.query.agentId as string;
  res.json(agentVersionRegistry.listVersions(agentId));
});

// POST /v1/evaluations/jobs — Trigger a Continuous Evaluation Job
router.post("/v1/evaluations/jobs", async (req, res) => {
  try {
    const { agentId, candidateVersionId, baselineVersionId, specId, inlineSpec, tier, trigger } = req.body || {};
    const spec = (specId ? simulationSpecService.getSpec(specId) : inlineSpec) as SimulationSpec;

    if (!agentId || !candidateVersionId || !baselineVersionId || !spec) {
      res.status(400).json({ error: "agentId, candidateVersionId, baselineVersionId, and spec are required" });
      return;
    }

    const result = await evaluationJobService.runJob({
      agentId,
      candidateVersionId,
      baselineVersionId,
      spec,
      tier,
      trigger,
    });

    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Evaluation job failed";
    res.status(500).json({ error: message });
  }
});

// GET /v1/evaluations/jobs/:id — Get evaluation job status
router.get("/v1/evaluations/jobs/:id", (req, res) => {
  const job = evaluationJobService.getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: `Evaluation job "${req.params.id}" not found` });
    return;
  }
  res.json(job);
});

// GET /v1/regressions/:id — Get detailed regression report
router.get("/v1/regressions/:id", (req, res) => {
  const report = evaluationJobService.getReport(req.params.id);
  if (!report) {
    res.status(404).json({ error: `Regression report "${req.params.id}" not found` });
    return;
  }
  res.json(report);
});

// POST /v1/webhooks/deployment — CI/CD Deployment Gate Webhook
router.post("/v1/webhooks/deployment", async (req, res) => {
  try {
    const { agentId, candidateVersionId, baselineVersionId, specId, inlineSpec, tier } = req.body || {};
    const spec = (specId ? simulationSpecService.getSpec(specId) : inlineSpec) as SimulationSpec;

    if (!agentId || !candidateVersionId || !baselineVersionId || !spec) {
      res.status(400).json({ error: "agentId, candidateVersionId, baselineVersionId, and spec are required for deployment gate" });
      return;
    }

    const gateResult = await evaluationJobService.runJob({
      agentId,
      candidateVersionId,
      baselineVersionId,
      spec,
      tier: tier ?? "tier0_smoke",
      trigger: "deployment",
    });

    res.status(gateResult.decision === "BLOCKED" ? 409 : 200).json(gateResult);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Deployment webhook failed";
    res.status(500).json({ error: message });
  }
});

export default router;
