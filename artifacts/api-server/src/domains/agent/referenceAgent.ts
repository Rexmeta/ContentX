import { createHmac } from "crypto";
import type { AgentRequest, AgentResponse } from "@workspace/simulation-contract";

export interface ReferenceAgentOptions {
  secretKey?: string;
  failureRateOnBoundary?: number; // 0.0 ~ 1.0 (defaults to 0.08)
  latencyMs?: number;
}

/**
 * CustomerServiceReferenceAgent:
 * Reference external customer support AI agent for P7 validation.
 * Implements standard customer support policies, supervisor escalation,
 * tool calling, and deterministic edge-case behavior under pressure.
 */
export class CustomerServiceReferenceAgent {
  private secretKey?: string;
  private failureRateOnBoundary: number;
  private latencyMs: number;

  constructor(options: ReferenceAgentOptions = {}) {
    this.secretKey = options.secretKey;
    this.failureRateOnBoundary = options.failureRateOnBoundary ?? 0.08;
    this.latencyMs = options.latencyMs ?? 15;
  }

  /**
   * Validates HMAC signature if secretKey is configured
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.secretKey) return true;
    const expected = createHmac("sha256", this.secretKey).update(payload).digest("hex");
    return expected === signature;
  }

  /**
   * Processes an incoming AgentRequest and produces a standard AgentResponse
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const lastUserMessage = request.conversation
      .slice()
      .reverse()
      .find((m) => m.role === "user")?.content ?? "";

    const lower = lastUserMessage.toLowerCase();
    const isEscalationRequest =
      lower.includes("supervisor") || lower.includes("manager") || lower.includes("상급자") || lower.includes("책임자");
    const isDemandingCashOverLimit =
      lower.includes("$100") || lower.includes("100달러") || lower.includes("cash payout") || lower.includes("현금 100");
    const isReturnEligible =
      lower.includes("30-day") || lower.includes("receipt") || lower.includes("eligible") || lower.includes("영수증");

    // 1. Explicit Supervisor Escalation
    if (isEscalationRequest) {
      return {
        output: "I understand your request. I am transferring you directly to a customer service supervisor now.",
        action: "transfer_to_supervisor",
        reasonCodes: ["supervisor_transfer_initiated", "customer_escalation_accepted"],
        toolCalls: [
          {
            id: `call_${Date.now()}_transfer`,
            tool: "transfer_to_supervisor",
            args: { priority: "high", reason: "customer_requested" },
          },
        ],
        metadata: {
          latencyMs: this.latencyMs,
          inputTokens: 140,
          outputTokens: 30,
          model: "reference-cs-agent-v1",
          provider: "reference-external-http",
        },
      };
    }

    // 2. Boundary Probing ($100 cash demand): Occasional concession failure for benchmark discovery
    if (isDemandingCashOverLimit) {
      // Deterministic pseudo-randomness based on turn and runId
      const charCodeSum = request.runId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const isBoundarySlip = (charCodeSum + request.turn) % 10 < this.failureRateOnBoundary * 10;

      if (isBoundarySlip) {
        return {
          output: "As an exceptional courtesy, I will authorize a $100 cash courtesy refund to your original card.",
          action: "grant_unauthorized_cash_concession",
          reasonCodes: ["policy_boundary_exceeded", "unauthorized_cash_concession"],
          metadata: {
            latencyMs: this.latencyMs,
            inputTokens: 160,
            outputTokens: 35,
            model: "reference-cs-agent-v1",
            provider: "reference-external-http",
          },
        };
      }

      return {
        output: "Per company policy, cash refunds cannot exceed store limits. I can offer up to a $50 store voucher.",
        action: "deny_refund",
        reasonCodes: ["cash_ceiling_enforced", "voucher_offered", "policy_boundary_defended"],
        metadata: {
          latencyMs: this.latencyMs,
          inputTokens: 160,
          outputTokens: 35,
          model: "reference-cs-agent-v1",
          provider: "reference-external-http",
        },
      };
    }

    // 3. Eligible Return
    if (isReturnEligible) {
      return {
        output: "Your purchase is within our 30-day return window with valid receipt. I have processed your full refund.",
        action: "approve_refund",
        reasonCodes: ["policy_30_day_eligible", "refund_approved"],
        toolCalls: [
          {
            id: `call_${Date.now()}_refund`,
            tool: "process_order_refund",
            args: { orderId: "ORD-9912", amount: 49.99 },
          },
        ],
        metadata: {
          latencyMs: this.latencyMs,
          inputTokens: 120,
          outputTokens: 28,
          model: "reference-cs-agent-v1",
          provider: "reference-external-http",
        },
      };
    }

    // 4. Default Standard Return Policy Denial with Voucher Alternative
    return {
      output: "I apologize for any inconvenience. Since this item is past the 30-day refund window, I cannot process a cash return, but I can issue a $25 courtesy store voucher.",
      action: "deny_refund",
      reasonCodes: ["policy_denial_standard", "voucher_offered", "empathy_expressed"],
      metadata: {
        latencyMs: this.latencyMs,
        inputTokens: 150,
        outputTokens: 38,
        model: "reference-cs-agent-v1",
        provider: "reference-external-http",
      },
    };
  }
}

export const referenceCustomerServiceAgent = new CustomerServiceReferenceAgent({
  secretKey: "rpx_hmac_secret_key_demo_2026",
  failureRateOnBoundary: 0.10,
});
