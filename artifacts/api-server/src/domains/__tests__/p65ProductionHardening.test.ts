import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import app from "../../app";
import type { SimulationSpec } from "@workspace/simulation-contract";
import { organizationService } from "../saas/organizationService";
import { apiKeyService } from "../saas/apiKeyService";
import { correlationLineageManager } from "../saas/observability";
import { simulationSpecService } from "../simulation/specService";

describe("P6.5 Production Hardening, Security Penetration & 7-Verb Workflow Suite", () => {
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

  it("1. blocks Cross-Tenant Access & IDOR attacks (Org A user -> Org B resources)", async () => {
    // Org A
    const orgA = organizationService.createOrganization({ name: "Alpha Corp", slug: "alpha" });
    const projA = organizationService.createProject({ organizationId: orgA.id, name: "Alpha Project" });

    // Org B
    const orgB = organizationService.createOrganization({ name: "Beta Corp", slug: "beta" });
    const projB = organizationService.createProject({ organizationId: orgB.id, name: "Beta Project" });

    // 1. Org A caller attempts to access Org B details
    const crossOrgRes = await request(app)
      .get(`/api/v1/organizations/${orgB.id}`)
      .set("x-organization-id", orgA.id);

    expect(crossOrgRes.status).toBe(403);
    expect(crossOrgRes.body.code).toBe("TENANT_ISOLATION_VIOLATION");

    // 2. Org A caller attempts to access Org B projects
    const crossProjRes = await request(app)
      .get(`/api/v1/organizations/${orgB.id}/projects`)
      .set("x-organization-id", orgA.id);

    expect(crossProjRes.status).toBe(403);

    // 3. IDOR: Org A caller tries to access Org B project under Org A path
    const idorRes = await request(app)
      .get(`/api/v1/projects/${projB.id}/failure-explorer`)
      .set("x-organization-id", orgA.id);

    expect(idorRes.status).toBe(403);
    expect(idorRes.body.code).toBe("IDOR_PROJECT_VIOLATION");
  });

  it("2. enforces API Key scopes (e.g. benchmark:read cannot execute deployment:gate)", () => {
    const org = organizationService.createOrganization({ name: "Security Test Org", slug: "sec-test" });
    const { apiKey, rawSecretToken } = apiKeyService.generateApiKey({
      organizationId: org.id,
      name: "Read-Only Token",
      scopes: ["benchmark:read", "evaluation:read"],
    });

    const readCheck = apiKeyService.verifyApiKey(rawSecretToken, "benchmark:read");
    expect(readCheck.valid).toBe(true);

    const gateCheck = apiKeyService.verifyApiKey(rawSecretToken, "deployment:gate");
    expect(gateCheck.valid).toBe(false);
  });

  it("3. tracks complete 7-Entity Correlation Lineage (requestId -> deploymentId)", () => {
    const reqId = "req_trace_999";
    const lineage = correlationLineageManager.recordLineage({
      requestId: reqId,
      organizationId: "org_alpha",
      projectId: "proj_alpha_qa",
      experimentId: "exp_101",
      runId: "run_555",
      trajectoryId: "traj_888",
      evaluationId: "eval_777",
      failureId: "fail_333",
      deploymentId: "dep_gate_444",
    });

    expect(lineage.requestId).toBe(reqId);
    expect(lineage.timestamp).toBeDefined();

    const retrieved = correlationLineageManager.getLineage(reqId);
    expect(retrieved?.deploymentId).toBe("dep_gate_444");
    expect(retrieved?.runId).toBe("run_555");
  });

  it("4. verifies 7-Verb Product Workflow: CONNECT -> SIMULATE -> EVALUATE -> DISCOVER -> COMPARE -> GATE -> PROVE", async () => {
    const org = organizationService.createOrganization({ name: "FinTech AI Inc", slug: "fintech" });
    const proj = organizationService.createProject({ organizationId: org.id, name: "Support Bot QA" });

    // 1. CONNECT
    const regRes = await request(app)
      .post("/api/v1/external-agents/register")
      .send({
        id: "fintech_bot_v1",
        name: "FinTech Support Bot v1",
        version: "1.0.0",
        tenantId: org.id,
        protocol: "http",
        endpointUrl: "https://api.fintech.example.com",
        capabilities: { supportsToolCalling: true },
      });
    expect(regRes.status).toBe(201);

    // 2. SIMULATE
    const expRes = await request(app)
      .post("/api/v1/experiments/run")
      .send({
        experiment: {
          id: "exp_fintech_001",
          benchmarkId: "bench_fintech_001",
          name: "FinTech 1K Simulation",
          specIds: [goldenSpec.id],
          targetAgents: [
            {
              id: "fintech_bot_v1",
              name: "FinTech Bot",
              role: "support_agent",
              actorType: "ai_agent_target",
              agentConfig: { provider: "mock", config: { profile: "strict" } },
            },
          ],
          samplingStrategy: "stratified",
          sampleSize: 4,
          repetitions: 1,
          baseSeed: 888,
        },
        specs: [goldenSpec],
      });
    expect(expRes.status).toBe(201);

    // 3. EVALUATE & 4. DISCOVER (Failure Explorer)
    const failRes = await request(app)
      .get(`/api/v1/projects/${proj.id}/failure-explorer`)
      .set("x-organization-id", org.id);
    expect(failRes.status).toBe(200);
    expect(failRes.body[0].observedBehavioralDivergence).toBeDefined();
    expect(failRes.body[0].causalHypothesis).toBeDefined();

    // 5. COMPARE (Register Candidate v2)
    const v2Res = await request(app)
      .post("/api/v1/agent-versions")
      .send({
        agentId: "fintech_bot_v1",
        version: "2.0.0",
        endpoint: { protocol: "sdk" },
      });
    expect(v2Res.status).toBe(201);

    // 6. GATE (CI/CD Deployment Gate)
    const gateRes = await request(app)
      .post("/api/v1/webhooks/deployment")
      .send({
        agentId: "fintech_bot_v1",
        candidateVersionId: "fintech_bot_v1_v2_0_0",
        baselineVersionId: "fintech_bot_v1_v2_0_0",
        specId: goldenSpec.id,
        tier: "tier0_smoke",
      });
    expect([200, 409]).toContain(gateRes.status);
    expect(gateRes.body.decision).toBeDefined();

    // 7. PROVE (Dataset Package Export)
    const pkgRes = await request(app)
      .post("/api/v1/benchmarks/bench_fintech_001/package")
      .send({
        benchmark: {
          benchmarkId: "bench_fintech_001",
          matrixId: "mat_fintech_001",
          generatedAt: new Date().toISOString(),
          totalSimulations: 4,
          agents: [],
          comparativeRadar: [],
          executiveSummary: "FinTech proof package",
        },
        specifications: [goldenSpec],
      });
    expect(pkgRes.status).toBe(201);
    expect(pkgRes.body.manifest.checksum).toHaveLength(64);
  });
});
