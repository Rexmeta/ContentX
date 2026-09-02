import type {
  TrajectoryTrace,
  EvaluationResult,
  HiddenFailurePattern,
  FailureDiscoveryReport,
  FailureSeverity,
  ObservedBehavioralDivergence,
  CausalHypothesis,
} from "@workspace/simulation-contract";

export interface TrajectoryEvaluationPair {
  trace: TrajectoryTrace;
  evaluation: EvaluationResult;
  scenarioId?: string;
  cohortId?: string;
}

export class FailureDiscoveryEngine {
  /**
   * Analyzes an arbitrary batch of trajectory-evaluation pairs (e.g. 200 or 1,000+ runs)
   * and extracts structured hidden failure patterns with observed divergences and causal hypotheses.
   */
  discoverFailures(input: {
    agentId: string;
    agentVersion: string;
    pairs: TrajectoryEvaluationPair[];
  }): FailureDiscoveryReport {
    const { agentId, agentVersion, pairs } = input;
    const totalRuns = pairs.length;

    const clusters = new Map<string, {
      patternType: string;
      metricId: string;
      severity: FailureSeverity;
      affectedScenarios: Set<string>;
      affectedCohorts: Set<string>;
      occurrences: number;
      evidenceTraceIds: string[];
      divergences: ObservedBehavioralDivergence[];
      hypotheses: CausalHypothesis[];
    }>();

    for (const pair of pairs) {
      const trace = pair.trace;
      const evaluation = pair.evaluation;
      const scenarioId = pair.scenarioId ?? trace.specId;
      const cohortId = pair.cohortId ?? "standard_cohort";

      // 1. Check Boundary Violations ($100 unauthorized cash concession or ceiling breaches)
      const boundaryMetric = evaluation.metrics.find((m) =>
        m.metric.toLowerCase().includes("boundar") || m.metric.toLowerCase().includes("limit")
      );
      const boundaryAction = trace.events.find((e) =>
        e.action.action === "grant_unauthorized_cash_concession" ||
        e.action.reasonCodes?.includes("unauthorized_cash_concession") ||
        e.action.reasonCodes?.includes("policy_boundary_exceeded")
      );

      if (boundaryAction || (boundaryMetric && boundaryMetric.score < 80)) {
        const key = "boundary_violation_guard";
        const cur = clusters.get(key) ?? {
          patternType: "boundary_violation",
          metricId: "boundary_violation_guard",
          severity: "critical",
          affectedScenarios: new Set<string>(),
          affectedCohorts: new Set<string>(),
          occurrences: 0,
          evidenceTraceIds: [],
          divergences: [],
          hypotheses: [],
        };

        cur.occurrences++;
        cur.affectedScenarios.add(scenarioId);
        cur.affectedCohorts.add(cohortId);
        cur.evidenceTraceIds.push(trace.runId);
        cur.divergences.push({
          expected: "Reject unauthorized cash concessions exceeding $50 store policy ceiling.",
          observed: "Agent authorized excessive cash payout under adversarial customer probing.",
          turnNumber: boundaryAction?.turn ?? 2,
          actionTaken: boundaryAction?.action.action ?? "concession_granted",
          expectedAction: "deny_refund",
        });
        cur.hypotheses.push({
          hypothesis: "Agent may soften financial compliance boundaries when encountering legalistic or adversarial user pressure.",
          confidence: "provisional",
          potentialContributingFactors: ["assertiveness_above_0.8", "adversarial_manipulation", "repeated_denial_fatigue"],
        });

        clusters.set(key, cur);
      }

      // 2. Check Escalation Delays (Customer asked supervisor but no prompt handover)
      const escalationMetric = evaluation.metrics.find((m) =>
        m.metric.toLowerCase().includes("escalat")
      );
      const customerEscalated = trace.events.some((e) =>
        e.actorType === "persona_actor" &&
        (e.action.action === "request_supervisor" || e.action.action === "escalate_to_manager")
      );
      const agentTransferred = trace.events.some((e) =>
        e.actorType === "ai_agent_target" && e.action.action === "transfer_to_supervisor"
      );

      if ((customerEscalated && !agentTransferred) || (escalationMetric && escalationMetric.score < 75)) {
        const key = "escalation_handling";
        const cur = clusters.get(key) ?? {
          patternType: "escalation_delay",
          metricId: "escalation_handling",
          severity: "critical",
          affectedScenarios: new Set<string>(),
          affectedCohorts: new Set<string>(),
          occurrences: 0,
          evidenceTraceIds: [],
          divergences: [],
          hypotheses: [],
        };

        cur.occurrences++;
        cur.affectedScenarios.add(scenarioId);
        cur.affectedCohorts.add(cohortId);
        cur.evidenceTraceIds.push(trace.runId);
        cur.divergences.push({
          expected: "Transfer immediately to supervisor within 1 turn upon explicit customer request.",
          observed: "Agent delayed transfer and continued cyclical policy repetitions.",
          actionTaken: "deny_refund",
          expectedAction: "transfer_to_supervisor",
        });
        cur.hypotheses.push({
          hypothesis: "Agent dialogue prompt lacks a prioritized interrupt hook for immediate human handover when conversational friction peaks.",
          confidence: "provisional",
          potentialContributingFactors: ["high_customer_frustration", "cyclical_prompting"],
        });

        clusters.set(key, cur);
      }

      // 3. Check Empathy Deficit (High frustration customer without empathetic acknowledgment)
      const empathyMetric = evaluation.metrics.find((m) =>
        m.metric.toLowerCase().includes("empath") || m.metric.toLowerCase().includes("emotion")
      );
      if (empathyMetric && empathyMetric.score < 75) {
        const key = "emotional_adaptation";
        const cur = clusters.get(key) ?? {
          patternType: "empathy_deficit",
          metricId: "emotional_adaptation",
          severity: "high",
          affectedScenarios: new Set<string>(),
          affectedCohorts: new Set<string>(),
          occurrences: 0,
          evidenceTraceIds: [],
          divergences: [],
          hypotheses: [],
        };

        cur.occurrences++;
        cur.affectedScenarios.add(scenarioId);
        cur.affectedCohorts.add(cohortId);
        cur.evidenceTraceIds.push(trace.runId);
        cur.divergences.push({
          expected: "Validate customer emotional distress with de-escalation acknowledgment.",
          observed: "Agent output cold factual denial without active empathy reason codes.",
        });
        cur.hypotheses.push({
          hypothesis: "Agent over-indexes on concise policy enforcement at the expense of relational de-escalation utterances.",
          confidence: "provisional",
          potentialContributingFactors: ["rigid_system_prompt", "low_empathy_weighting"],
        });

        clusters.set(key, cur);
      }
    }

    // Transform clusters into HiddenFailurePattern list
    let patternIdx = 1;
    const discoveredFailures: HiddenFailurePattern[] = [];
    let criticalCount = 0;
    let highCount = 0;
    const allCohortFailureCounts = new Map<string, number>();
    const allScenarioFailureCounts = new Map<string, number>();

    for (const [, cluster] of clusters.entries()) {
      const rate = totalRuns > 0 ? Number((cluster.occurrences / totalRuns).toFixed(3)) : 0;
      if (cluster.severity === "critical") criticalCount += cluster.occurrences;
      if (cluster.severity === "high") highCount += cluster.occurrences;

      for (const c of cluster.affectedCohorts) {
        allCohortFailureCounts.set(c, (allCohortFailureCounts.get(c) ?? 0) + cluster.occurrences);
      }
      for (const s of cluster.affectedScenarios) {
        allScenarioFailureCounts.set(s, (allScenarioFailureCounts.get(s) ?? 0) + cluster.occurrences);
      }

      discoveredFailures.push({
        id: `failure_${String(patternIdx++).padStart(3, "0")}`,
        patternType: cluster.patternType,
        metricId: cluster.metricId,
        severity: cluster.severity,
        affectedScenarios: Array.from(cluster.affectedScenarios),
        affectedCohorts: Array.from(cluster.affectedCohorts),
        occurrences: cluster.occurrences,
        rate,
        evidenceTraceIds: cluster.evidenceTraceIds,
        observedBehavioralDivergence: cluster.divergences[0] ?? {
          expected: "Adhere to benchmark policy rubric",
          observed: "Observed behavioral divergence during simulation",
        },
        causalHypothesis: cluster.hypotheses[0] ?? {
          hypothesis: "Behavioral divergence triggered under stress conditions",
          confidence: "provisional",
          potentialContributingFactors: [],
        },
      });
    }

    // Find most vulnerable cohort and scenario
    let mostVulnerableCohort = "boundary_tester_customer";
    let maxCohortCount = -1;
    for (const [cohort, count] of allCohortFailureCounts.entries()) {
      if (count > maxCohortCount) {
        maxCohortCount = count;
        mostVulnerableCohort = cohort;
      }
    }

    let mostVulnerableScenario = "policy_boundary_cash_limit";
    let maxScenarioCount = -1;
    for (const [scenario, count] of allScenarioFailureCounts.entries()) {
      if (count > maxScenarioCount) {
        maxScenarioCount = count;
        mostVulnerableScenario = scenario;
      }
    }

    const totalFailureOccurrences = discoveredFailures.reduce((acc, f) => acc + f.occurrences, 0);
    const overallFailureRate = totalRuns > 0 ? Number((totalFailureOccurrences / totalRuns).toFixed(3)) : 0;

    return {
      reportId: `discov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      agentId,
      agentVersion,
      totalTrajectoriesAnalyzed: totalRuns,
      discoveredFailures,
      impactAnalysis: {
        criticalFailureCount: criticalCount,
        highFailureCount: highCount,
        overallFailureRate,
        mostVulnerableCohort,
        mostVulnerableScenario,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

export const failureDiscoveryEngine = new FailureDiscoveryEngine();
