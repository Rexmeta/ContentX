import { describe, it, expect } from "vitest";
import {
  CUSTOMER_SERVICE_SCENARIOS,
  CUSTOMER_SERVICE_COHORTS,
  CUSTOMER_SERVICE_METRICS,
  buildBenchmarkSpaceCells,
  compileCustomerServiceReferenceBenchmark,
} from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import { provenanceLineageResolver } from "../population/provenanceResolver";
import { computeCanonicalLineageHash } from "@workspace/simulation-contract";
import { SimulationRuntimeEngine } from "../simulation/runtime/engine";

describe("P7-1 Reference Benchmark v1.0 & P7-2 MatrAIx Provenance Suite", () => {
  describe("P7-1: Customer Service Refund & Escalation Reference Benchmark v1.0", () => {
    it("compiles 10 scenarios, 8 cohorts, 9 metrics, and exactly 80 Benchmark Space cells", () => {
      expect(CUSTOMER_SERVICE_SCENARIOS).toHaveLength(10);
      expect(CUSTOMER_SERVICE_COHORTS).toHaveLength(8);
      expect(CUSTOMER_SERVICE_METRICS).toHaveLength(9);

      const cells = buildBenchmarkSpaceCells();
      expect(cells).toHaveLength(80);

      // Verify each cell contains explicit expectedBehavior and evaluationIntent
      const sampleCell = cells[0];
      expect(sampleCell.cellId).toContain("cell_");
      expect(sampleCell.expectedBehavior.length).toBeGreaterThan(10);
      expect(sampleCell.evaluationIntent.length).toBeGreaterThan(10);
    });

    it("compiles into a generic SimulationSpec and executes in standard simulation engine", async () => {
      const spec = compileCustomerServiceReferenceBenchmark();
      expect(spec.name).toBe("Customer Service Refund & Escalation Reference Benchmark v1.0");
      expect(spec.evaluationRubric.metrics).toHaveLength(9);
      expect(spec.world.rules).toHaveLength(3);

      const engine = new SimulationRuntimeEngine(spec);
      const result = await engine.run({ runId: "run_ref_bench_001" });

      expect(result.simulationId).toBeTruthy();
      expect(result.trace.events.length).toBeGreaterThanOrEqual(1);
      expect(result.evaluation).toBeDefined();
    });
  });

  describe("P7-2: MatrAIx Provenance & End-to-End Lineage Resolver", () => {
    const orgA = "org_acme_p7";
    const orgB = "org_competitor_p7";

    it("1. registers MatrAIx -> Canonical -> Population lineage", () => {
      const record = provenanceLineageResolver.registerLineage({
        organizationId: orgA,
        sourceType: "matraix_raw",
        sourceId: "matraix_ent_4412",
        sourceVersion: "1.2.0",
        sourceDataset: "matraix_ecommerce_korea_v2",
        sourceDatasetVersion: "2026.08",
        populationVersion: "pop_v1_0",
        canonicalPayload: { name: "Kim Min-ji", role: "customer" },
        dimensions: { frustration: 0.85, assertiveness: 0.7 },
      });

      expect(record.source.sourceType).toBe("matraix_raw");
      expect(record.source.sourceDataset).toBe("matraix_ecommerce_korea_v2");
      expect(record.entityLineageHash).toHaveLength(64);
    });

    it("2. links Population -> Character -> Snapshot -> Trajectory -> Evaluation -> Evidence", () => {
      const charId = "char_cust_901";
      const snapId = "snap_cust_901_v1";
      const evalId = "eval_bench_771";
      const evidenceId = "evid_trace_0091";

      const record = provenanceLineageResolver.registerLineage({
        organizationId: orgA,
        sourceType: "matraix_curated",
        sourceId: "matraix_cur_5501",
        sourceVersion: "2.0.0",
        sourceDataset: "matraix_banking_cs_gold",
        sourceDatasetVersion: "2026.09",
        samplingRunId: "sample_run_88",
        populationVersion: "pop_v2_1",
        characterId: charId,
        snapshotId: snapId,
        trajectoryId: "traj_run_99",
        evaluationId: evalId,
        evidenceTraceId: evidenceId,
        canonicalPayload: { archetype: "frustrated_expressive" },
      });

      expect(record.lineage.characterId).toBe(charId);
      expect(record.lineage.snapshotId).toBe(snapId);
      expect(record.lineage.evidenceTraceId).toBe(evidenceId);
    });

    it("3. performs reverse lookup from Evidence and Evaluation to MatrAIx source dataset", () => {
      const evidenceId = "evid_trace_reverse_test";
      provenanceLineageResolver.registerLineage({
        organizationId: orgA,
        sourceType: "matraix_raw",
        sourceId: "matraix_raw_9921",
        sourceVersion: "1.0.0",
        sourceDataset: "matraix_telecom_churn_v1",
        sourceDatasetVersion: "2026.07",
        evidenceTraceId: evidenceId,
        canonicalPayload: { name: "Park Ji-hoon" },
      });

      const reverseByEvidence = provenanceLineageResolver.resolveSourceByEvidence(evidenceId, orgA);
      expect(reverseByEvidence).not.toBeNull();
      expect(reverseByEvidence?.source.sourceDataset).toBe("matraix_telecom_churn_v1");
      expect(reverseByEvidence?.source.sourceDatasetVersion).toBe("2026.07");
    });

    it("4. generates identical lineage hash for same source + same payload", () => {
      const payload = { role: "vip", score: 99 };
      const hash1 = computeCanonicalLineageHash({
        sourceType: "matraix_raw",
        sourceId: "src_001",
        sourceVersion: "1.0.0",
        sourceDataset: "ds_1",
        canonicalPayload: payload,
      });

      const hash2 = computeCanonicalLineageHash({
        sourceType: "matraix_raw",
        sourceId: "src_001",
        sourceVersion: "1.0.0",
        sourceDataset: "ds_1",
        canonicalPayload: payload,
      });

      expect(hash1).toBe(hash2);
    });

    it("5. generates different lineage hash when source version or dataset changes", () => {
      const payload = { role: "vip", score: 99 };
      const hashV1 = computeCanonicalLineageHash({
        sourceType: "matraix_raw",
        sourceId: "src_001",
        sourceVersion: "1.0.0",
        sourceDataset: "ds_1",
        canonicalPayload: payload,
      });

      const hashV2 = computeCanonicalLineageHash({
        sourceType: "matraix_raw",
        sourceId: "src_001",
        sourceVersion: "2.0.0",
        sourceDataset: "ds_1",
        canonicalPayload: payload,
      });

      expect(hashV1).not.toBe(hashV2);
    });

    it("6. preserves manual character lineage without inventing false MatrAIx provenance", () => {
      const manualRecord = provenanceLineageResolver.registerLineage({
        organizationId: orgA,
        sourceType: "manual",
        sourceId: "usr_created_alice",
        characterId: "char_manual_alice",
        canonicalPayload: { name: "Alice Author Created" },
      });

      expect(manualRecord.source.sourceType).toBe("manual");
      expect(manualRecord.source.sourceDataset).toBeUndefined();
      expect(manualRecord.lineage.samplingRunId).toBeUndefined();
    });

    it("7. retains perturbation metadata for synthetic perturbed characters", () => {
      const perturbedRecord = provenanceLineageResolver.registerLineage({
        organizationId: orgA,
        sourceType: "synthetic_perturbed",
        sourceId: "matraix_raw_4412",
        sourceDataset: "matraix_ecommerce_korea_v2",
        characterId: "char_perturbed_01",
        canonicalPayload: { base: "Kim Min-ji", noise: 0.15 },
        traits: { perturbationIntensity: 0.8, targetDimension: "frustration" },
      });

      expect(perturbedRecord.source.sourceType).toBe("synthetic_perturbed");
      expect(perturbedRecord.source.metadata.perturbationIntensity).toBe(0.8);
    });

    it("8. blocks Cross-Tenant access during lineage reverse lookup (Org A -> Org B)", () => {
      const evidenceSecret = "evid_secret_org_a";
      provenanceLineageResolver.registerLineage({
        organizationId: orgA,
        sourceType: "matraix_raw",
        sourceId: "secret_ent_001",
        evidenceTraceId: evidenceSecret,
        canonicalPayload: { classified: true },
      });

      expect(() => {
        provenanceLineageResolver.resolveSourceByEvidence(evidenceSecret, orgB);
      }).toThrow(/Forbidden: Cross-tenant access/);
    });

    it("9. handles legacy entities without provenance gracefully (returns null without crashing)", () => {
      const nonExistent = provenanceLineageResolver.getLineageSafe("lin_non_existent_legacy");
      expect(nonExistent).toBeNull();

      const nonExistentEvidence = provenanceLineageResolver.resolveSourceByEvidence("evid_unknown_legacy");
      expect(nonExistentEvidence).toBeNull();
    });
  });
});
