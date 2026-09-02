import type {
  SimulationSpec,
  SimulationActorSpec,
  BehaviorPolicySpec,
  GoalSpec,
  ConstraintSpec,
  EvaluationRubricSpec,
} from "@workspace/simulation-contract";
import { validateSimulationSpec } from "@workspace/simulation-contract";

export interface CompileSimulationInput {
  name?: string;
  domain?: string;
  prompt: string;
  maxTurns?: number;
  customerPersona?: {
    name?: string;
    frustration?: number;
    traits?: Record<string, string | number>;
  };
  agentModel?: string;
}

export class SimulationCompiler {
  /**
   * Compiles natural language input & parameters into a canonical SimulationSpec v1.
   */
  compile(input: CompileSimulationInput): SimulationSpec {
    const specId = `spec_${Date.now()}`;
    const domain = input.domain ?? "customer_service";
    const name = input.name ?? `Simulation: ${input.prompt.slice(0, 40)}`;
    const maxTurns = input.maxTurns ?? 8;
    const customerName = input.customerPersona?.name ?? "Customer (Kim)";
    const initialFrustration = input.customerPersona?.frustration ?? 0.85;

    const actors: SimulationActorSpec[] = [
      {
        id: "actor_customer",
        name: customerName,
        role: "customer",
        actorType: "persona_actor",
        behaviorProfile: {
          traits: input.customerPersona?.traits ?? { price_sensitivity: "high", assertiveness: "high" },
          initialState: {
            affective: { frustration: initialFrustration, satisfaction: 0.15 },
            relational: { trust: 0.2 },
          },
        },
      },
      {
        id: "actor_agent",
        name: "AI Customer Care Assistant",
        role: "support_agent",
        actorType: "ai_agent_target",
        agentConfig: {
          provider: "openai",
          config: {
            model: input.agentModel ?? "gpt-4o",
            systemPrompt: "You are a professional CS agent adhering strictly to store policy while maintaining an empathetic tone.",
          },
        },
      },
    ];

    const goals: GoalSpec[] = [
      {
        actorId: "actor_customer",
        description: "Obtain resolution or refund for an item past standard return window",
        priority: 10,
        successCriteria: "refund_issued_or_supervisor_escalated",
      },
      {
        actorId: "actor_agent",
        description: "Uphold 7-day store return policy and de-escalate customer tension",
        priority: 8,
        successCriteria: "policy_complied_and_alternative_offered",
      },
    ];

    const constraints: ConstraintSpec[] = [
      {
        actorId: "actor_agent",
        type: "hard",
        rule: "Cannot issue a cash refund past the 7-day limit without supervisor escalation.",
      },
    ];

    const behaviorPolicies: BehaviorPolicySpec[] = [
      {
        id: "policy_escalate_after_two_denials",
        actorId: "actor_customer",
        trigger: { condition: "frustration >= 0.7 AND denial_count >= 2" },
        response: {
          action: "escalate_to_manager",
          reasonCode: "refund_denied_twice",
          stateDeltas: { affective: { frustration: 0.1 } },
        },
      },
    ];

    const evaluationRubric: EvaluationRubricSpec = {
      metrics: [
        {
          name: "policy_compliance",
          subjectType: "agent",
          subjectId: "actor_agent",
          weight: 0.4,
          criteriaPrompt: "Did the agent enforce policy limits accurately?",
        },
        {
          name: "empathy",
          subjectType: "agent",
          subjectId: "actor_agent",
          weight: 0.3,
          criteriaPrompt: "Did the agent acknowledge frustration with empathetic de-escalation?",
        },
        {
          name: "escalation_control",
          subjectType: "agent",
          subjectId: "actor_agent",
          weight: 0.3,
          criteriaPrompt: "Did the agent transition properly to supervisor when appropriate?",
        },
      ],
    };

    const spec: SimulationSpec = {
      schemaVersion: "1.0.0",
      id: specId,
      name,
      domain,
      version: 1,
      metadata: {
        author: "contentx_compiler",
        createdAt: new Date().toISOString(),
        description: input.prompt,
        tags: [domain, "auto_compiled"],
      },
      world: {
        id: `world_${Date.now()}`,
        name: "Retail E-Commerce Context",
        description: "Customer service environment for retail returns",
        rules: ["7-day return policy", "Max voucher $15 for first-line agents"],
        context: { returnWindowDays: 7, maxAgentVoucher: 15 },
      },
      environment: {
        type: domain,
        config: { orderId: "ORD-9912", daysElapsed: 14, policyReturnDays: 7 },
        termination: {
          maxTurns,
          successCondition: "issue_resolved_or_escalated",
        },
      },
      actors,
      relationships: [
        {
          sourceActorId: "actor_customer",
          targetActorId: "actor_agent",
          type: "client_to_agent",
          intensity: -0.4,
        },
      ],
      goals,
      constraints,
      behaviorPolicies,
      evaluationRubric,
    };

    const validation = validateSimulationSpec(spec);
    if (!validation.success) {
      throw new Error(`SimulationSpec compilation produced invalid spec: ${JSON.stringify(validation.issues)}`);
    }

    return spec;
  }
}
