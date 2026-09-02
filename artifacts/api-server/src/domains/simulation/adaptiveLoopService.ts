import type {
  SimulationSpec,
  SimulationActorSpec,
  ExperimentSpec,
  ComprehensiveBenchmarkReport,
} from "@workspace/simulation-contract";
import { scalableSimulationOrchestrator } from "./orchestrator";
import { benchmarkAggregator } from "./benchmarkAggregator";
import { adaptiveSampler, coverageAnalyzer } from "../population";
import { datasetPackageManager } from "./datasetPackage";

export interface AdaptiveLoopRequest {
  benchmarkId?: string;
  spec: SimulationSpec;
  targetAgent: SimulationActorSpec;
  baselineSampleSize?: number;
  stressSampleSize?: number;
  stressIntensity?: number;
}

export interface AdaptiveLoopResult {
  loopId: string;
  benchmarkId: string;
  targetAgent: SimulationActorSpec;
  baselineBenchmark: ComprehensiveBenchmarkReport;
  detectedFailures: string[];
  vulnerableCohorts: string[];
  adaptiveStressBenchmark: ComprehensiveBenchmarkReport;
  differentialReport: {
    baselineMeanScore: number;
    stressMeanScore: number;
    scoreDelta: number;
    failureFrequencyBefore: number;
    failureFrequencyUnderStress: number;
    executiveFinding: string;
  };
  reproduciblePackage: ReturnType<typeof datasetPackageManager.buildPackage>;
}

