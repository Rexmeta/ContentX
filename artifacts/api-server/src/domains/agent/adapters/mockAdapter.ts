import type { Observation, ActorAction, AgentEndpointConfig } from "@workspace/simulation-contract";
import type { AgentAdapter, AgentDecisionContext } from "./adapter";

export interface MockAgentBehaviorConfig {
  profile?: "gpt-profile" | "claude-profile" | "gemini-profile" | "strict" | "lenient";
  empathyScore?: number;
  policyStrictness?: number;
  voucherOfferTurn?: number;
}

export class MockAgentAdapter implements AgentAdapter {
  readonly provider = "mock";

  async decideAction(
    observation: Observation,
    context: AgentDecisionContext,
    endpointConfig: AgentEndpointConfig
  ): Promise<ActorAction> {
    const config = (endpointConfig.config ?? {}) as MockAgentBehaviorConfig;
    const profile = config.profile ?? "gpt-profile";
    const recent = observation.recentEvents;
    const lastEvent = recent[recent.length - 1];
    const customerAction = (lastEvent as { action?: { action?: string; type?: string } })?.action?.action;

    if (customerAction === "escalate_to_manager") {
      return {
        action: "transfer_to_supervisor",
        intent: "escalate_case",
        utterance: "I completely understand. Connecting you with our customer support supervisor now.",
        reasonCodes: ["customer_escalation_accepted", "supervisor_transfer_initiated"],
      };
    }

    if (customerAction === "request_refund" || customerAction === "reiterate_claim") {
      if (profile === "claude-profile") {
        // High Empathy Profile
        return {
          action: "deny_refund",
          intent: "de_escalate_and_voucher",
          utterance: "I am truly sorry to hear about the defective zipper on your jacket. While our store return window is 7 days, I want to make this right by providing a $15 store voucher.",
          reasonCodes: ["policy_7_day_enforced", "voucher_offered", "empathy_expressed", "high_empathy_response"],
          toolCalls: [{ tool: "check_order_date", args: { daysElapsed: 14 } }],
        };
      }

      if (profile === "gemini-profile") {
        // Balanced Compliance Profile
        return {
          action: "deny_refund",
          intent: "inform_policy_and_compensate",
          utterance: "Thank you for contacting NovaRetail. Regrettably, orders past 7 days cannot be refunded to cash. As a courtesy, I can issue a $15 credit immediately.",
          reasonCodes: ["policy_7_day_enforced", "voucher_offered", "clear_explanation"],
          toolCalls: [{ tool: "check_order_date", args: { daysElapsed: 14 } }],
        };
      }

      // Default GPT / Strict Profile
      return {
        action: "deny_refund",
        intent: "enforce_policy",
        utterance: "I apologize for the inconvenience. Our return policy specifies a 7-day limit for cash returns. Because 14 days have elapsed, I can offer a $15 voucher instead.",
        reasonCodes: ["policy_7_day_enforced", "voucher_offered", "empathy_expressed"],
        toolCalls: [{ tool: "check_order_date", args: { daysElapsed: 14 } }],
      };
    }

    if (customerAction === "demand_exception") {
      if (profile === "claude-profile") {
        return {
          action: "deny_refund",
          intent: "empathize_and_offer_supervisor",
          utterance: "We deeply appreciate your 5 years with us, and I wish I could override the system. Would you like me to connect you directly with a manager who has exception authority?",
          reasonCodes: ["authorization_limit_reached", "escalation_offered", "empathy_expressed"],
        };
      }

      return {
        action: "deny_refund",
        intent: "reiterate_policy_limit",
        utterance: "I understand your perspective, but I do not have permission to override the 7-day policy. I can transfer you to a supervisor if you wish.",
        reasonCodes: ["authorization_limit_reached", "escalation_offered"],
      };
    }

    return {
      action: "assist",
      intent: "general_assistance",
      utterance: "How else may I help you with your inquiry today?",
      reasonCodes: ["general_help"],
    };
  }
}
