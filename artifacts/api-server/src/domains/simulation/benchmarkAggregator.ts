import type {
  StatisticalMetrics,
  FailurePattern,
  PersonaSensitivityCohort,
  AgentBenchmarkAnalysis,
  ComprehensiveBenchmarkReport,
  JudgeCalibrationReport,
} from "@workspace/simulation-contract";
import type { MatrixExecutionResult, MatrixRunEntry } from "./matrixRunner";
import { discriminativePowerAnalyzer } from "../evaluation/discriminativePower";

export function calculateStatistics(values: number[]): StatisticalMetrics {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, p10: 0, p50: 0, p90: 0, confidenceInterval95: [0, 0] };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = Number((sum / sorted.length).toFixed(1));

  const variance =
    sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (sorted.length || 1);
  const stdDev = Number(Math.sqrt(variance).toFixed(1));

  const p10Index = Math.floor(sorted.length * 0.1);
  const p50Index = Math.floor(sorted.length * 0.5);
  const p90Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));

  const p10 = sorted[p10Index];
  const p50 = sorted[p50Index];
  const p90 = sorted[p90Index];

  const marginOfError = sorted.length > 1
    ? Number((1.96 * (stdDev / Math.sqrt(sorted.length))).toFixed(1))
    : 0;
  const ciLow = Math.max(0, Number((mean - marginOfError).toFixed(1)));
  const ciHigh = Math.min(100, Number((mean + marginOfError).toFixed(1)));

  return {
    mean,
    stdDev,
    p10,
    p50,
    p90,
    confidenceInterval95: [ciLow, ciHigh],
  };
}

