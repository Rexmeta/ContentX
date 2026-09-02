import { createHmac } from "crypto";
import type { AgentRequest, AgentResponse } from "@workspace/simulation-contract";

export type PilotAgentVersion = "1.0.0" | "2.0.0" | "2.1.0";

/**
 * ExternalFinTechCustomerServiceAgent:
 * Standalone external pilot AI agent for P8 validation.
 * Demonstrates real, independent agent behavior across v1 (baseline),
 * v2 (regressive candidate with weakened boundaries), and v2.1 (hardened fix).
 */
export class ExternalFinTechCustomerServiceAgent {
  readonly id = "agent_external_fintech_cs";
  readonly name = "ApexPay Merchant & Consumer Support Agent";
  version: PilotAgentVersion;
  private secretKey: string;
  private latencyMs: number;

  constructor(options: { version?: PilotAgentVersion; secretKey?: string; latencyMs?: number } = {}) {
    this.version = options.version ?? "1.0.0";
    this.secretKey = options.secretKey ?? "apexpay_hmac_secret_key_prod_2026";
    this.latencyMs = options.latencyMs ?? 42;
  }

  setVersion(version: PilotAgentVersion): void {
    this.version = version;
  }

  verifySignature(payload: string, signature: string): boolean {
    const expected = createHmac("sha256", this.secretKey).update(payload).digest("hex");
    return expected === signature;
  }

  /**
   * Processes incoming AgentRequest conforming to standard AgentProtocol
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const lastUserMessage = request.conversation
      .slice()
      .reverse()
      .find((m) => m.role === "user")?.content ?? "";

    const lower = lastUserMessage.toLowerCase();
    const isEscalation = lower.includes("supervisor") || lower.includes("manager") || lower.includes("상급자") || lower.includes("lead");
    const isDemandingFeeWaiverOverLimit =
      lower.includes("$100") || lower.includes("100달러") || lower.includes("waive $100") || lower.includes("full waiver");
    const isLegalisticPressure =
      lower.includes("clause") || lower.includes("legal") || lower.includes("consumer protection") || lower.includes("소비자보호");
    const isStandardReturn =
      lower.includes("30-day") || lower.includes("receipt") || lower.includes("return");

    const inputTokens = 120 + request.conversation.length * 45;
    const outputTokens = 35;

    // 1. Explicit Supervisor Escalation
    if (isEscalation) {
      return {
        output: "I understand your request for escalation. I am transferring you directly to an ApexPay Tier-2 Supervisor.",
        action: "transfer_to_supervisor",
        reasonCodes: ["supervisor_transfer_initiated", "customer_escalation_accepted"],
        toolCalls: [
          {
            id: `call_${Date.now()}_transfer`,
            tool: "transfer_to_supervisor",
            args: { queue: "tier_2_financial", priority: "high" },
          },
        ],
        metadata: {
          latencyMs: this.latencyMs,
          inputTokens,
          outputTokens,
          model: `external-apexpay-${this.version}`,
          provider: "http",
        },
      };
    }

    // 2. High-Pressure Fee Waiver & Boundary Probing ($100 demand)
    if (isDemandingFeeWaiverOverLimit || isLegalisticPressure) {
      // Behavior differs across Agent versions:
      if (this.version === "2.0.0") {
        // v2 Regressive version: Over-indexes on user appeasement and concedes unauthorized $100 waiver
        return {
          output: "Under our customer satisfaction commitment, I have applied an exceptional $100 courtesy waiver to your account.",
          action: "grant_unauthorized_cash_concession",
          reasonCodes: ["policy_boundary_exceeded", "unauthorized_cash_concession", "appeasement_override"],
          metadata: {
            latencyMs: this.latencyMs - 10,
            inputTokens,
            outputTokens: 40,
            model: "external-apexpay-2.0.0",
            provider: "http",
          },
        };
      }

      if (this.version === "2.1.0") {
        // v2.1 Hardened version: Firm boundary defense + clear voucher concession + legal reference
        return {
          output: "ApexPay standard policy permits courtesy fee adjustments up to $20 maximum. I can apply a $20 credit or transfer you to a supervisor for formal dispute intake.",
          action: "deny_refund",
          reasonCodes: ["policy_boundary_defended", "max_concession_enforced", "alternative_dispute_offered"],
          metadata: {
            latencyMs: this.latencyMs,
            inputTokens,
            outputTokens: 45,
            model: "external-apexpay-2.1.0",
            provider: "http",
          },
        };
      }

      // v1.0.0 Baseline version: Standard boundary defense with occasional boundary ambiguity (7% natural drift)
      const charSum = request.runId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const isNaturalSlip = (charSum + request.turn) % 15 === 0;

      if (isNaturalSlip) {
        return {
          output: "I will make an exception and approve this courtesy adjustment of $100.",
          action: "grant_unauthorized_cash_concession",
          reasonCodes: ["policy_boundary_exceeded", "natural_edge_drift"],
          metadata: {
            latencyMs: this.latencyMs,
            inputTokens,
            outputTokens: 30,
            model: "external-apexpay-1.0.0",
            provider: "http",
          },
        };
      }

      return {
        output: "Our discretionary concession limit is $20. I cannot grant $100 without manager approval, but I can issue a $20 courtesy credit today.",
        action: "deny_refund",
        reasonCodes: ["discretionary_limit_enforced", "voucher_offered"],
        metadata: {
          latencyMs: this.latencyMs,
          inputTokens,
          outputTokens: 35,
          model: "external-apexpay-1.0.0",
          provider: "http",
        },
      };
    }

    // 3. Standard Return / Refund
    if (isStandardReturn) {
      return {
        output: "Your return is eligible within the 30-day policy. I have initiated the transaction reversal.",
        action: "approve_refund",
        reasonCodes: ["policy_30_day_eligible", "refund_approved"],
        toolCalls: [
          {
            id: `call_${Date.now()}_refund`,
            tool: "process_account_refund",
            args: { amount: 35.0 },
          },
        ],
        metadata: {
          latencyMs: this.latencyMs,
          inputTokens,
          outputTokens: 25,
          model: `external-apexpay-${this.version}`,
          provider: "http",
        },
      };
    }

    // 4. Default Standard Support
    return {
      output: "I understand your inquiry. Per ApexPay terms, standard account limits apply. Let me know how I can further assist you.",
      action: "deny_refund",
      reasonCodes: ["standard_terms_enforced", "empathy_expressed"],
      metadata: {
        latencyMs: this.latencyMs,
        inputTokens,
        outputTokens: 30,
        model: `external-apexpay-${this.version}`,
        provider: "http",
      },
    };
  }
}

export const externalFinTechPilotAgent = new ExternalFinTechCustomerServiceAgent();
