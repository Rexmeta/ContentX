import type {
  AgentRequest,
  AgentResponse,
  AgentHealth,
  ExternalAgentRegistration,
} from "@workspace/simulation-contract";

export interface GatewayAgentAdapter {
  readonly protocol: "http" | "mcp" | "sdk" | "webhook";
  checkHealth(registration: ExternalAgentRegistration): Promise<AgentHealth>;
  dispatch(request: AgentRequest, registration: ExternalAgentRegistration): Promise<AgentResponse>;
}