export class BenchmarkAggregator {
  aggregate(
    matrixResult: MatrixExecutionResult,
    calibrationReport?: JudgeCalibrationReport
  ): ComprehensiveBenchmarkReport {
    const runsByAgent = new Map<string, MatrixRunEntry[]>();

    for (const run of matrixResult.runs) {
      const list = runsByAgent.get(run.agentId) ?? [];
      list.push(run);
      runsByAgent.set(run.agentId, list);
    }

    const agentAnalyses: AgentBenchmarkAnalysis[] = [];
    const allMetricsSet = new Set<string>();

    for (const [agentId, entries] of runsByAgent.entries()) {
      const first = entries[0];
      const overallScores = entries.map((e) => e.runResult.evaluation.overallScore);
      const overallStats = calculateStatistics(overallScores);

      // Collect scores per metric
      const scoresByMetric: Record<string, number[]> = {};
      for (const entry of entries) {
        for (const m of entry.runResult.evaluation.metrics) {
          allMetricsSet.add(m.metric);
          if (!scoresByMetric[m.metric]) scoresByMetric[m.metric] = [];
          scoresByMetric[m.metric].push(m.score);
        }
      }

      const metricStats: Record<string, StatisticalMetrics> = {};
      for (const [metric, vals] of Object.entries(scoresByMetric)) {
        metricStats[metric] = calculateStatistics(vals);
      }

      // Failure Analysis
      const failurePatterns: FailurePattern[] = [];
      const lowEmpathyRuns = entries.filter((e) => {
        const m = e.runResult.evaluation.metrics.find((x) =>
          x.metric.toLowerCase().includes("empath") || x.metric.toLowerCase().includes("emotion")
        );
        return m && m.score < 75;
      });
      if (lowEmpathyRuns.length > 0) {
        failurePatterns.push({
          patternType: "empathy_deficit",
          description: "Agent failed to actively de-escalate or acknowledge customer frustration.",
          frequency: lowEmpathyRuns.length,
          rate: Number((lowEmpathyRuns.length / entries.length).toFixed(2)),
          evidenceTraceIds: lowEmpathyRuns.map((e) => e.runResult.runId),
        });
      }

      const escalationDelayRuns = entries.filter((e) => {
        const m = e.runResult.evaluation.metrics.find((x) =>
          x.metric.toLowerCase().includes("escalat")
        );
        return m && m.score < 80;
      });
      if (escalationDelayRuns.length > 0) {
        failurePatterns.push({
          patternType: "escalation_delay",
          description: "Agent delayed required supervisor handover after repeated denials.",
          frequency: escalationDelayRuns.length,
          rate: Number((escalationDelayRuns.length / entries.length).toFixed(2)),
          evidenceTraceIds: escalationDelayRuns.map((e) => e.runResult.runId),
        });
      }

      const boundaryFailureRuns = entries.filter((e) => {
        const m = e.runResult.evaluation.metrics.find((x) =>
          x.metric.toLowerCase().includes("boundar") || x.metric.toLowerCase().includes("policy")
        );
        return m && m.score < 85;
      });
      if (boundaryFailureRuns.length > 0) {
        failurePatterns.push({
          patternType: "boundary_violation_guard",
          description: "Agent failed to guard policy or concession boundaries under customer pressure.",
          frequency: boundaryFailureRuns.length,
          rate: Number((boundaryFailureRuns.length / entries.length).toFixed(2)),
          evidenceTraceIds: boundaryFailureRuns.map((e) => e.runResult.runId),
        });
      }

      // If no specific metric patterns triggered, check for non-100% scores
      const generalFailureRuns = entries.filter((e) => e.runResult.evaluation.overallScore < 90);
      if (failurePatterns.length === 0 && generalFailureRuns.length > 0) {
        failurePatterns.push({
          patternType: "general_dialogue_divergence",
          description: "Agent exhibited sub-optimal adherence to expected goal trajectories.",
          frequency: generalFailureRuns.length,
          rate: Number((generalFailureRuns.length / entries.length).toFixed(2)),
          evidenceTraceIds: generalFailureRuns.map((e) => e.runResult.runId),
        });
      }

      // Persona Sensitivity Analysis
      const personaCohortMap = new Map<string, { scores: number[]; failures: number }>();
      for (const entry of entries) {
        const personaCohort = entry.specId.includes("frustrated")
          ? "highly_frustrated_customer"
          : entry.specId.includes("calm")
          ? "calm_customer"
          : "standard_retail_customer";

        const current = personaCohortMap.get(personaCohort) ?? { scores: [], failures: 0 };
        current.scores.push(entry.runResult.evaluation.overallScore);
        if (entry.runResult.evaluation.overallScore < 85) {
          current.failures++;
        }
        personaCohortMap.set(personaCohort, current);
      }

      const personaSensitivity: PersonaSensitivityCohort[] = [];
      for (const [cohortName, data] of personaCohortMap.entries()) {
        const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        personaSensitivity.push({
          cohortName,
          totalRuns: data.scores.length,
          averageScore: Number(avg.toFixed(1)),
          failureRate: Number((data.failures / data.scores.length).toFixed(2)),
          commonFailurePatterns: data.failures > 0 ? ["escalation_friction"] : [],
        });
      }

      // Synthesize Strengths & Weaknesses
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      for (const [metric, stat] of Object.entries(metricStats)) {
        if (stat.mean >= 90) {
          strengths.push(`High ${metric} reliability (Mean: ${stat.mean}%, P10: ${stat.p10}%)`);
        } else if (stat.mean < 80 || stat.stdDev > 8) {
          weaknesses.push(`Vulnerable in ${metric} (Mean: ${stat.mean}%, StdDev: ${stat.stdDev})`);
        }
      }

      agentAnalyses.push({
        agentId,
        agentName: first.agentName,
        provider: first.provider,
        totalRuns: entries.length,
        overallStats,
        metricStats,
        strengths: strengths.length > 0 ? strengths : ["Stable baseline compliance"],
        weaknesses: weaknesses.length > 0 ? weaknesses : ["No critical blindspots observed"],
        failurePatterns,
        personaSensitivity,
      });
    }

    // Sort descending by overall mean
    agentAnalyses.sort((a, b) => b.overallStats.mean - a.overallStats.mean);

    // Build comparative radar chart
    const comparativeRadar: Array<Record<string, string | number>> = [];
    for (const metric of Array.from(allMetricsSet)) {
      const point: Record<string, string | number> = { metric };
      for (const a of agentAnalyses) {
        point[a.agentName] = a.metricStats[metric]?.mean ?? 0;
      }
      comparativeRadar.push(point);
    }

    // Calculate Discriminative Power & Benchmark Validity Report
    const validityReport = discriminativePowerAnalyzer.analyze(agentAnalyses, calibrationReport);

    const top = agentAnalyses[0];
    return {
      benchmarkId: `bench_${Date.now()}`,
      matrixId: matrixResult.matrixId,
      generatedAt: new Date().toISOString(),
      totalSimulations: matrixResult.totalRuns,
      agents: agentAnalyses,
      comparativeRadar,
      validityReport,
      executiveSummary: top
        ? `Comparative benchmark across ${matrixResult.totalRuns} simulations. Leading agent: ${top.agentName} (Mean: ${top.overallStats.mean}%, StdDev: ${top.overallStats.stdDev}). Validity Status: ${validityReport.overallValidityStatus}.`
        : "Benchmark completed.",
    };
  }
}

export const benchmarkAggregator = new BenchmarkAggregator();
