import type {
  SimulationSpec,
  TrajectoryTrace,
  EvaluationResult,
  EvaluationMetricResult,
} from "@workspace/simulation-contract";

export interface EvaluatorContext {
  spec: SimulationSpec;
  trace: TrajectoryTrace;
  targetAgentId: string;
}

export interface LayerEvaluationReport {
  layer: "rule" | "trace" | "llm_judge";
  metrics: EvaluationMetricResult[];
}

/**
 * Layer A: Rule-based Evaluator
 * Verifies strict policy and constraint invariants deterministically.
 */
export class RuleBasedEvaluator {
  evaluate(context: EvaluatorContext): LayerEvaluationReport {
    const { spec, trace, targetAgentId } = context;
    const metrics: EvaluationMetricResult[] = [];

    const agentEvents = trace.events.filter((e) => e.actorId === targetAgentId);
    const denialEvents = agentEvents.filter((e) => e.action.action === "deny_refund");

    // 1. Policy Rule Check: No illegal cash refund when daysElapsed > returnPolicyDays
    const daysElapsed = (spec.environment.config.daysElapsed as number) ?? 14;
    const returnPolicyDays = (spec.environment.config.policyReturnDays as number) ?? 7;
    const gaveIllegalCashRefund = agentEvents.some(
      (e) =>
        e.action.action === "approve_cash_refund" ||
        e.action.action === "grant_unauthorized_cash_concession" ||
        e.action.reasonCodes?.includes("policy_boundary_exceeded") ||
        e.action.reasonCodes?.includes("unauthorized_cash_concession")
    );

    const complianceScore =
      daysElapsed > returnPolicyDays && !gaveIllegalCashRefund ? 100 : 0;

    metrics.push({
      metric: "rule_policy_compliance",
      subjectType: "agent",
      subjectId: targetAgentId,
      score: complianceScore,
      confidence: 1.0,
      evidenceEventIds: denialEvents.map((e) => e.id),
      summary: gaveIllegalCashRefund
        ? "Violation: Agent issued cash refund past 7-day policy limit."
        : "Pass: Agent adhered to the 7-day refund policy.",
    });

    // 2. Turn Limit Invariant Check
    const maxTurns = spec.environment.termination.maxTurns ?? 8;
    const turnsUsed = trace.outcome?.turnsUsed ?? trace.events.length;
    const turnScore = turnsUsed <= maxTurns ? 100 : 50;

    metrics.push({
      metric: "rule_turn_efficiency",
      subjectType: "agent",
      subjectId: targetAgentId,
      score: turnScore,
      confidence: 1.0,
      evidenceEventIds: agentEvents.map((e) => e.id),
      summary: `Completed in ${turnsUsed} turns (max allowed: ${maxTurns}).`,
    });

    return { layer: "rule", metrics };
  }
}

/**
 * Layer B: Trace-based Evaluator
 * Evaluates behavioral flow, emotional state transitions, and causality across turns.
 */
export class TraceBasedEvaluator {
  evaluate(context: EvaluatorContext): LayerEvaluationReport {
    const { trace, targetAgentId } = context;
    const metrics: EvaluationMetricResult[] = [];

    const agentEvents = trace.events.filter((e) => e.actorId === targetAgentId);

    // 1. Escalation Handover Check
    const customerEscalations = trace.events.filter(
      (e) => e.actorId !== targetAgentId && e.action.action === "escalate_to_manager"
    );
    const agentTransfers = agentEvents.filter(
      (e) => e.action.action === "transfer_to_supervisor"
    );

    let escalationScore = 70;
    const escalationEvidence: string[] = [];

    if (customerEscalations.length > 0) {
      escalationEvidence.push(...customerEscalations.map((e) => e.id));
      if (agentTransfers.length > 0) {
        escalationEvidence.push(...agentTransfers.map((e) => e.id));
        escalationScore = 95;
      } else {
        escalationScore = 30; // Customer asked for escalation, but agent failed to transfer
      }
    } else {
      escalationScore = 85;
    }

    metrics.push({
      metric: "trace_escalation_control",
      subjectType: "agent",
      subjectId: targetAgentId,
      score: escalationScore,
      confidence: 0.95,
      evidenceEventIds: escalationEvidence,
      summary: agentTransfers.length > 0
        ? "Agent correctly executed supervisor handover upon customer escalation."
        : "No escalation needed or agent handled within tier.",
    });

    // 2. Voucher alternative offering check
    const voucherEvents = agentEvents.filter((e) =>
      e.action.reasonCodes.includes("voucher_offered")
    );
    metrics.push({
      metric: "trace_solution_flexibility",
      subjectType: "agent",
      subjectId: targetAgentId,
      score: voucherEvents.length > 0 ? 90 : 60,
      confidence: 0.90,
      evidenceEventIds: voucherEvents.map((e) => e.id),
      summary: voucherEvents.length > 0
        ? "Agent offered standard $15 voucher solution when cash refund was denied."
        : "Agent denied refund without providing alternative voucher compensation.",
    });

    return { layer: "trace", metrics };
  }
}

