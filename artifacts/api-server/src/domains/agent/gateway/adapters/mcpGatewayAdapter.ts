import type {
  AgentRequest,
  AgentResponse,
  AgentHealth,
  ExternalAgentRegistration,
} from "@workspace/simulation-contract";
import type { GatewayAgentAdapter } from "../gatewayAdapter";
import { AgentResponseSchema } from "@workspace/simulation-contract";

/**
 * Model Context Protocol (MCP) Adapter:
 * Encapsulates JSON-RPC tool and context exchanges according to the MCP specification.
 */
export class McpGatewayAdapter implements GatewayAgentAdapter {
  readonly protocol = "mcp";

  async checkHealth(registration: ExternalAgentRegistration): Promise<AgentHealth> {
    if (registration.endpointUrl && !registration.endpointUrl.startsWith("mock://")) {
      try {
        const response = await fetch(registration.endpointUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: "health", method: "tools/list", params: {} }),
        });
        if (!response.ok) throw new Error(`MCP endpoint returned ${response.status}`);
      } catch (error) {
        return {
          status: "unreachable",
          latencyMs: 0,
          checkedAt: new Date().toISOString(),
          details: error instanceof Error ? error.message : "MCP health check failed",
        };
      }
    }
    return {
      status: "healthy",
      latencyMs: 5,
      checkedAt: new Date().toISOString(),
      details: `MCP JSON-RPC Server ready for tool calling (Server ID: ${registration.id})`,
    };
  }

  async dispatch(request: AgentRequest, registration: ExternalAgentRegistration): Promise<AgentResponse> {
    if (registration.endpointUrl && !registration.endpointUrl.startsWith("mock://")) {
      const response = await fetch(registration.endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: request.runId,
          method: "agent/respond",
          params: { request },
        }),
      });
      if (!response.ok) throw new Error(`MCP endpoint returned ${response.status}`);
      const body = await response.json() as { result?: unknown };
      const parsed = AgentResponseSchema.safeParse(body.result ?? body);
      if (!parsed.success) throw new Error("MCP endpoint returned an invalid AgentResponse");
      return parsed.data;
    }
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
