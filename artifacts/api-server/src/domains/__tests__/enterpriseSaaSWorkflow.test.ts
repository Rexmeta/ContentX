import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import app from "../../app";
import type { SimulationSpec } from "@workspace/simulation-contract";
import { organizationService } from "../saas/organizationService";
import { apiKeyService } from "../saas/apiKeyService";
import { usageMeteringService } from "../saas/usageMeteringService";
import { auditLogService } from "../saas/auditLogService";
import { dashboardService } from "../saas/dashboardService";
import { failureExplorerService } from "../saas/failureExplorerService";
import { simulationSpecService } from "../simulation/specService";

describe("P6 Enterprise SaaS Productization & 'Will Your AI Survive Production?' Suite", () => {
  const rootCandidates = [
    resolve(__dirname, "../../../../../examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "examples/golden/customer-service/simulation-spec.json"),
    resolve(process.cwd(), "../../examples/golden/customer-service/simulation-spec.json"),
  ];
  const goldenSpecPath = rootCandidates.find((p) => existsSync(p)) || rootCandidates[0];

  let goldenSpec: SimulationSpec;

  beforeEach(() => {
    const raw = readFileSync(goldenSpecPath, "utf-8");
    goldenSpec = JSON.parse(raw) as SimulationSpec;
    simulationSpecService.createSpec(goldenSpec);
  });

  it("1. manages Tenant/Project hierarchy, RBAC permissions, and scoped API keys", () => {
    // Create Org & Project
    const org = organizationService.createOrganization({
      name: "Acme Financial Inc.",
      slug: "acme-financial",
      plan: "enterprise",
    });
    const proj = organizationService.createProject({
      organizationId: org.id,
      name: "Wealth Advisor AI QA",
    });

    expect(org.id).toBeTruthy();
    expect(proj.organizationId).toBe(org.id);

    // Add Members & check RBAC
    const owner = organizationService.addMember({
      organizationId: org.id,
      email: "ciso@acme.com",
      name: "Chief Security Officer",
      role: "owner",
    });
    const viewer = organizationService.addMember({
      organizationId: org.id,
      email: "auditor@acme.com",
      name: "Compliance Auditor",
      role: "viewer",
    });

    expect(organizationService.hasPermission(owner.role, "manage_org")).toBe(true);
    expect(organizationService.hasPermission(viewer.role, "manage_org")).toBe(false);
    expect(organizationService.hasPermission(viewer.role, "view_results")).toBe(true);

    // Generate & Verify Scoped API Key
    const { apiKey, rawSecretToken } = apiKeyService.generateApiKey({
      organizationId: org.id,
      projectId: proj.id,
      name: "GitHub Actions CI Gate Token",
      scopes: ["deployment:gate", "benchmark:run"],
    });

    expect(apiKey.keyPrefix).toContain("rpx_live_");
    expect(apiKey.scopes).toContain("deployment:gate");

    const authCheck = apiKeyService.verifyApiKey(rawSecretToken, "deployment:gate");
    expect(authCheck.valid).toBe(true);

    const invalidScopeCheck = apiKeyService.verifyApiKey(rawSecretToken, "agent:manage");
    expect(invalidScopeCheck.valid).toBe(false);
  });

  it("2. tracks live Usage Metering and enforces Quota thresholds", () => {
    const orgId = "org_metering_test";
    const initial = usageMeteringService.getUsage(orgId);
    expect(initial.simulationRuns).toBe(0);
    expect(initial.simulationRunsQuota).toBe(50000);

    usageMeteringService.recordUsage(orgId, {
      simulationRuns: 1250,
      llmTokens: 350000,
      evaluationRuns: 1250,
    });

    const updated = usageMeteringService.getUsage(orgId);
    expect(updated.simulationRuns).toBe(1250);
    expect(updated.llmTokens).toBe(350000);
    expect(usageMeteringService.hasQuota(orgId, 1000)).toBe(true);
    expect(usageMeteringService.hasQuota(orgId, 60000)).toBe(false);
  });

  it("3. appends immutable Audit Logs and generates Unified Dashboard & Failure Explorer", () => {
    const orgId = "org_dash_test";
    auditLogService.log({
      organizationId: orgId,
      actorId: "usr_alice",
      actorType: "user",
      action: "benchmark_started",
      targetResourceId: "bench_101",
      targetResourceType: "benchmark",
    });

    const logs = auditLogService.listLogs(orgId);
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("benchmark_started");

    // Unified Dashboard Summary
    const dashboard = dashboardService.getSummary({ organizationId: orgId });
    expect(dashboard.agentQuality.overallScore).toBeGreaterThan(80);
    expect(dashboard.benchmarkHealth.totalRuns).toBeGreaterThan(0);
    expect(dashboard.reliability.p50LatencyMs).toBeLessThan(1000);

    // Failure Explorer
    const failureNodes = failureExplorerService.buildFailureNodes({ agents: [] } as any);
    expect(failureNodes.length).toBeGreaterThanOrEqual(3);
    const criticalNode = failureNodes.find((n) => n.severity === "critical");
    expect(criticalNode?.patternType).toBe("escalation_delay");
    expect(criticalNode?.causalHypothesis).toContain("customer abandonment before supervisor handover");
    expect(criticalNode?.observedBehavioralDivergence).toContain("Turn 2");
  });

  it("4. executes Full 11-Step Killer Demo: 'Will Your AI Survive Production?' via REST API", async () => {
    // Step 1: Create Organization & Project
    const orgRes = await request(app)
      .post("/api/v1/organizations")
      .send({ name: "Enterprise Bank Corp", slug: "enterprise-bank", plan: "enterprise" });
    expect(orgRes.status).toBe(201);
    const orgId = orgRes.body.id;

    const projRes = await request(app)
      .post(`/api/v1/organizations/${orgId}/projects`)
      .send({ name: "Customer Service Agent QA" });
    expect(projRes.status).toBe(201);
    const projId = projRes.body.id;

    // Step 2: Generate API Key
    const keyRes = await request(app)
      .post(`/api/v1/organizations/${orgId}/api-keys`)
      .send({ name: "CI Gate Token", projectId: projId, scopes: ["deployment:gate", "benchmark:run"] });
    expect(keyRes.status).toBe(201);
    expect(keyRes.body.rawSecretToken).toBeDefined();

    // Step 3: Register External Agent
    const regRes = await request(app)
      .post("/api/v1/external-agents/register")
      .send({
        id: "agent_bank_cs_v1",
        name: "Bank CS Agent v1",
        version: "1.0.0",
        tenantId: orgId,
        protocol: "http",
        endpointUrl: "https://api.bank.example.com",
        capabilities: { supportsToolCalling: true },
      });
    expect(regRes.status).toBe(201);

    // Step 4: 8-Step Pre-flight Contract Check
    const checkRes = await request(app)
      .post("/api/v1/external-agents/agent_bank_cs_v1/contract-check");
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.isReadyForBenchmarking).toBe(true);
    expect(checkRes.body.passedChecksCount).toBe(8);

    // Step 5: Run Benchmark Experiment
    const expRes = await request(app)
      .post("/api/v1/experiments/run")
      .send({
        experiment: {
          id: "exp_bank_001",
          benchmarkId: "bench_bank_001",
          name: "Bank CS 1K Runs Benchmark",
          specIds: [goldenSpec.id],
          targetAgents: [
            {
              id: "agent_bank_cs_v1",
              name: "Bank CS Agent",
              role: "support_agent",
              actorType: "ai_agent_target",
              agentConfig: { provider: "mock", config: { profile: "strict" } },
            },
          ],
          samplingStrategy: "stratified",
          sampleSize: 4,
          repetitions: 1,
          baseSeed: 777,
        },
        specs: [goldenSpec],
      });
    expect(expRes.status).toBe(201);
    expect(expRes.body.totalPlannedRuns).toBe(4);

    // Step 6: Interactive Failure Explorer
    const failRes = await request(app)
      .get(`/api/v1/projects/${projId}/failure-explorer`)
      .set("x-organization-id", orgId);
    expect(failRes.status).toBe(200);
    expect(failRes.body.length).toBeGreaterThanOrEqual(3);

    // Step 7: Adaptive Adversarial Stress Test
    const stressRes = await request(app)
      .post("/api/v1/benchmarks/adaptive-loop")
      .send({
        spec: goldenSpec,
        targetAgent: {
          id: "agent_bank_cs_v1",
          name: "Bank CS Agent",
          role: "support_agent",
          actorType: "ai_agent_target",
          agentConfig: { provider: "mock", config: { profile: "strict" } },
        },
        baselineSampleSize: 3,
        stressSampleSize: 3,
      });
    expect(stressRes.status).toBe(201);
    expect(stressRes.body.differentialReport).toBeDefined();

    // Step 8: Register Agent Candidate Version
    const verRes = await request(app)
      .post("/api/v1/agent-versions")
      .send({
        agentId: "agent_bank_cs_v1",
        version: "2.0.0",
        endpoint: { protocol: "sdk" },
        metadata: { releaseId: "release_prod_candidate" },
      });
    expect(verRes.status).toBe(201);

    // Step 9: Continuous Regression Evaluation via CI/CD Webhook
    const hookRes = await request(app)
      .post("/api/v1/webhooks/deployment")
      .send({
        agentId: "agent_bank_cs_v1",
        candidateVersionId: "agent_bank_cs_v1_v2_0_0",
        baselineVersionId: "agent_bank_cs_v1_v2_0_0",
        specId: goldenSpec.id,
        tier: "tier0_smoke",
      });
    expect([200, 409]).toContain(hookRes.status);
    expect(hookRes.body.decision).toBeDefined();

    // Step 10: Verify Audit Logs
    const auditRes = await request(app)
      .get(`/api/v1/organizations/${orgId}/audit-logs`)
      .set("x-organization-id", orgId);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.length).toBeGreaterThanOrEqual(2);

    // Step 11: Export Benchmark Dataset Package
    const pkgRes = await request(app)
      .post("/api/v1/benchmarks/bench_bank_001/package")
      .send({
        benchmark: {
          benchmarkId: "bench_bank_001",
          matrixId: "mat_bank_001",
          generatedAt: new Date().toISOString(),
          totalSimulations: 4,
          agents: [],
          comparativeRadar: [],
          executiveSummary: "Bank benchmark complete",
        },
        specifications: [goldenSpec],
      });
    expect(pkgRes.status).toBe(201);
    expect(pkgRes.body.manifest.checksum).toHaveLength(64);
  });
});
