import { describe, it, expect } from "vitest";
import { customerAgentAttestationService } from "../productionEvidence/customerAgentAttestationService";
import type { ExternalAgentRegistration } from "@workspace/simulation-contract";

describe("P9 Gate #1: Real Customer Agent Connect & Attestation Suite", () => {
  const dummyCustomerAgent: ExternalAgentRegistration = {
    id: "agent_client_zenith_fintech",
    name: "Zenith Banking Assistant",
    version: "1.0.0",
    tenantId: "org_zenith_bank",
    protocol: "http",
    endpointUrl: "http://localhost/zenith-agent",
    authConfig: {
      type: "hmac",
      secretToken: "zenith_hmac_secret_2026",
      headerName: "X-RoleplayX-Signature",
    },
    configurationHash: "cfg_hash_zenith_100",
    capabilities: {
      supportsToolCalling: true,
      supportsMultiTurn: true,
      supportsStreaming: false,
      maxContextTokens: 8192,
      supportedProtocols: ["http"],
    },
    createdAt: new Date().toISOString(),
  };

  it("1. successfully registers and verifies third-party customer agent with valid operator attestation", async () => {
    const result = await customerAgentAttestationService.registerAndVerifyAgent({
      agent: dummyCustomerAgent,
      ownershipType: "third_party_customer",
      attestation: {
        customerName: "Zenith Financial Corp",
        attestationType: "operator_verified",
        declaredBy: "lead_qa_auditor",
        declaredAt: new Date().toISOString(),
        evidenceReference: "contract_ref_zenith_2026_pilot",
        productionStatus: "staging",
        independenceStatus: "verified",
        notes: "Verified external endpoint hosted in client AWS staging VPC.",
      },
    });

    expect(result.registration.id).toBe("agent_client_zenith_fintech");
    expect(result.attestation.independenceStatus).toBe("verified");
    expect(result.attestation.customerName).toBe("Zenith Financial Corp");
    expect(result.gate1Result.status).toBe("PASS");
    expect(result.gate1Result.independenceStatus).toBe("verified");
    expect(result.gate1Result.evidenceId).toBeTruthy();
  });

  it("2. labels validation fixtures as unverified non-production agents", async () => {
    const fixtureAgent: ExternalAgentRegistration = {
      ...dummyCustomerAgent,
      id: "agent_fixture_apexpay_test",
      name: "ApexPay Validation Fixture",
      tenantId: "org_internal_qa",
    };

    const result = await customerAgentAttestationService.registerAndVerifyAgent({
      agent: fixtureAgent,
      ownershipType: "validation_fixture",
    });

    expect(result.attestation.independenceStatus).toBe("unverified");
    expect(result.attestation.productionStatus).toBe("non_production");
    expect(result.gate1Result.independenceStatus).toBe("unverified");
    expect(result.gate1Result.ownershipType).toBe("validation_fixture");
  });

  it("3. handles unverified customer declaration without formal verification", async () => {
    const unverifiedClient: ExternalAgentRegistration = {
      ...dummyCustomerAgent,
      id: "agent_client_self_declared",
      name: "Self Declared Bot",
    };

    const result = await customerAgentAttestationService.registerAndVerifyAgent({
      agent: unverifiedClient,
      ownershipType: "third_party_customer",
      attestation: {
        attestationType: "customer_declared", // Not operator or contract verified
        declaredBy: "web_form_user",
        declaredAt: new Date().toISOString(),
      },
    });

    expect(result.attestation.independenceStatus).toBe("unverified");
    expect(result.gate1Result.independenceStatus).toBe("unverified");
  });
});
