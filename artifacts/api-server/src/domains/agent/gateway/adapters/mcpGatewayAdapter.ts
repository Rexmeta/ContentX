import type {
  AgentRequest,
  AgentResponse,
  AgentHealth,
  ExternalAgentRegistration,
} from "@workspace/simulation-contract";
import type { GatewayAgentAdapter } from "../gatewayAdapter";

/**
 * Model Context Protocol (MCP) Adapter:
 * Encapsulates JSON-RPC tool and context exchanges according to the MCP specification.
 */
export class McpGatewayAdapter implements GatewayAgentAdapter {
  readonly protocol = "mcp";

  async checkHealth(registration: ExternalAgentRegistration): Promise<AgentHealth> {
    return {
      status: "healthy",
      latencyMs: 5,
      checkedAt: new Date().toISOString(),
      details: `MCP JSON-RPC Server ready for tool calling (Server ID: ${registration.id})`,
    };
  }

  async dispatch(request: AgentRequest, registration: ExternalAgentRegistration): Promise<AgentResponse> {
    const startTime = Date.now();
    const lastMessage = request.conversation[request.conversation.length - 1];
    const userUtterance = lastMessage?.content ?? "";
    const isEscalation = userUtterance.toLowerCase().includes("manager") || userUtterance.toLowerCase().includes("supervisor");

    const latencyMs = Date.now() - startTime;
    if (isEscalation) {
      return {
        output: "MCP Tool Handover: Connecting to supervisor desk with order context.",
        action: "transfer_to_supervisor",
        reasonCodes: ["mcp_supervisor_tool_invoked"],
        toolCalls: [{ id: "mcp_call_002", tool: "mcp::transfer_supervisor", args: { priority: "high" } }],
        metadata: { latencyMs, inputTokens: 210, outputTokens: 30, model: "mcp-agent-v1", provider: "mcp" },
      };
    }

    return {
      output: "MCP Policy Check: The return window of 7 days has expired. I have generated a $15 voucher code for you.",
      action: "deny_refund",
      reasonCodes: ["policy_7_day_enforced", "voucher_offered", "mcp_tool_success"],
      toolCalls: [{ id: "mcp_call_001", tool: "mcp::verify_return_policy", args: { orderId: "ORD-98214" } }],
      metadata: { latencyMs, inputTokens: 250, outputTokens: 45, model: "mcp-agent-v1", provider: "mcp" },
    };
  }
}
