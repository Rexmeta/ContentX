import type {
  DeploymentGateResult,
  RegressionReport,
  ComprehensiveBenchmarkReport,
  EvaluationTier,
} from "@workspace/simulation-contract";
import { regressionEngine } from "./regressionEngine";

export interface EvaluateDeploymentInput {
  agentId: string;
  baselineVersionId: string;
  candidateVersionId: string;
  evaluationContextHash: string;
  tier?: EvaluationTier;
  baselineReport: ComprehensiveBenchmarkReport;
  candidateReport: ComprehensiveBenchmarkReport;
  minPracticalDifference?: number; // e.g. 3.0 (%)
}

export class DeploymentGateService {
  /**
   * Applies Multi-Factor Deployment Gate Intelligence (Overall + Cohort + Failure Patterns + Statistical Significance)
   */
  evaluateDeployment(input: EvaluateDeploymentInput): DeploymentGateResult {
    const report: RegressionReport = regressionEngine.analyze({
      agentId: input.agentId,
      baselineVersionId: input.baselineVersionId,
      candidateVersionId: input.candidateVersionId,
      evaluationContextHash: input.evaluationContextHash,
      tier: input.tier ?? "tier1_regression",
      baselineReport: input.baselineReport,
      candidateReport: input.candidateReport,
    });

    const blockReasons: string[] = [];
    const warningReasons: string[] = [];

    // 1. Critical Cohort Regressions (Simpson's Paradox Defense)
    const criticalCohorts = report.cohortRegressions.filter((c) => c.status === "fail" || c.criticalFailure);
    if (criticalCohorts.length > 0) {
      blockReasons.push(
        `CRITICAL_COHORT_REGRESSION: Degraded in vulnerable cohorts [${criticalCohorts.map((c) => `${c.cohortName}: ${c.delta}%`).join(", ")}]`
      );
    }

    // 2. Failure Pattern Surges (P7-5 discovered failures)
    const criticalFailures = report.failurePatternRegressions.filter((f) => f.status === "fail");
    if (criticalFailures.length > 0) {
      blockReasons.push(
        `FAILURE_PATTERN_SURGE: Increased occurrence in critical failure patterns [${criticalFailures.map((f) => `${f.patternType}: +${(f.rateDelta * 100).toFixed(1)}%`).join(", ")}]`
      );
    }

    // 3. Metric-Level Critical Failures
    const failedMetrics = report.metricRegressions.filter((m) => m.status === "fail");
    if (failedMetrics.length > 0) {
      blockReasons.push(
        `METRIC_REGRESSION: Significant degradation in core dimensions [${failedMetrics.map((m) => `${m.metric}: ${m.delta}%`).join(", ")}]`
      );
    }

    // 4. Overall Delta Significance
    if (report.overall.delta <= -4.0) {
      blockReasons.push(`OVERALL_QUALITY_DROP: Aggregate benchmark score dropped by ${report.overall.delta}%`);
    } else if (report.overall.delta < 0) {
      warningReasons.push(`MINOR_SCORE_DECREASE: Overall benchmark score decreased slightly by ${report.overall.delta}%`);
    }

    // Determine Decision
    let decision: "APPROVED" | "BLOCKED" | "WARNING" = "APPROVED";
    let summaryReason = "";

    if (blockReasons.length > 0) {
      decision = "BLOCKED";
      summaryReason = `BLOCK DEPLOYMENT: ${blockReasons.join(" | ")}`;
    } else if (warningReasons.length > 0 || report.cohortRegressions.some((c) => c.status === "warn")) {
      decision = "WARNING";
      summaryReason = `WARNING: Minor performance variations detected. Proceed with targeted canary rollout.`;
    } else {
      decision = "APPROVED";
      summaryReason = `APPROVE DEPLOYMENT: Candidate ${input.candidateVersionId} is statistically non-regressive and meets quality standards across all cohorts (+${report.overall.delta}%).`;
    }

    return {
      decision,
      jobId: `job_${Date.now()}`,
      reportId: report.id,
      agentId: input.agentId,
      candidateVersionId: input.candidateVersionId,
      reason: summaryReason,
      regressionReport: report,
    };
  }
}

export const deploymentGateService = new DeploymentGateService();