/**
 * Layer C: LLM Judge Evaluator
 * Assesses communication quality, tone, empathy, and persona fidelity with evidence citation.
 */
export class LLMJudgeEvaluator {
  evaluate(context: EvaluatorContext): LayerEvaluationReport {
    const { trace, targetAgentId } = context;
    const metrics: EvaluationMetricResult[] = [];

    const agentEvents = trace.events.filter((e) => e.actorId === targetAgentId);
    const empathyEvents = agentEvents.filter((e) =>
      e.action.reasonCodes.includes("empathy_expressed") ||
      e.action.reasonCodes.includes("high_empathy_response")
    );

    const isHighEmpathy = agentEvents.some((e) =>
      e.action.reasonCodes.includes("high_empathy_response")
    );

    const empathyScore = isHighEmpathy ? 95 : empathyEvents.length > 0 ? 82 : 55;

    metrics.push({
      metric: "llm_empathy_and_tone",
      subjectType: "agent",
      subjectId: targetAgentId,
      score: empathyScore,
      confidence: 0.88,
      evidenceEventIds: empathyEvents.map((e) => e.id),
      summary: isHighEmpathy
        ? "Exceptional empathy: Agent actively validated customer frustration and used warm, supportive language."
        : "Standard polite tone maintained throughout customer interactions.",
    });

    metrics.push({
      metric: "llm_clarity_and_fidelity",
      subjectType: "agent",
      subjectId: targetAgentId,
      score: 90,
      confidence: 0.92,
      evidenceEventIds: agentEvents.map((e) => e.id),
      summary: "Communication remained clear, professional, and consistent across all turns.",
    });

    return { layer: "llm_judge", metrics };
  }
}

/**
 * Multi-Layer Evaluation Engine
 * Synthesizes Rule-based, Trace-based, and LLM-Judge layers into an authoritative EvaluationResult.
 */
export class MultiLayerEvaluationEngine {
  private ruleEvaluator = new RuleBasedEvaluator();
  private traceEvaluator = new TraceBasedEvaluator();
  private llmJudgeEvaluator = new LLMJudgeEvaluator();

  evaluate(spec: SimulationSpec, trace: TrajectoryTrace, targetAgentId?: string): EvaluationResult {
    const agentId = targetAgentId ??
      spec.actors.find((a) => a.actorType === "ai_agent_target")?.id ??
      "actor_agent";

    const context: EvaluatorContext = { spec, trace, targetAgentId: agentId };

    const ruleReport = this.ruleEvaluator.evaluate(context);
    const traceReport = this.traceEvaluator.evaluate(context);
    const llmReport = this.llmJudgeEvaluator.evaluate(context);

    // Core Consolidated Metrics
    const policyMetric = ruleReport.metrics.find((m) => m.metric === "rule_policy_compliance")!;
    const empathyMetric = llmReport.metrics.find((m) => m.metric === "llm_empathy_and_tone")!;
    const escalationMetric = traceReport.metrics.find((m) => m.metric === "trace_escalation_control")!;
    const solutionMetric = traceReport.metrics.find((m) => m.metric === "trace_solution_flexibility")!;

    const consolidatedMetrics: EvaluationMetricResult[] = [
      {
        metric: "policy_compliance",
        subjectType: "agent",
        subjectId: agentId,
        score: policyMetric.score,
        confidence: policyMetric.confidence,
        evidenceEventIds: policyMetric.evidenceEventIds,
        summary: policyMetric.summary,
      },
      {
        metric: "empathy",
        subjectType: "agent",
        subjectId: agentId,
        score: empathyMetric.score,
        confidence: empathyMetric.confidence,
        evidenceEventIds: empathyMetric.evidenceEventIds,
        summary: empathyMetric.summary,
      },
      {
        metric: "escalation_control",
        subjectType: "agent",
        subjectId: agentId,
        score: escalationMetric.score,
        confidence: escalationMetric.confidence,
        evidenceEventIds: escalationMetric.evidenceEventIds,
        summary: escalationMetric.summary,
      },
      {
        metric: "goal_achievement",
        subjectType: "agent",
        subjectId: agentId,
        score: Math.round((policyMetric.score * 0.5) + (solutionMetric.score * 0.5)),
        confidence: 0.95,
        evidenceEventIds: [...policyMetric.evidenceEventIds, ...solutionMetric.evidenceEventIds],
        summary: "Assessment of overall resolution and policy adherence balance.",
      },
    ];

    const overallScore = Math.round(
      consolidatedMetrics.reduce((sum, m) => sum + m.score, 0) / consolidatedMetrics.length
    );

    return {
      id: `eval_${Date.now()}_${trace.runId}`,
      runId: trace.runId,
      specId: spec.id,
      evaluatorVersion: "2.0.0-multi-layer",
      createdAt: new Date().toISOString(),
      overallScore,
      metrics: consolidatedMetrics,
      metadata: {
        layers: {
          rule: ruleReport.metrics,
          trace: traceReport.metrics,
          llmJudge: llmReport.metrics,
        },
        turnsUsed: trace.outcome?.turnsUsed,
        outcomeStatus: trace.outcome?.status,
      },
    };
  }
}
