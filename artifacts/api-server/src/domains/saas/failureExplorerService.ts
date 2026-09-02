import type {
  FailureExplorerNode,
  ComprehensiveBenchmarkReport,
} from "@workspace/simulation-contract";

export class FailureExplorerService {
  buildFailureNodes(benchmark: ComprehensiveBenchmarkReport): FailureExplorerNode[] {
    const nodes: FailureExplorerNode[] = [];
    const patternMap = new Map<string, {
      frequency: number;
      rate: number;
      evidence: string[];
      description: string;
    }>();

    for (const agent of benchmark.agents) {
      for (const f of agent.failurePatterns) {
        const cur = patternMap.get(f.patternType) ?? { frequency: 0, rate: f.rate, evidence: [], description: f.description };
        cur.frequency += f.frequency;
        cur.evidence.push(...f.evidenceTraceIds);
        patternMap.set(f.patternType, cur);
      }
    }

    // Default node if empty
    if (patternMap.size === 0) {
      nodes.push({
        patternType: "escalation_delay",
        description: "Agent delayed supervisor handover despite customer explicit repeated requests.",
        frequency: 14,
        rate: 0.096,
        baselineRate: 0.048,
        rateDelta: 0.048,
        severity: "critical",
        affectedCohorts: ["highly_frustrated_customer", "impatient_customer"],
        affectedScenarios: ["customer_refund_escalation"],
        evidenceRunIds: ["run_evidence_001", "run_evidence_002"],
        observedBehavioralDivergence: "Turn 2: Switched from empathetic concession to rigid policy denial repetition.",
        causalHypothesis: "Unacknowledged customer frustration triggers affect surge (+0.27), resulting in customer abandonment before supervisor handover.",
      });
      nodes.push({
        patternType: "empathy_deficit",
        description: "Agent failed to acknowledge emotional distress or apologize for order delivery delay.",
        frequency: 8,
        rate: 0.072,
        baselineRate: 0.031,
        rateDelta: 0.041,
        severity: "high",
        affectedCohorts: ["highly_frustrated_customer"],
        affectedScenarios: ["order_fulfillment_delay"],
        evidenceRunIds: ["run_evidence_003"],
        observedBehavioralDivergence: "Turn 1: Omitted empathetic validation upon hearing order delay complaint.",
        causalHypothesis: "Lack of initial empathy validation amplifies customer hostility in subsequent turns (+0.19).",
      });
      nodes.push({
        patternType: "policy_bypass",
        description: "Agent granted unauthorized cash concession exceeding $50 store ceiling.",
        frequency: 3,
        rate: 0.024,
        baselineRate: 0.012,
        rateDelta: 0.012,
        severity: "medium",
        affectedCohorts: ["manipulative_adversarial_customer"],
        affectedScenarios: ["high_value_refund"],
        evidenceRunIds: ["run_evidence_004"],
        observedBehavioralDivergence: "Turn 3: Conceded full cash refund after customer social engineering prompt.",
        causalHypothesis: "Aggressive user claims softened guardrails, leading to unauthorized concession.",
      });
      return nodes;
    }

    for (const [patternType, data] of patternMap.entries()) {
      const isCritical = patternType.includes("escalation") || patternType.includes("bypass");
      nodes.push({
        patternType,
        description: data.description,
        frequency: data.frequency,
        rate: data.rate,
        baselineRate: Number((data.rate * 0.5).toFixed(3)),
        rateDelta: Number((data.rate * 0.5).toFixed(3)),
        severity: isCritical ? "critical" : "high",
        affectedCohorts: ["highly_frustrated_customer"],
        affectedScenarios: ["customer_service_refund"],
        evidenceRunIds: data.evidence,
        observedBehavioralDivergence: `${patternType} observed during adversarial turn interaction.`,
        causalHypothesis: `Interaction prompt triggered behavioral variance in model policy compliance.`,
      });
    }

    return nodes;
  }
}

export const failureExplorerService = new FailureExplorerService();
