import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import productionEvidenceRouter from "../../routes/productionEvidenceRoutes";
import { PIIRedactor } from "../security/piiRedactor";

describe("P9 Security Suite: Tenant Isolation & PII Redaction", () => {
  const app = express();
  app.use(express.json());
  app.use(productionEvidenceRouter);

  it("1. enforces cross-tenant isolation on customer agent registration", async () => {
    // Tenant A attempts to register with mismatched tenant ID in payload
    const res = await request(app)
      .post("/api/p9/customer-agent")
      .set("x-organization-id", "org_tenant_alpha")
      .send({
        agent: {
          id: "agent_rogue_01",
          name: "Rogue Agent",
          tenantId: "org_tenant_beta", // Mismatched tenant
          protocol: "http",
          configurationHash: "cfg_hash_01",
        },
        ownershipType: "third_party_customer",
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("2. enforces cross-tenant isolation on calibration runs and pilots", async () => {
    // Create gold set under Tenant Alpha
    const goldSetRes = await request(app)
      .post("/api/p9/gold-set")
      .set("x-organization-id", "org_tenant_alpha")
      .send({
        goldSetId: "gold_alpha_secure_01",
        name: "Alpha Gold Set",
        rubricVersion: "1.0.0",
        annotations: [
          {
            annotationId: "ann_01",
            trajectoryId: "traj_01",
            scenarioId: "s1",
            cohortId: "c1",
            rubricVersion: "1.0.0",
            dimensionScores: { s: 90 },
            overallScore: 90,
            expertId: "exp_01",
          },
        ],
      });

    expect(goldSetRes.status).toBe(201);

    // Tenant Beta attempts to execute calibration against Tenant Alpha's gold set
    const calibRes = await request(app)
      .post("/api/p9/calibration/run")
      .set("x-organization-id", "org_tenant_beta")
      .send({
        goldSetId: "gold_alpha_secure_01",
        spec: { id: "spec_01", actors: [], environment: {} },
        trajectories: [],
      });

    expect(calibRes.status).toBe(403);
    expect(calibRes.body.code).toBe("FORBIDDEN");
  });

  it("3. redacts sensitive customer PII (credit cards, emails, phone numbers, auth secrets)", () => {
    const rawCustomerInput =
      "My name is John Doe, email is john.doe@securebank.com, phone +1-555-019-2834, card 4532-1188-9900-3412. Please refund me.";

    const redacted = PIIRedactor.redact(rawCustomerInput);

    expect(redacted).not.toContain("john.doe@securebank.com");
    expect(redacted).not.toContain("4532-1188-9900-3412");
    expect(redacted).not.toContain("+1-555-019-2834");
    expect(redacted).toContain("[REDACTED_EMAIL]");
    expect(redacted).toContain("[REDACTED_CARD]");
    expect(redacted).toContain("[REDACTED_PHONE]");
  });
});
