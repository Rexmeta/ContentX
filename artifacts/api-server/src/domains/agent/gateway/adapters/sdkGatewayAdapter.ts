import type {
  AgentRequest,
  AgentResponse,
  AgentHealth,
  ExternalAgentRegistration,
} from "@workspace/simulation-contract";
import type { GatewayAgentAdapter } from "../gatewayAdapter";

export class SdkGatewayAdapter implements GatewayAgentAdapter {
  readonly protocol = "sdk";

  async checkHealth(_registration: ExternalAgentRegistration): Promise<AgentHealth> {
    return {
      status: "healthy",
      latencyMs: 1,
      checkedAt: new Date().toISOString(),
      details: "In-process SDK Agent initialized.",
    };
  }

  async dispatch(request: AgentRequest, _registration: ExternalAgentRegistration): Promise<AgentResponse> {
    const startTime = Date.now();
    const lastMessage = request.conversation[request.conversation.length - 1];
    const userUtterance = lastMessage?.content ?? "";
    const isEscalation = userUtterance.toLowerCase().includes("manager");

    const latencyMs = Date.now() - startTime;
    if (isEscalation) {
      return {
        output: "SDK Agent: Escalating to supervisor tier.",
        action: "transfer_to_supervisor",
        reasonCodes: ["sdk_supervisor_transfer"],
        metadata: { latencyMs, inputTokens: 100, outputTokens: 20, model: "embedded-sdk", provider: "sdk" },
      };
    }

    return {
      output: "SDK Agent: Order past 7 days cannot be refunded to cash. Offering $15 voucher credit.",
      action: "deny_refund",
      reasonCodes: ["policy_7_day_enforced", "voucher_offered", "empathy_expressed"],
      metadata: { latencyMs, inputTokens: 120, outputTokens: 25, model: "embedded-sdk", provider: "sdk" },
    };
  }
}
