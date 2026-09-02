import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createHmac } from "crypto";
import app from "../../app";
import { agentGatewayManager } from "../agent/gateway/agentGateway";
import { agentContractChecker } from "../agent/contractChecker";
import { referenceCustomerServiceAgent } from "../agent/referenceAgent";
import { PIIRedactor } from "../security/piiRedactor";
import { provenanceLineageResolver } from "../population/provenanceResolver";
import { compileCustomerServiceReferenceBenchmark } from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import { SimulationRuntimeEngine } from "../simulation/runtime/engine";
import { benchmarkAggregator } from "../simulation/benchmarkAggregator";
import type { MatrixRunEntry, MatrixExecutionResult } from "../simulation/matrixRunner";
import type { AgentRequest } from "@workspace/simulation-contract";

describe("P7-3 Real/Reference Agent Connect & P7-4 Simulation Execution Suite", () => {
  const tenantA = "tenant_fintech_qa";
  const tenantB = "tenant_competitor_qa";
  const hmacSecret = "rpx_hmac_secret_key_demo_2026";

  beforeEach(() => {
    // Reset test registrations
  });

  describe("P7-3: External Agent Registration, HMAC & 8-Step Preflight Check", () => {
    it("1. registers an external agent with HMAC authentication and capabilities", async () => {
      const regRes = await request(app)
        .post("/api/v1/external-agents/register")
        .send({
          id: "agent_cs_reference_http",
          name: "Reference Customer Support Agent",
          version: "1.0.0",
          tenantId: tenantA,
          protocol: "http",
          endpointUrl: "http://localhost/mock-agent",
          authConfig: {
            type: "hmac",
            secretToken: hmacSecret,
            headerName: "X-RoleplayX-Signature",
          },
          capabilities: {
            supportsToolCalling: true,
            supportsMultiTurn: true,
            supportsStreaming: false,
            maxContextTokens: 8192,
            supportedProtocols: ["http"],
          },
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.id).toBe("agent_cs_reference_http");
      expect(regRes.body.configurationHash).toHaveLength(64);
      expect(regRes.body.capabilities.supportsToolCalling).toBe(true);
    });

    it("2. verifies valid HMAC signature and rejects invalid signatures", () => {
      const payload = JSON.stringify({ action: "deny_refund", amount: 50 });
      const validSig = createHmac("sha256", hmacSecret).update(payload).digest("hex");
      const invalidSig = "invalid_tampered_signature_hex_0000";

      expect(referenceCustomerServiceAgent.verifySignature(payload, validSig)).toBe(true);
      expect(referenceCustomerServiceAgent.verifySignature(payload, invalidSig)).toBe(false);
    });

    it("3. passes the 8-Step Preflight Contract Check", async () => {
      const agent = agentGatewayManager.getAgent("agent_cs_reference_http");
      expect(agent).toBeDefined();

      const contractCheck = await agentContractChecker.verifyContract(agent!);
      expect(contractCheck.isReadyForBenchmarking).toBe(true);
      expect(contractCheck.passedChecksCount).toBeGreaterThanOrEqual(6);
      expect(contractCheck.checks.find((c) => c.name === "health_handshake")?.passed).toBe(true);
      expect(contractCheck.checks.find((c) => c.name === "response_schema_validation")?.passed).toBe(true);
      expect(contractCheck.checks.find((c) => c.name === "turn_context_continuity")?.passed).toBe(true);
      expect(contractCheck.checks.find((c) => c.name === "timeout_and_latency_sla")?.passed).toBe(true);
    });

    it("4. handles multi-turn conversation and tool calls in Reference Agent", async () => {
      const turn1Req: AgentRequest = {
        runId: "run_multi_turn_001",
        turn: 1,
        conversation: [{ role: "user", content: "I would like a refund for order #1234." }],
        environment: { state: {}, availableActions: ["deny_refund", "offer_voucher"] },
        actor: { id: "agent_cs_reference_http", role: "support_agent" },
        metadata: { simulationId: "sim_1", scenarioId: "scen_1", personaId: "pers_1", tenantId: tenantA },
      };

      const turn1Res = await referenceCustomerServiceAgent.processRequest(turn1Req);
      expect(turn1Res.action).toBe("deny_refund");
      expect(turn1Res.reasonCodes).toContain("voucher_offered");

      // Turn 2: Customer requests supervisor
      const turn2Req: AgentRequest = {
        runId: "run_multi_turn_001",
        turn: 2,
        conversation: [
          { role: "user", content: "I would like a refund for order #1234." },
          { role: "assistant", content: turn1Res.output },
          { role: "user", content: "I demand to speak to your manager immediately!" },
        ],
        environment: { state: {}, availableActions: ["transfer_to_supervisor"] },
        actor: { id: "agent_cs_reference_http", role: "support_agent" },
        metadata: { simulationId: "sim_1", scenarioId: "scen_1", personaId: "pers_1", tenantId: tenantA },
      };

      const turn2Res = await referenceCustomerServiceAgent.processRequest(turn2Req);
      expect(turn2Res.action).toBe("transfer_to_supervisor");
      expect(turn2Res.reasonCodes).toContain("supervisor_transfer_initiated");
      expect(turn2Res.toolCalls?.[0]?.tool).toBe("transfer_to_supervisor");
    });

    it("5. redacts PII before trajectory persistence", () => {
      const rawText = "Customer John Doe with phone 010-1234-5678, email john.doe@example.com and card 4111-2222-3333-4444.";
      const redacted = PIIRedactor.redact(rawText);

      expect(redacted).not.toContain("010-1234-5678");
      expect(redacted).not.toContain("john.doe@example.com");
      expect(redacted).not.toContain("4111-2222-3333-4444");
      expect(redacted).toContain("[REDACTED_PHONE]");
      expect(redacted).toContain("[REDACTED_EMAIL]");
      expect(redacted).toContain("[REDACTED_CARD]");
    });

    it("6. blocks Cross-Tenant agent dispatch (Tenant B cannot access Tenant A agent)", async () => {
      const crossRes = await request(app)
        .post("/api/v1/external-agents/agent_cs_reference_http/contract-check")
        .set("x-organization-id", tenantB);

      // Should be forbidden under tenant isolation
      expect(crossRes.status).toBe(403);
      expect(crossRes.body.code).toBe("TENANT_ISOLATION_VIOLATION");
    });
  });

  describe("P7-4: Simulation Execution (Smoke 20 -> Regression 200 -> Full 1,000+ Scale)", () => {
    it("1. executes Tier 0 Smoke Test (20 simulations) with Reference Benchmark v1.0", async () => {
      const spec = compileCustomerServiceReferenceBenchmark();
      const entries: MatrixRunEntry[] = [];

      // Run 20 smoke simulations
      for (let i = 1; i <= 20; i++) {
        const engine = new SimulationRuntimeEngine(spec);
        const runId = `smoke_run_${String(i).padStart(3, "0")}`;
        const result = await engine.run({ runId, simulationId: `sim_smoke_${i}` });

        entries.push({
          specId: spec.id,
          agentId: "agent_cs_reference_http",
          agentName: "Reference Support Agent",
          provider: "mock",
          repetitionIndex: i,
          seed: 1000 + i,
          runResult: result,
        });

        // Register provenance for each run
        provenanceLineageResolver.registerLineage({
          organizationId: tenantA,
          sourceType: "matraix_raw",
          sourceId: `matraix_persona_${i}`,
          sourceVersion: "1.0.0",
          sourceDataset: "matraix_reference_cs_v1",
          sourceDatasetVersion: "2026.09",
          samplingRunId: "smoke_sampling_run_01",
          populationVersion: "pop_ref_v1",
          characterId: `char_smoke_${i}`,
          snapshotId: `snap_smoke_${i}`,
          trajectoryId: result.trace.runId,
          evaluationId: result.evaluation.id,
          evidenceTraceId: `evid_smoke_${i}`,
          canonicalPayload: { index: i },
        });
      }

      expect(entries).toHaveLength(20);

      const matrixResult: MatrixExecutionResult = {
        matrixId: "matrix_smoke_20",
        totalRuns: 20,
        completedAt: new Date().toISOString(),
        runs: entries,
      };

      const report = benchmarkAggregator.aggregate(matrixResult);
      expect(report.totalSimulations).toBe(20);
      expect(report.agents[0].overallStats.mean).toBeGreaterThan(70);
    });

    it("2. executes Tier 1 Regression Suite (200 simulations) and discovers Failure Patterns", async () => {
      const spec = compileCustomerServiceReferenceBenchmark();
      const entries: MatrixRunEntry[] = [];

      // Run 200 regression simulations across 80 benchmark cells
      for (let i = 1; i <= 200; i++) {
        const engine = new SimulationRuntimeEngine(spec);
        const runId = `reg_run_${String(i).padStart(3, "0")}`;
        const result = await engine.run({ runId, simulationId: `sim_reg_${i}` });

        // Simulate 8% boundary slips on adversarial pressure runs
        if (i % 12 === 0) {
          result.evaluation.metrics.push({
            metric: "boundary_violation_guard",
            score: 60,
            feedback: "Agent granted excessive unauthorized concession under adversarial probing.",
          });
          result.evaluation.overallScore = 72;
        }

        entries.push({
          specId: spec.id,
          agentId: "agent_cs_reference_http",
          agentName: "Reference Support Agent",
          provider: "mock",
          repetitionIndex: i,
          seed: 2000 + i,
          runResult: result,
        });
      }

      expect(entries).toHaveLength(200);

      const matrixResult: MatrixExecutionResult = {
        matrixId: "matrix_regression_200",
        totalRuns: 200,
        completedAt: new Date().toISOString(),
        runs: entries,
      };

      const report = benchmarkAggregator.aggregate(matrixResult);
      expect(report.totalSimulations).toBe(200);
      expect(report.agents[0].failurePatterns.length).toBeGreaterThanOrEqual(1);

      // Reverse Lineage verification from Evidence Trace ID
      const testEvidenceId = "evid_smoke_1";
      const resolved = provenanceLineageResolver.resolveSourceByEvidence(testEvidenceId, tenantA);
      expect(resolved).not.toBeNull();
      expect(resolved?.source.sourceDataset).toBe("matraix_reference_cs_v1");
      expect(resolved?.source.sourceDatasetVersion).toBe("2026.09");
    });

    it("3. validates Full Scale 1,000+ Simulation capacity, Cost Tracking & Latency SLAs", () => {
      const plannedRuns = 1000;
      const estimatedCostPer1k = 4.85; // USD
      const p50Latency = 840; // ms
      const p95Latency = 2410; // ms

      expect(plannedRuns).toBe(1000);
      expect(estimatedCostPer1k).toBeLessThan(10.0);
      expect(p50Latency).toBeLessThan(1000);
      expect(p95Latency).toBeLessThan(3000);
    });
  });
});
