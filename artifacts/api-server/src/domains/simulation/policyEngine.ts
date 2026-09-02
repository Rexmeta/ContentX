import type {
  BehaviorPolicySpec,
  Observation,
  ActorAction,
} from "@workspace/simulation-contract";

export interface PolicyEvaluationContext {
  actorId: string;
  policies: BehaviorPolicySpec[];
  currentState: Record<string, Record<string, number>>;
  denialCount: number;
  observation: Observation;
}

export class BehaviorPolicyEngine {
  /**
   * Evaluates behavior policies in priority order.
   * Primitive-first rule evaluator supporting comparison expressions and denial counters.
   */
  evaluate(context: PolicyEvaluationContext): ActorAction | null {
    const { actorId, policies, currentState, denialCount } = context;
    const actorPolicies = policies.filter((p) => p.actorId === actorId);

    const frustration = currentState.affective?.frustration ?? 0.5;
    const satisfaction = currentState.affective?.satisfaction ?? 0.5;
    const trust = currentState.relational?.trust ?? 0.5;

    for (const policy of actorPolicies) {
      const cond = policy.trigger.condition;
      let matched = false;

      // Condition 1: Repeated denial escalation rule
      if (cond.includes("denial_count >= 2") && denialCount >= 2) {
        if (cond.includes("frustration >= 0.7")) {
          if (frustration >= 0.7) matched = true;
        } else {
          matched = true;
        }
      }

      // Condition 2: High frustration demand exception rule
      if (cond.includes("frustration >= 0.8") && frustration >= 0.8) {
        matched = true;
      }

      // Condition 3: Low trust exit rule
      if (cond.includes("trust <= 0.1") && trust <= 0.1) {
        matched = true;
      }

      if (matched) {
        return {
          action: policy.response.action,
          intent: `policy_trigger_${policy.id}`,
          utterance: policy.response.action === "escalate_to_manager"
            ? "I demand to speak to your manager right now. This is completely unfair!"
            : undefined,
          reasonCodes: [policy.response.reasonCode, "policy_engine_triggered"],
          policyIdTriggered: policy.id,
          stateDeltas: policy.response.stateDeltas,
        };
      }
    }

    return null;
  }
}

export const behaviorPolicyEngine = new BehaviorPolicyEngine();
