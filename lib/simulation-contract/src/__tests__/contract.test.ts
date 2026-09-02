import { describe, it, expect } from "vitest";
import {
  validateSimulationSpec,
  validateTrajectoryEvent,
  validateEvaluationResult,
  validateReplayEnvelope,
  isDecisionActor,
  type SimulationSpec,
  type Actor,
  type DecisionActor,
  type TrajectoryEvent,
  type EvaluationResult,
  type SimulationReplayEnvelope,
} from "../index";

describe("SimulationContract (P0-1)", () => {
  const validSpec: SimulationSpec = {
    schemaVersion: "1.0.0",
    id: "spec_cs_001",
    name: "Customer Service Escalation Test",
    domain: "customer_service",
    version: 1,
    metadata: {
      author: "tester",
      createdAt: "2026-09-01T12:00:00Z",
      description: "Angry customer demanding refund beyond return window",
      tags: ["cs", "escalation", "refund"],
    },
    world: {
      id: "world_cs_retail",
      name: "Retail E-Commerce Support",
      description: "Online fashion store returns policy",
      rules: ["7-day return window", "Manager authorization required for exceptions"],
      context: { returnWindowDays: 7, maxAgentVoucher: 10 },
    },
    environment: {
      type: "customer_service",
      config: { channel: "chat", queuePriority: "high" },
      termination: {
        maxTurns: 8,
        successCondition: "issue_resolved_or_escalated",
      },
    },
    actors: [
      {
        id: "actor_customer",
        name: "Angry Customer (Kim)",
        role: "customer",
        actorType: "persona_actor",
        behaviorProfile: {
          traits: { price_sensitivity: "high", assertiveness: "high" },
          initialState: {
            affective: { frustration: 0.85, satisfaction: 0.1 },
            relational: { trust: 0.2 },
          },
        },
      },
      {
        id: "actor_agent",
        name: "AI Customer Support Bot",
        role: "support_agent",
        actorType: "ai_agent_target",
        agentConfig: {
          provider: "openai",
          config: {
            model: "gpt-4o",
            temperature: 0.2,
            systemPrompt: "You are a professional CS agent upholding store policy.",
          },
        },
      },
    ],
    relationships: [
      {
        sourceActorId: "actor_customer",
        targetActorId: "actor_agent",
        type: "client_to_representative",
        intensity: -0.5,
      },
    ],
    goals: [
      {
        actorId: "actor_customer",
        description: "Obtain full refund for item purchased 14 days ago",
        priority: 10,
        successCriteria: "refund_approved_or_escalated",
      },
      {
        actorId: "actor_agent",
        description: "Adhere to 7-day policy while de-escalating customer frustration",
        priority: 8,
        successCriteria: "policy_complied_and_customer_calmed",
      },
    ],
    constraints: [
      {
        actorId: "actor_agent",
        type: "hard",
        rule: "Cannot directly issue refund past 7 days without escalation",
      },
    ],
    behaviorPolicies: [
      {
        id: "policy_escalate_on_denial",
        actorId: "actor_customer",
        trigger: { condition: "frustration >= 0.7 AND denial_count >= 2" },
        response: {
          action: "escalate_to_manager",
          reasonCode: "refund_denied_twice",
          stateDeltas: { affective: { frustration: 0.1 } },
        },
      },
    ],
    evaluationRubric: {
      metrics: [
        {
          name: "policy_compliance",
          subjectType: "agent",
          subjectId: "actor_agent",
          weight: 0.4,
          criteriaPrompt: "Did the agent adhere to the 7-day refund policy without unauthorized bypass?",
        },
        {
          name: "empathy",
          subjectType: "agent",
          subjectId: "actor_agent",
          weight: 0.3,
          criteriaPrompt: "Did the agent acknowledge customer frustration with empathetic tone?",
        },
        {
          name: "escalation_control",
          subjectType: "agent",
          subjectId: "actor_agent",
          weight: 0.3,
          criteriaPrompt: "Did the agent properly handle escalation when policy limits were reached?",
        },
      ],
    },
  };

  it("validates a valid SimulationSpec successfully", () => {
    const report = validateSimulationSpec(validSpec);
    expect(report.success).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(report.data?.id).toBe("spec_cs_001");
  });

  it("detects broken actor reference in relationships and goals", () => {
    const invalidSpec = {
      ...validSpec,
      relationships: [
        {
          sourceActorId: "non_existent_actor",
          targetActorId: "actor_agent",
          type: "unknown",
          intensity: 0,
        },
      ],
      goals: [
        {
          actorId: "ghost_actor",
          description: "Goal for non-existent actor",
          priority: 5,
          successCriteria: "never",
        },
      ],
    };

    const report = validateSimulationSpec(invalidSpec);
    expect(report.success).toBe(false);
    expect(report.issues.some((i) => i.path.includes("relationships"))).toBe(true);
    expect(report.issues.some((i) => i.path.includes("goals"))).toBe(true);
  });

  it("validates TrajectoryEvent with source, correlationId and reasonCodes", () => {
    const event: TrajectoryEvent = {
      id: "event_001",
      simulationId: "sim_001",
      runId: "run_001",
      turn: 1,
      actorId: "actor_customer",
      actorType: "persona_actor",
      correlationId: "corr_turn_1",
      source: {
        type: "rule",
        version: "1.0.0",
      },
      stateBefore: {
        affective: { frustration: 0.85 },
        relational: { trust: 0.2 },
        cognitive: {},
      },
      action: {
        action: "request_refund",
        intent: "get_money_back",
        utterance: "I demand a full refund for this defective item!",
        reasonCodes: ["initial_complaint"],
      },
      stateAfter: {
        affective: { frustration: 0.85 },
        relational: { trust: 0.2 },
        cognitive: {},
      },
      timestamp: "2026-09-01T12:00:01Z",
    };

    const report = validateTrajectoryEvent(event);
    expect(report.success).toBe(true);
    expect(report.data?.correlationId).toBe("corr_turn_1");
  });

  it("validates EvaluationResult citing evidenceEventIds", () => {
    const evalResult: EvaluationResult = {
      id: "eval_001",
      runId: "run_001",
      specId: "spec_cs_001",
      evaluatorVersion: "1.0.0",
      createdAt: "2026-09-01T12:05:00Z",
      overallScore: 88,
      metrics: [
        {
          metric: "policy_compliance",
          subjectType: "agent",
          subjectId: "actor_agent",
          score: 95,
          confidence: 0.98,
          evidenceEventIds: ["event_002", "event_004"],
          summary: "Agent consistently cited 7-day policy and offered valid store voucher alternative.",
        },
        {
          metric: "empathy",
          subjectType: "agent",
          subjectId: "actor_agent",
          score: 80,
          confidence: 0.90,
          evidenceEventIds: ["event_002"],
          summary: "Agent recognized frustration early on.",
        },
      ],
      metadata: { totalTurns: 6 },
    };

    const report = validateEvaluationResult(evalResult);
    expect(report.success).toBe(true);
    expect(report.data?.metrics[0].evidenceEventIds).toContain("event_002");
  });

  it("validates ReplayEnvelope for dual-mode replay", () => {
    const recordedEnvelope: SimulationReplayEnvelope = {
      simulationId: "sim_001",
      runId: "run_001",
      specVersion: "1.0.0",
      actorVersions: { actor_customer: "1.0", actor_agent: "1.0" },
      modelVersions: { actor_agent: "gpt-4o-2024-08-06" },
      promptTemplateVersions: { actor_agent: "cs_v1" },
      toolVersions: {},
      runtimeVersion: "1.0.0",
      seed: 42,
      environmentType: "customer_service",
      mode: "recorded",
    };

    const report = validateReplayEnvelope(recordedEnvelope);
    expect(report.success).toBe(true);
    expect(report.data?.mode).toBe("recorded");
  });

  it("distinguishes DecisionActor from Base Actor via isDecisionActor type guard", () => {
    const toolActor: Actor = {
      id: "actor_tool_db",
      type: "tool_actor",
      capabilities: () => ["query_order", "process_refund"],
      observe: async (ctx) => ctx,
      execute: async () => ({ success: true, effect: {} }),
    };

    const personaActor: DecisionActor = {
      id: "actor_persona_kim",
      type: "persona_actor",
      capabilities: () => ["speak", "escalate"],
      observe: async (ctx) => ctx,
      decide: async () => ({ action: "speak", reasonCodes: ["angry"] }),
      execute: async () => ({ success: true, effect: {} }),
    };

    expect(isDecisionActor(toolActor)).toBe(false);
    expect(isDecisionActor(personaActor)).toBe(true);
  });
});
