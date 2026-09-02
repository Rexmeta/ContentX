import { createHash } from "crypto";
import type {
  BenchmarkDatasetPackage,
  BenchmarkManifest,
  ComprehensiveBenchmarkReport,
  ExperimentSpec,
  ExperimentExecutionReport,
  SimulationSpec,
  PopulationCoverageReport,
} from "@workspace/simulation-contract";

export class DatasetPackageManager {
  buildPackage(options: {
    benchmark: ComprehensiveBenchmarkReport;
    experiments: ExperimentSpec[];
    experimentReports: ExperimentExecutionReport[];
    specifications: SimulationSpec[];
    coverageReport?: PopulationCoverageReport;
  }): BenchmarkDatasetPackage {
    const { benchmark, experiments, experimentReports, specifications, coverageReport } = options;

    const rawPayload = JSON.stringify({ benchmark, experiments, specifications });
    const checksum = createHash("sha256").update(rawPayload).digest("hex");

    const agentVersions: Record<string, string> = {};
    for (const a of benchmark.agents) {
      agentVersions[a.agentId] = `${a.provider}-v1`;
    }

    const manifest: BenchmarkManifest = {
      schemaVersion: "2026.1.0",
      benchmarkId: benchmark.benchmarkId,
      benchmarkVersion: "1.0.0",
      specVersion: "1.0.0",
      populationVersion: "1.0.0",
      evaluatorVersion: "2.0.0-multi-layer",
      agentVersions,
      seedPolicy: "deterministic-combinatorial-v1",
      createdAt: new Date().toISOString(),
      checksum,
      isImmutable: true,
    };

    return {
      manifest,
      benchmark,
      experiments,
      experimentReports,
      specifications,
      coverageReport,
      exportedAt: new Date().toISOString(),
    };
  }
}

export const datasetPackageManager = new DatasetPackageManager();
