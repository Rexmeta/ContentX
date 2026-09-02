import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../app";

describe("P7 commercial validation flow", () => {
  it("runs the reference benchmark, persists evidence, verifies checksum, and compares versions", async () => {
    const agentId = `p7_test_sdk_${Date.now()}`;
    const registration = await request(app)
      .post("/api/v1/external-agents/register")
      .send({
        id: agentId,
        name: "P7 Test SDK Agent",
        version: "1.0.0",
        tenantId: "p7-test",
        protocol: "sdk",
        authConfig: { type: "none" },
        capabilities: {
          supportsToolCalling: true,
          supportsMultiTurn: true,
          supportsStreaming: false,
          maxContextTokens: 8192,
          supportedProtocols: ["sdk"],
        },
      });

    expect(registration.status).toBe(201);
    expect(registration.body.authConfig).toEqual({ type: "none" });
    expect(JSON.stringify(registration.body)).not.toContain("secretToken");

    const contract = await request(app)
      .post(`/api/v1/external-agents/${agentId}/contract-check`);
    expect(contract.status).toBe(200);
    expect(contract.body).toMatchObject({
      isReadyForBenchmarking: true,
      passedChecksCount: 8,
      totalChecksCount: 8,
    });

    const run = await request(app)
      .post("/api/v1/commercial-validation/runs")
      .send({ agentId, sampleSizePerCohort: 1, repetitions: 1, baseSeed: 20260902 });
    expect(run.status).toBe(201);
    expect(run.body.interactionCount).toBe(10);
    expect(run.body.benchmark.id).toBe("reference_customer_support_v1");
    expect(run.body.benchmark.cohorts.map((cohort: { id: string }) => cohort.id)).toEqual([
      "calm", "frustrated", "impatient", "boundary", "adversarial",
    ]);
    expect(run.body.calibrationStatus).toBe("PROVISIONAL");
    expect(run.body.evidencePackageId).toBeTruthy();

    const verify = await request(app)
      .post(`/api/v1/commercial-validation/packages/${run.body.evidencePackageId}/verify`);
    expect(verify.status).toBe(200);
    expect(verify.body.valid).toBe(true);
    expect(verify.body.storedChecksum).toHaveLength(64);

    const compare = await request(app)
      .post("/api/v1/commercial-validation/compare")
      .send({ baselineRunId: run.body.id, candidateRunId: run.body.id });
    expect(compare.status).toBe(201);
    expect(["APPROVED", "WARNING", "BLOCKED"]).toContain(compare.body.deploymentDecision);
  });
});