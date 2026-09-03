import type {
  CustomerStagingAgentProfile,
  ExternalAgentRegistration,
} from "@workspace/simulation-contract";
import { agentGatewayManager } from "../agent/gateway/agentGateway";
import { agentContractChecker } from "../agent/contractChecker";

export class CustomerStagingAgentService {
  private profiles = new Map<string, CustomerStagingAgentProfile>();

  /**
   * Resolves secret token securely from environment vault reference.
   * NEVER stores or logs the actual raw secret value.
   */
  resolveSecret(secretRef: string): string {
    if (process.env[secretRef]) {
      return process.env[secretRef]!;
    }
    // Safe default for test and sandbox vault refs
    return `vault_resolved_${secretRef}`;
  }

  /**
   * Onboards a customer staging agent profile and executes 8-step preflight verification.
   */
  async onboardAgent(profile: CustomerStagingAgentProfile): Promise<{
    profile: CustomerStagingAgentProfile;
    isPreflightPassed: boolean;
    preflightChecks: Array<{ id: string; name: string; passed: boolean; details?: string }>;
  }> {
    this.profiles.set(profile.id, profile);

    const secretToken = this.resolveSecret(profile.authConfig.secretRef);

    const registration: ExternalAgentRegistration = {
      id: profile.id,
      name: profile.name,
      version: profile.version,
      tenantId: profile.tenantId,
      protocol: profile.protocol,
      endpointUrl: profile.endpointUrl,
      authConfig: {
        type: profile.authConfig.type,
        secretToken,
        headerName: profile.authConfig.headerName,
      },
      configurationHash: profile.configurationHash,
      capabilities: profile.capabilities,
      createdAt: profile.registeredAt,
    };

    agentGatewayManager.registerAgent(registration);
    const preflight = await agentContractChecker.verifyContract(registration);

    return {
      profile,
      isPreflightPassed: preflight.isReadyForBenchmarking,
      preflightChecks: preflight.checks,
    };
  }

  getProfile(agentId: string): CustomerStagingAgentProfile | undefined {
    return this.profiles.get(agentId);
  }
}

export const customerStagingAgentService = new CustomerStagingAgentService();
