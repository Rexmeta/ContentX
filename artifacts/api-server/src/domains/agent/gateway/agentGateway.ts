import { createHash } from "crypto";
import type {
  ExternalAgentRegistration,
  AgentRequest,
  AgentResponse,
  AgentHealth,
} from "@workspace/simulation-contract";
import type { GatewayAgentAdapter } from "./gatewayAdapter";
import { HttpGatewayAdapter } from "./adapters/httpGatewayAdapter";
import { McpGatewayAdapter } from "./adapters/mcpGatewayAdapter";
import { SdkGatewayAdapter } from "./adapters/sdkGatewayAdapter";
import { PIIRedactor } from "../../security/piiRedactor";

export class AgentGatewayManager {
  private registrations: Map<string, ExternalAgentRegistration> = new Map();
  private adapters: Map<string, GatewayAgentAdapter> = new Map<string, GatewayAgentAdapter>([
    ["http", new HttpGatewayAdapter()],
    ["webhook", new HttpGatewayAdapter()],
    ["mcp", new McpGatewayAdapter()],
    ["sdk", new SdkGatewayAdapter()],
  ]);

  registerAgent(input: Omit<ExternalAgentRegistration, "configurationHash" | "createdAt">): ExternalAgentRegistration {
    const rawPayload = JSON.stringify({
      id: input.id,
      version: input.version,
      protocol: input.protocol,
      endpointUrl: input.endpointUrl,
      capabilities: input.capabilities,
    });
    const configurationHash = createHash("sha256").update(rawPayload).digest("hex");

    const registration: ExternalAgentRegistration = {
      ...input,
      configurationHash,
      createdAt: new Date().toISOString(),
    };

    this.registrations.set(registration.id, registration);
    return registration;
  }

  getAgent(id: string): ExternalAgentRegistration | undefined {
    return this.registrations.get(id);
  }

  listAgents(tenantId?: string): ExternalAgentRegistration[] {
    const all = Array.from(this.registrations.values());
    if (tenantId) {
      return all.filter((a) => a.tenantId === tenantId);
    }
    return all;
  }

  getPublicAgent(id: string): ReturnType<typeof publicRegistration> | undefined {
    const registration = this.registrations.get(id);
    return registration ? publicRegistration(registration) : undefined;
  }

  listPublicAgents(tenantId?: string) {
    return this.listAgents(tenantId).map(publicRegistration);
  }

  async checkHealth(agentId: string): Promise<AgentHealth> {
    const registration = this.registrations.get(agentId);
    if (!registration) {
      return {
        status: "unreachable",
        latencyMs: 0,
        checkedAt: new Date().toISOString(),
        details: `Agent "${agentId}" not found in registry.`,
      };
    }

    const adapter = this.adapters.get(registration.protocol) ?? this.adapters.get("http")!;
    return adapter.checkHealth(registration);
  }

  async dispatch(request: AgentRequest): Promise<AgentResponse> {
    const registration = this.registrations.get(request.actor.id);
    const protocol = registration?.protocol ?? "http";
    const adapter = this.adapters.get(protocol) ?? this.adapters.get("http")!;

    const sanitizedRequest = PIIRedactor.redactObject(request);
    const response = await adapter.dispatch(
      sanitizedRequest,
      registration ?? {
        id: request.actor.id,
        name: request.actor.id,
        version: "1.0.0",
        tenantId: request.metadata.tenantId,
        protocol: "http",
        endpointUrl: "http://localhost/mock-agent",
        authConfig: { type: "none" },
        configurationHash: "default",
        capabilities: {
          supportsToolCalling: true,
          supportsMultiTurn: true,
          supportsStreaming: false,
          maxContextTokens: 8192,
          supportedProtocols: ["http"],
        },
        createdAt: new Date().toISOString(),
      }
    );

    return PIIRedactor.redactObject(response);
  }
}

export const agentGatewayManager = new AgentGatewayManager();

/**
 * Registration responses must never contain bearer/API-key/HMAC material.
 * The secret remains process-local and is only read by the protocol adapter.
 */
export function publicRegistration(registration: ExternalAgentRegistration) {
  const { authConfig, ...rest } = registration;
  return {
    ...rest,
    authConfig: {
      type: authConfig.type,
      ...(authConfig.headerName ? { headerName: authConfig.headerName } : {}),
    },
  };
}
