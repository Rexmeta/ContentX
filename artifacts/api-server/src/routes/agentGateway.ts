import { Router } from "express";
import {
  ExternalAgentRegistrationSchema,
  type SimulationActorSpec,
  type SimulationSpec,
} from "@workspace/simulation-contract";
import { agentGatewayManager, publicRegistration } from "../domains/agent/gateway/agentGateway";
import { agentContractChecker } from "../domains/agent/contractChecker";
import { adaptiveLoopService } from "../domains/simulation/adaptiveLoopService";
import { simulationSpecService } from "../domains/simulation/specService";

const router = Router();

// POST /v1/external-agents/register — Register an external enterprise AI Agent
router.post("/v1/external-agents/register", (req, res) => {
  try {
    const parsed = ExternalAgentRegistrationSchema.omit({ configurationHash: true, createdAt: true }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const registered = agentGatewayManager.registerAgent(parsed.data);
    res.status(201).json(publicRegistration(registered));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    res.status(500).json({ error: message });
  }
});

// GET /v1/external-agents — List registered agents
router.get("/v1/external-agents", (req, res) => {
  const tenantId = req.query.tenantId as string;
  res.json(agentGatewayManager.listPublicAgents(tenantId));
});

// GET /v1/external-agents/:id — Get agent registration
router.get("/v1/external-agents/:id", (req, res) => {
  const agent = agentGatewayManager.getPublicAgent(req.params.id);
  if (!agent) {
    res.status(404).json({ error: `Agent "${req.params.id}" not found` });
    return;
  }
  res.json(agent);
});

// POST /v1/external-agents/:id/health — Check agent connectivity health
router.post("/v1/external-agents/:id/health", async (req, res) => {
  const health = await agentGatewayManager.checkHealth(req.params.id);
  res.json(health);
});

// POST /v1/external-agents/:id/contract-check — Run 8-Step Pre-flight Contract Verification
router.post("/v1/external-agents/:id/contract-check", async (req, res) => {
  const agent = agentGatewayManager.getAgent(req.params.id);
  if (!agent) {
    res.status(404).json({ error: `Agent "${req.params.id}" not found` });
    return;
  }

  const checkResult = await agentContractChecker.verifyContract(agent);
  res.json(checkResult);
});

// POST /v1/external-agents/:id/stress-test — "Find 3 Hidden Failures in Your AI Agent" Demo Flow
router.post("/v1/external-agents/:id/stress-test", async (req, res) => {
  try {
    const agent = agentGatewayManager.getAgent(req.params.id);
    if (!agent) {
      res.status(404).json({ error: `Agent "${req.params.id}" not found` });
      return;
    }

    const { specId, inlineSpec, baselineSampleSize, stressSampleSize } = req.body || {};
    const baseSpec = (specId ? simulationSpecService.getSpec(specId) : inlineSpec) as SimulationSpec;

    if (!baseSpec) {
      res.status(400).json({ error: "A valid SimulationSpec (via specId or inlineSpec) is required" });
      return;
    }

    // Wrap external agent registration as SimulationActorSpec
    const targetActorSpec: SimulationActorSpec = {
      id: agent.id,
      name: agent.name,
      role: "support_agent",
      actorType: "ai_agent_target",
      agentConfig: {
        provider: agent.protocol,
        config: {
          agentId: agent.id,
          endpointUrl: agent.endpointUrl,
          model: `external-${agent.protocol}-v${agent.version}`,
        },
      },
    };

    const loopResult = await adaptiveLoopService.runAdaptiveLoop({
      spec: baseSpec,
      targetAgent: targetActorSpec,
      baselineSampleSize: baselineSampleSize ?? 6,
      stressSampleSize: stressSampleSize ?? 6,
      stressIntensity: 0.9,
    });

    res.status(201).json({
      title: `Stress Test & Failure Discovery Report: ${agent.name} (v${agent.version})`,
      agentId: agent.id,
      version: agent.version,
      configurationHash: agent.configurationHash,
      ...loopResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stress test failed";
    res.status(500).json({ error: message });
  }
});

export default router;
