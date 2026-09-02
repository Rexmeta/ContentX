import { z } from "zod";
import { ComprehensiveBenchmarkReportSchema } from "./benchmark";
import { ExperimentSpecSchema, ExperimentExecutionReportSchema } from "./experiment";
import { SimulationSpecSchema } from "./spec";
import { PopulationCoverageReportSchema } from "./population";

export const BenchmarkManifestSchema = z.object({
  schemaVersion: z.string().default("2026.1.0"),
  benchmarkId: z.string(),
  benchmarkVersion: z.string().default("1.0.0"),
  specVersion: z.string().default("1.0.0"),
  populationVersion: z.string().default("1.0.0"),
  evaluatorVersion: z.string().default("2.0.0-multi-layer"),
  agentVersions: z.record(z.string()).default({}),
  seedPolicy: z.string().default("deterministic-combinatorial-v1"),
  createdAt: z.string(),
  checksum: z.string(),
  isImmutable: z.boolean().default(true),
});
export type BenchmarkManifest = z.infer<typeof BenchmarkManifestSchema>;

export const BenchmarkDatasetPackageSchema = z.object({
  manifest: BenchmarkManifestSchema,
  benchmark: ComprehensiveBenchmarkReportSchema,
  experiments: z.array(ExperimentSpecSchema),
  experimentReports: z.array(ExperimentExecutionReportSchema),
  specifications: z.array(SimulationSpecSchema),
  coverageReport: PopulationCoverageReportSchema.optional(),
  exportedAt: z.string(),
});
export type BenchmarkDatasetPackage = z.infer<typeof BenchmarkDatasetPackageSchema>;
