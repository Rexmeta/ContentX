import type {
  EvaluationJob,
  RegressionReport,
  DeploymentGateResult,
  EvaluationTier,
  SimulationSpec,
  SimulationActorSpec,
} from "@workspace/simulation-contract";
import { agentVersionRegistry } from "./agentVersionRegistry";
import { evaluationContextManager } from "./evaluationContextManager";
import { regressionEngine } from "./regressionEngine";
import { simulationMatrixRunner } from "../../simulation/matrixRunner";
import { benchmarkAggregator } from "../../simulation/benchmarkAggregator";
import { samplingEngine } from "../../population";

export interface CreateJobInput {
  agentId: string;
  candidateVersionId: string;
  baselineVersionId: string;
  spec: SimulationSpec;
  tier?: EvaluationTier;
  trigger?: "manual" | "schedule" | "deployment" | "webhook" | "api";
}

export class EvaluationJobService {
  private jobs: Map<string, EvaluationJob> = new Map();
  private reports: Map<string, RegressionReport> = new Map();

  async runJob(input: CreateJobInput): Promise<DeploymentGateResult> {
    const jobId = `job_${Date.now()}`;
    const tier = input.tier ?? "tier1_regression";

    const candidateVersion = agentVersionRegistry.getVersion(input.candidateVersionId);
    const baselineVersion = agentVersionRegistry.getVersion(input.baselineVersionId);

    // Determine sample size based on tier
    const sampleSize = tier === "tier0_smoke" ? 2 : tier === "tier1_regression" ? 4 : 8;

    // Create population sample
    const populationSample = samplingEngine.sample({
      strategy: "stratified",
      sampleSize,
      baseSeed: 555,
    }).personas;

    // Build evaluation context snapshot
    const contextSnapshot = evaluationContextManager.createSnapshot({
      spec: input.spec,
      populationSample,
    });

    const job: EvaluationJob = {
      id: jobId,
      agentId: input.agentId,
      candidateVersionId: input.candidateVersionId,
      baselineVersionId: input.baselineVersionId,
      tier,
      trigger: input.trigger ?? "manual",
      status: "running",
      evaluationContextHash: contextSnapshot.contextHash,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);

    // Build specs for population
    const testSpecs: SimulationSpec[] = populationSample.map((persona, idx) => ({
      ...input.spec,
      id: `${input.spec.id}_run_${idx + 1}`,
      actors: [
        persona,
        input.spec.actors.find((a) => a.actorType === "ai_agent_target")!,
      ],
    }));

    // Target actors for baseline and candidate
    const baseActor: SimulationActorSpec = {
      id: baselineVersion?.id ?? "agent_v1",
      name: `Agent Baseline (${baselineVersion?.version ?? "v1.0.0"})`,
      role: "support_agent",
      actorType: "ai_agent_target",
      agentConfig: { provider: "mock", config: { profile: "strict" } },
    };

    const candActor: SimulationActorSpec = {
      id: candidateVersion?.id ?? "agent_v2",
      name: `Agent Candidate (${candidateVersion?.version ?? "v2.0.0"})`,
      role: "support_agent",
      actorType: "ai_agent_target",
      agentConfig: { provider: "mock", config: { profile: candidateVersion?.metadata?.releaseId?.includes("flawed") ? "flawed" : "claude-profile" } },
    };

    // Run Matrix Simulations
    const baseMatrix = await simulationMatrixRunner.runMatrix({
      specs: testSpecs,
      targetAgents: [baseActor],
      repetitions: 1,
      baseSeed: 100,
    });
    const baselineBenchmark = benchmarkAggregator.aggregate(baseMatrix);

    const candMatrix = await simulationMatrixRunner.runMatrix({
      specs: testSpecs,
      targetAgents: [candActor],
      repetitions: 1,
      baseSeed: 100,
    });
    const candidateBenchmark = benchmarkAggregator.aggregate(candMatrix);

    // Run Regression Analysis
    const regressionReport = regressionEngine.analyze({
      agentId: input.agentId,
      baselineVersionId: input.baselineVersionId,
      candidateVersionId: input.candidateVersionId,
      evaluationContextHash: contextSnapshot.contextHash,
      tier,
      isComparable: true,
      baselineReport: baselineBenchmark,
      candidateReport: candidateBenchmark,
    });

    this.reports.set(regressionReport.id, regressionReport);

    job.status = "completed";
    job.reportId = regressionReport.id;
    job.completedAt = new Date().toISOString();
    this.jobs.set(job.id, job);

    const decision: "APPROVED" | "BLOCKED" | "WARNING" =
      regressionReport.status === "fail"
        ? "BLOCKED"
        : regressionReport.status === "warn"
        ? "WARNING"
        : "APPROVED";

    return {
      decision,
      jobId,
      reportId: regressionReport.id,
      agentId: input.agentId,
      candidateVersionId: input.candidateVersionId,
      reason: regressionReport.recommendation,
      regressionReport,
    };
  }

  getJob(id: string): EvaluationJob | undefined {
    return this.jobs.get(id);
  }

  getReport(id: string): RegressionReport | undefined {
    return this.reports.get(id);
  }

  listJobs(agentId?: string): EvaluationJob[] {
    const all = Array.from(this.jobs.values());
    if (agentId) return all.filter((j) => j.agentId === agentId);
    return all;
  }
}

export const evaluationJobService = new EvaluationJobService();
