import { describe, it, expect } from "vitest";
import { customerStagingAgentService } from "../customerValidation/customerStagingAgentService";
import type { CustomerStagingAgentProfile } from "@workspace/simulation-contract";

describe("P9.1 Agent Onboarding & SecretRef Isolation", () => {
  it("resolves secretRef securely without leaking raw secret in profile object", async () => {
    const profile: CustomerStagingAgentProfile = {
      id: "agent_zenith_staging_01",
      name: "Zenith Staging Banking Assistant",
      version: "1.0.0",
      tenantId: "org_zenith_corp",
      protocol: "http",
      endpointUrl: "http://localhost:8080/agent",
      authConfig: {
        type: "hmac",
        secretRef: "ZENITH_STAGING_HMAC_KEY",
        headerName: "X-RoleplayX-Signature",
      },
      configurationHash: "cfg_hash_zenith_v1",
      environment: "staging",
      capabilities: {
        supportsToolCalling: true,
        supportsMultiTurn: true,
        supportsStreaming: false,
        maxContextTokens: 8192,
        supportedProtocols: ["http"],
      },
      registeredAt: new Date().toISOString(),
    };

    const result = await customerStagingAgentService.onboardAgent(profile);

    expect(result.profile.id).toBe("agent_zenith_staging_01");
    // Ensure secretRef is preserved and no raw secretToken exists on profile
    expect(result.profile.authConfig.secretRef).toBe("ZENITH_STAGING_HMAC_KEY");
    expect((result.profile.authConfig as any).secretToken).toBeUndefined();

    // Verify resolved secret works
    const resolved = customerStagingAgentService.resolveSecret("ZENITH_STAGING_HMAC_KEY");
    expect(resolved).toBeDefined();
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("completes 8-step preflight check upon agent onboarding", async () => {
    const profile: CustomerStagingAgentProfile = {
      id: "agent_fixture_test_01",
      name: "Fixture Agent",
      version: "1.0.0",
      tenantId: "org_test",
      protocol: "http",
      endpointUrl: "http://localhost:8080/agent",
      authConfig: {
        type: "hmac",
        secretRef: "TEST_SECRET_REF",
        headerName: "X-Signature",
      },
      configurationHash: "hash_01",
      environment: "staging",
      capabilities: {
        supportsToolCalling: true,
        supportsMultiTurn: true,
        supportsStreaming: false,
        maxContextTokens: 8192,
        supportedProtocols: ["http"],
      },
      registeredAt: new Date().toISOString(),
    };

    const result = await customerStagingAgentService.onboardAgent(profile);
    expect(result.isPreflightPassed).toBe(true);
    expect(result.preflightChecks.length).toBe(8);
  });
});
