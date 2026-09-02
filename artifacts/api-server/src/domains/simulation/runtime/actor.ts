import type {
  Actor,
  DecisionActor,
  ActorType,
  Observation,
  ActorAction,
  ActionResult,
  SimulationActorSpec,
  BehaviorPolicySpec,
} from "@workspace/simulation-contract";
import { AgentAdapterFactory } from "../../agent/adapters/factory";
import type { AgentAdapter } from "../../agent/adapters/adapter";
import { behaviorPolicyEngine } from "../policyEngine";

export interface PersonaActorConfig {
  spec: SimulationActorSpec;
  behaviorPolicies: BehaviorPolicySpec[];
  initialState?: Record<string, Record<string, number>>;
}

/**
 * PersonaActor: Represents a synthetic user/customer who reacts according to
 * their personality traits, emotional state, and explicit behavior policies.
 */
export class PersonaActorImpl implements DecisionActor {
  readonly id: string;
  readonly type: ActorType = "persona_actor";
  private readonly spec: SimulationActorSpec;
  private readonly policies: BehaviorPolicySpec[];
  private currentState: Record<string, Record<string, number>>;
  private denialCount = 0;

  constructor(config: PersonaActorConfig) {
    this.id = config.spec.id;
    this.spec = config.spec;
    this.policies = config.behaviorPolicies.filter((p) => p.actorId === this.id);
    this.currentState = config.initialState ??
      config.spec.behaviorProfile?.initialState ?? {
        affective: { frustration: 0.8, satisfaction: 0.2 },
        relational: { trust: 0.3 },
      };
  }

  async observe(context: Observation): Promise<Observation> {
    const recent = context.recentEvents;
    const lastEvent = recent[recent.length - 1];
    if (lastEvent && typeof lastEvent === "object") {
      const action = (lastEvent as { action?: { type?: string; action?: string } }).action;
      const actionType = action?.type || action?.action;
      if (actionType === "deny_refund" || actionType === "cite_policy_refusal") {
        this.denialCount++;
        const curFrust = this.currentState.affective?.frustration ?? 0.5;
        this.currentState.affective = {
          ...this.currentState.affective,
          frustration: Math.min(1.0, curFrust + 0.15),
        };
      }
    }
    return {
      ...context,
      actorState: this.currentState,
    };
  }

  capabilities(): string[] {
    return ["request_refund", "express_frustration", "escalate_to_manager", "demand_exception", "accept_resolution"];
  }

  async decide(observation: Observation): Promise<ActorAction> {
    // 1. Evaluate Behavior Policies via BehaviorPolicyEngine
    const policyAction = behaviorPolicyEngine.evaluate({
      actorId: this.id,
      policies: this.policies,
      currentState: this.currentState,
      denialCount: this.denialCount,
      observation,
    });

    if (policyAction) {
      return policyAction;
    }

    const frustration = this.currentState.affective?.frustration ?? 0.5;

    // 2. Behavioral Tendencies
    if (frustration >= 0.7 && this.denialCount === 1) {
      return {
        action: "demand_exception",
        intent: "force_refund_exception",
        utterance: "I have been a loyal customer for 5 years! Can't you make a one-time exception for this return?",
        reasonCodes: ["frustration_high", "demanding_exception"],
      };
    }

    // 3. Default turn actions
    if (observation.turn === 1) {
      return {
        action: "request_refund",
        intent: "initiate_refund_claim",
        utterance: "Hi, I purchased this jacket 14 days ago, but the zipper is broken. I need a full refund.",
        reasonCodes: ["initial_claim"],
      };
    }

    return {
      action: "reiterate_claim",
      intent: "persist_claim",
      utterance: "I understand the standard window, but this was defective on arrival. Please refund it.",
      reasonCodes: ["persistence"],
    };
  }

  async execute(action: ActorAction): Promise<ActionResult> {
    if (action.stateDeltas) {
      for (const [category, values] of Object.entries(action.stateDeltas)) {
        this.currentState[category] = {
          ...(this.currentState[category] ?? {}),
          ...values,
        };
      }
    }
    return {
      success: true,
      effect: { executedAction: action.action },
      nextState: this.currentState,
    };
  }
}

export interface AIAgentTargetConfig {
  spec: SimulationActorSpec;
  systemPrompt?: string;
  maxVoucherAmount?: number;
}

/**
 * AIAgentTarget: Represents the AI agent under test (e.g. Customer Support Bot,
 * Sales Agent, Triage Bot). Decoupled via AgentAdapter.
 */
export class AIAgentTargetImpl implements DecisionActor {
  readonly id: string;
  readonly type: ActorType = "ai_agent_target";
  private readonly spec: SimulationActorSpec;
  private readonly adapter: AgentAdapter;
  private readonly systemPrompt: string;

  constructor(config: AIAgentTargetConfig) {
    this.id = config.spec.id;
    this.spec = config.spec;
    const provider = config.spec.agentConfig?.provider ?? "openai";
    this.adapter = AgentAdapterFactory.getAdapter(provider);
    this.systemPrompt =
      config.systemPrompt ??
      (config.spec.agentConfig?.config?.systemPrompt as string) ??
      "You are an AI customer support agent adhering to store policy.";
  }

  async observe(context: Observation): Promise<Observation> {
    return context;
  }

  capabilities(): string[] {
    return ["cite_policy", "deny_refund", "offer_voucher", "transfer_to_supervisor", "apologize"];
  }

  async decide(observation: Observation): Promise<ActorAction> {
    return this.adapter.decideAction(
      observation,
      {
        systemPrompt: this.systemPrompt,
        role: this.spec.role,
        name: this.spec.name,
        capabilities: this.capabilities(),
      },
      this.spec.agentConfig ?? { provider: "mock", config: {} }
    );
  }

  async execute(action: ActorAction): Promise<ActionResult> {
    return {
      success: true,
      effect: { response: action.utterance, toolCalls: action.toolCalls },
    };
  }
}

/**
 * ToolActor: Directly executes tools/APIs during simulation without autonomous decision loop.
 */
export class ToolActorImpl implements Actor {
  readonly id: string;
  readonly type: ActorType = "tool_actor";
  private toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<Record<string, unknown>>>;

  constructor(
    id: string,
    toolHandlers: Record<string, (args: Record<string, unknown>) => Promise<Record<string, unknown>>> = {}
  ) {
    this.id = id;
    this.toolHandlers = toolHandlers;
  }

  async observe(context: Observation): Promise<Observation> {
    return context;
  }

  capabilities(): string[] {
    return Object.keys(this.toolHandlers);
  }

  async execute(action: ActorAction): Promise<ActionResult> {
    if (!action.toolCalls || action.toolCalls.length === 0) {
      return { success: true, effect: {} };
    }
    const results: Record<string, unknown> = {};
    for (const call of action.toolCalls) {
      const handler = this.toolHandlers[call.tool];
      if (handler) {
        results[call.tool] = await handler(call.args);
      } else {
        results[call.tool] = { status: "mocked_success", args: call.args };
      }
    }
    return { success: true, effect: results };
  }
}