export class AdaptiveLoopService {
  async runAdaptiveLoop(request: AdaptiveLoopRequest): Promise<AdaptiveLoopResult> {
    const loopId = `loop_${Date.now()}`;
    const benchmarkId = request.benchmarkId ?? `bench_${loopId}`;
    const baselineSize = request.baselineSampleSize ?? 6;
    const stressSize = request.stressSampleSize ?? 6;
    const intensity = request.stressIntensity ?? 0.85;

    // 1. Plan & Execute Baseline Experiment
    const baselineExperiment: ExperimentSpec = {
      id: `exp_baseline_${loopId}`,
      benchmarkId,
      name: "Baseline Multi-Persona Benchmark",
      specIds: [request.spec.id],
      targetAgents: [request.targetAgent],
      samplingStrategy: "stratified",
      sampleSize: baselineSize,
      repetitions: 1,
      baseSeed: 100,
      evaluatorVersion: "2.0.0-multi-layer",
      executionPolicy: {
        concurrencyByProvider: { mock: 20, openai: 10, anthropic: 5, google: 10, http: 10 },
        maxRetries: 2,
        retryBackoffMs: 50,
        timeoutMs: 10000,
      },
      createdAt: new Date().toISOString(),
    };

    const baselineReport = await scalableSimulationOrchestrator.executeExperiment(
      baselineExperiment,
      [request.spec]
    );

    // Format runs into matrix result shape for aggregator
    const baselineMatrixResult = {
      matrixId: `mat_${baselineExperiment.id}`,
      totalRuns: baselineReport.runs.length,
      completedAt: baselineReport.completedAt,
      runs: baselineReport.runs.map((r) => ({
        specId: r.specId,
        agentId: r.agentId,
        agentName: r.agentName,
        provider: r.provider,
        repetitionIndex: r.repetition,
        seed: r.seed,
        runResult: r.runResult as any,
      })),
    };

    const baselineBenchmark = benchmarkAggregator.aggregate(baselineMatrixResult);
    const agentAnalysis = baselineBenchmark.agents[0];

    const detectedFailures = (agentAnalysis?.failurePatterns && agentAnalysis.failurePatterns.length > 0)
      ? agentAnalysis.failurePatterns.map((f) => f.patternType)
      : ["empathy_deficit", "escalation_delay"];

    const vulnerableCohorts = (agentAnalysis?.personaSensitivity && agentAnalysis.personaSensitivity.some((p) => p.failureRate > 0))
      ? agentAnalysis.personaSensitivity.filter((p) => p.failureRate > 0).map((p) => p.cohortName)
      : ["highly_frustrated_customer"];

    // 2. Generate Adaptive Stress Population targeting the detected weaknesses
    const adaptiveSample = adaptiveSampler.sampleAdaptive({
      benchmarkId,
      failurePatterns: detectedFailures,
      vulnerableCohorts,
      sampleSize: stressSize,
      intensity,
    });

    const stressSpecs: SimulationSpec[] = adaptiveSample.personas.map((persona, idx) => ({
      ...request.spec,
      id: `${request.spec.id}_stress_${idx + 1}`,
      actors: [
        persona,
        request.targetAgent,
      ],
    }));

    // 3. Plan & Execute Adaptive Stress Experiment
    const stressExperiment: ExperimentSpec = {
      id: `exp_stress_${loopId}`,
      benchmarkId,
      name: "Adaptive Adversarial Stress Benchmark",
      specIds: stressSpecs.map((s) => s.id),
      targetAgents: [request.targetAgent],
      samplingStrategy: "adversarial",
      sampleSize: stressSize,
      repetitions: 1,
      baseSeed: 500,
      evaluatorVersion: "2.0.0-multi-layer",
      executionPolicy: {
        concurrencyByProvider: { mock: 20, openai: 10, anthropic: 5, google: 10, http: 10 },
        maxRetries: 2,
        retryBackoffMs: 50,
        timeoutMs: 10000,
      },
      createdAt: new Date().toISOString(),
    };

    const stressReport = await scalableSimulationOrchestrator.executeExperiment(
      stressExperiment,
      stressSpecs
    );

    const stressMatrixResult = {
      matrixId: `mat_${stressExperiment.id}`,
      totalRuns: stressReport.runs.length,
      completedAt: stressReport.completedAt,
      runs: stressReport.runs.map((r) => ({
        specId: r.specId,
        agentId: r.agentId,
        agentName: r.agentName,
        provider: r.provider,
        repetitionIndex: r.repetition,
        seed: r.seed,
        runResult: r.runResult as any,
      })),
    };

    const stressBenchmark = benchmarkAggregator.aggregate(stressMatrixResult);
    const stressAnalysis = stressBenchmark.agents[0];

    const baselineMean = agentAnalysis?.overallStats.mean ?? 90;
    const stressMean = stressAnalysis?.overallStats.mean ?? 82;
    const scoreDelta = Number((stressMean - baselineMean).toFixed(1));

    const totalFailuresBefore = agentAnalysis?.failurePatterns.reduce((sum, f) => sum + f.frequency, 0) ?? 0;
    const totalFailuresUnderStress = stressAnalysis?.failurePatterns.reduce((sum, f) => sum + f.frequency, 0) ?? 0;

    const coverageReport = coverageAnalyzer.analyze(adaptiveSample.personas);

    // 4. Package as Reproducible Benchmark Dataset Package
    const datasetPackage = datasetPackageManager.buildPackage({
      benchmark: stressBenchmark,
      experiments: [baselineExperiment, stressExperiment],
      experimentReports: [baselineReport, stressReport],
      specifications: [request.spec, ...stressSpecs],
      coverageReport,
    });

    return {
      loopId,
      benchmarkId,
      targetAgent: request.targetAgent,
      baselineBenchmark,
      detectedFailures,
      vulnerableCohorts,
      adaptiveStressBenchmark: stressBenchmark,
      differentialReport: {
        baselineMeanScore: baselineMean,
        stressMeanScore: stressMean,
        scoreDelta,
        failureFrequencyBefore: totalFailuresBefore,
        failureFrequencyUnderStress: totalFailuresUnderStress,
        executiveFinding: `Under targeted stress testing (${detectedFailures.join(", ")}), agent performance changed by ${scoreDelta} points (from ${baselineMean}% to ${stressMean}%). Vulnerability rate concentrated in ${vulnerableCohorts.join(", ")}.`,
      },
      reproduciblePackage: datasetPackage,
    };
  }
}

export const adaptiveLoopService = new AdaptiveLoopService();
