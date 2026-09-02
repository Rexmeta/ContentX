import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import app from "../../app";
import type {
  SimulationSpec,
  ExternalAgentRegistration,
} from "@workspace/simulation-contract";
import { agentGatewayManager } from "../agent/gateway/agentGateway";
import { agentContractChecker } from "../agent/contractChecker";
import { PIIRedactor } from "../security/piiRedactor";
import { simulationSpecService } from "../simulation/specService";

describe("P4 Enterprise Agent Gateway, Onboarding & 'Find 3 Hidden Failures' Suite", () => {
  const rootCandidates = [
    resolve(__dirname, "../../../../../examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "../../examples/golden/customer-service/simulation-spec.json"),
  ];
  const goldenSpecPath = rootCandidates.find((p) => existsSync(p)) || rootCandidates[0];

  let goldenSpec: SimulationSpec;

  const mockExternalAgent: Omit<ExternalAgentRegistration, "configurationHash" | "createdAt"> = {
    id: "agent_enterprise_acme_v1",
    name: "Acme Retail Customer Bot v1",
    version: "1.0.0",
    tenantId: "tenant_acme_corp",
    protocol: "http",
    endpointUrl: "https://api.acme.example.com/ai-agent/v1",
    authConfig: {
      type: "bearer",
      secretToken: "sk-acme-prod-test-key-12345",
    },
    capabilities: {
      supportsToolCalling: true,
      supportsMultiTurn: true,
      supportsStreaming: false,
      maxContextTokens: 8192,
      supportedProtocols: ["http", "webhook"],
    },
  };

  beforeEach(() => {
    const raw = readFileSync(goldenSpecPath, "utf-8");
    goldenSpec = JSON.parse(raw) as SimulationSpec;
    simulationSpecService.createSpec(goldenSpec);
  });

  it("1. registers external enterprise Agent and generates immutable configuration hash", () => {
    const registered = agentGatewayManager.registerAgent(mockExternalAgent);

    expect(registered.id).toBe("agent_enterprise_acme_v1");
    expect(registered.configurationHash).toHaveLength(64); // SHA-256
    expect(registered.capabilities.supportsToolCalling).toBe(true);

    const retrieved = agentGatewayManager.getAgent(registered.id);
    expect(retrieved?.tenantId).toBe("tenant_acme_corp");
  });

  it("2. verifies PII Redaction engine on user and agent utterances", () => {
    const rawUtterance = "My email is john.doe@example.com and phone is +1-555-839-2819. Credit card: 4111 2222 3333 4444.";
    const redacted = PIIRedactor.redact(rawUtterance);

    expect(redacted).not.toContain("john.doe@example.com");
    expect(redacted).not.toContain("555-839-2819");
    expect(redacted).not.toContain("4111 2222 3333 4444");
    expect(redacted).toContain("[REDACTED_EMAIL]");
    expect(redacted).toContain("[REDACTED_PHONE]");
    expect(redacted).toContain("[REDACTED_CARD]");
  });

  it("3. executes 8-Step Pre-flight Contract Verification Suite on external agent", async () => {
    const registered = agentGatewayManager.registerAgent(mockExternalAgent);
    const checkResult = await agentContractChecker.verifyContract(registered);

    expect(checkResult.agentId).toBe(registered.id);
    expect(checkResult.totalChecksCount).toBe(8);
    expect(checkResult.passedChecksCount).toBe(8);
    expect(checkResult.isReadyForBenchmarking).toBe(true);

    const checkNames = checkResult.checks.map((c) => c.name);
    expect(checkNames).toContain("health_handshake");
    expect(checkNames).toContain("response_schema_validation");
    expect(checkNames).toContain("turn_context_continuity");
    expect(checkNames).toContain("timeout_and_latency_sla");
    expect(checkNames).toContain("tool_calling_protocol");
    expect(checkNames).toContain("malformed_input_resilience");
  });

  it("4. executes P4 Killer Demo: 'Find 3 Hidden Failures in Your AI Agent' Stress Loop", async () => {
    const registered = agentGatewayManager.registerAgent(mockExternalAgent);

    // Target Actor Wrapper
    const targetActorSpec = {
      id: registered.id,
      name: registered.name,
      role: "support_agent",
      actorType: "ai_agent_target" as const,
      agentConfig: {
        provider: registered.protocol,
        config: {
          agentId: registered.id,
          endpointUrl: registered.endpointUrl,
          model: `external-${registered.protocol}-v${registered.version}`,
        },
      },
    };

    // Run Adaptive Stress Loop
    const { adaptiveLoopService } = await import("../simulation/adaptiveLoopService");
    const loopResult = await adaptiveLoopService.runAdaptiveLoop({
      spec: goldenSpec,
      targetAgent: targetActorSpec,
      baselineSampleSize: 4,
      stressSampleSize: 4,
      stressIntensity: 0.9,
    });

    expect(loopResult.targetAgent.id).toBe("agent_enterprise_acme_v1");
    expect(loopResult.baselineBenchmark.agents).toHaveLength(1);
    expect(loopResult.adaptiveStressBenchmark.agents).toHaveLength(1);
    expect(loopResult.detectedFailures.length).toBeGreaterThan(0);
    expect(loopResult.differentialReport.executiveFinding).toContain("targeted stress testing");
    expect(loopResult.reproduciblePackage.manifest.checksum).toBeTruthy();
  });

  it("5. verifies HTTP REST API endpoints (/api/v1/external-agents/*)", async () => {
    // 1. POST /v1/external-agents/register
    const regRes = await request(app)
      .post("/api/v1/external-agents/register")
      .send({
        id: "agent_api_http_test",
        name: "Acme Bot API",
        version: "1.0.0",
        tenantId: "tenant_acme",
        protocol: "http",
        endpointUrl: "https://api.acme.example.com",
        capabilities: { supportsToolCalling: true },
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.configurationHash).toBeDefined();

    // 2. GET /v1/external-agents
    const listRes = await request(app).get("/api/v1/external-agents?tenantId=tenant_acme");
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((a: any) => a.id === "agent_api_http_test")).toBe(true);

    // 3. POST /v1/external-agents/:id/contract-check
    const checkRes = await request(app).post("/api/v1/external-agents/agent_api_http_test/contract-check");
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.isReadyForBenchmarking).toBe(true);

    // 4. POST /v1/external-agents/:id/stress-test ("Find 3 Hidden Failures" Endpoint)
    const stressRes = await request(app)
      .post("/api/v1/external-agents/agent_api_http_test/stress-test")
      .send({
        specId: goldenSpec.id,
        baselineSampleSize: 3,
        stressSampleSize: 3,
      });

    expect(stressRes.status).toBe(201);
    expect(stressRes.body.title).toContain("Stress Test & Failure Discovery Report");
    expect(stressRes.body.differentialReport).toBeDefined();
    expect(stressRes.body.detectedFailures.length).toBeGreaterThan(0);
  });
});
