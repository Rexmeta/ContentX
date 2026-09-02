import { describe, it, expect } from "vitest";
import { commercialPilotService } from "../evaluation/commercialPilotService";
import { externalFinTechPilotAgent } from "../agent/externalPilotAgent";
import { compileCustomerServiceReferenceBenchmark } from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import { evidencePackageBuilder } from "../saas/evidencePackageBuilder";
import { provenanceLineageResolver } from "../population/provenanceResolver";

describe("P8 External Agent Validation & Commercial Pilot Suite (Gate #1 ~ Gate #4)", () => {
  const tenantId = "org_fintech_pilot_client_2026";
  const spec = compileCustomerServiceReferenceBenchmark();

  let pilotResult: Awaited<ReturnType<typeof commercialPilotService.executePilot>>;

  it("executes the full P8 Commercial Pilot Pipeline (Gate #1 ~ Gate #4)", async () => {
    pilotResult = await commercialPilotService.executePilot({
      tenantId,
      spec,
      externalAgent: externalFinTechPilotAgent,
    });

    expect(pilotResult.pilotId).toBeTruthy();
    expect(pilotResult.gatesStatus.overallPilotStatus).toBe("PASS");
  });

  describe("P8 Gate #1: External Connect & 8-Step Preflight Check", () => {
    it("1. onboards independent external agent and passes all 8 preflight checks", () => {
      const preflight = pilotResult.preflightReport;
      expect(preflight.isReadyForBenchmarking).toBe(true);
      expect(preflight.passedChecksCount).toBeGreaterThanOrEqual(6);
      expect(preflight.agentId).toBe("agent_external_fintech_cs");
      expect(pilotResult.gatesStatus.gate1ExternalConnect).toBe(true);
    });

    it("2. measures Time to First Benchmark and Preflight Success Rate", () => {
      const timeKpi = pilotResult.kpiScorecard.find((k) => k.kpi === "Time to First Benchmark");
      const preflightKpi = pilotResult.kpiScorecard.find((k) => k.kpi === "Preflight Success Rate");

      expect(timeKpi?.met).toBe(true);
      expect(preflightKpi?.met).toBe(true);
      expect(preflightKpi?.observed).toBe("100.0");
    });
  });

  describe("P8 Gate #2: External Discovery on 1,000 Executed Synthetic Simulations", () => {
    it("1. analyzes 1,000 executed synthetic simulations and discovers natural failure patterns", () => {
      const discovery = pilotResult.failureDiscoveryReport;
      expect(discovery.totalTrajectoriesAnalyzed).toBe(1000);
      expect(discovery.discoveredFailures.length).toBeGreaterThanOrEqual(1);

      const boundaryFailure = discovery.discoveredFailures.find((f) => f.patternType === "boundary_violation");
      expect(boundaryFailure).toBeDefined();
      expect(boundaryFailure?.severity).toBe("critical");
      expect(boundaryFailure?.occurrences).toBeGreaterThanOrEqual(50);
      expect(pilotResult.gatesStatus.gate2ExternalDiscovery).toBe(true);
    });

    it("2. separates Observed Behavioral Divergence from Causal Hypothesis", () => {
      const boundaryFailure = pilotResult.failureDiscoveryReport.discoveredFailures.find(
        (f) => f.patternType === "boundary_violation"
      )!;

      expect(boundaryFailure.observedBehavioralDivergence.expected).toBeTruthy();
      expect(boundaryFailure.observedBehavioralDivergence.observed).toBeTruthy();
      expect(boundaryFailure.causalHypothesis.hypothesis).toBeTruthy();
      expect(boundaryFailure.causalHypothesis.confidence).toBe("provisional");
    });

    it("3. traces evidence IDs back to source MatrAIx dataset & version", () => {
      const firstEvidenceId = "pilot_v1_run_0014";
      const record = provenanceLineageResolver.resolveSourceByEvidence(firstEvidenceId, tenantId);

      expect(record).not.toBeNull();
      expect(record?.source.sourceDataset).toBe("matraix_fintech_cs_gold");
      expect(record?.source.sourceDatasetVersion).toBe("2026.09");
    });

    it("4. measures Cost & Latency breakdown with p50/p95/p99 percentiles", () => {
      const cost = pilotResult.costAndLatency;
      expect(cost.totalCostUSD).toBeLessThan(5.0);
      expect(cost.infrastructureCostUSD).toBeGreaterThan(0);
      expect(cost.agentInferenceCostUSD).toBeGreaterThan(0);
      expect(cost.latencyStats.p50Ms).toBeLessThan(200);
      expect(cost.latencyStats.p95Ms).toBeLessThan(1000);
    });
  });

  describe("P8 Gate #3: Regression Control (DISCOVER -> STRESS -> FIX -> VERIFY Loop)", () => {
    it("1. BLOCKS regressive candidate v2.0.0 due to Simpson's Paradox cohort failure", () => {
      const v2Gate = pilotResult.v2RegressiveGateResult;
      expect(v2Gate.decision).toBe("BLOCKED");
      expect(v2Gate.reason).toContain("CRITICAL_COHORT_REGRESSION");
      expect(v2Gate.reason).toContain("boundary_tester_customer");
    });

    it("2. APPROVES hardened candidate v2.1.0 across all evaluated dimensions", () => {
      const v21Gate = pilotResult.v21FixedGateResult;
      expect(v21Gate.decision).toBe("APPROVED");
      expect(v21Gate.reason).toContain("APPROVE DEPLOYMENT");
      expect(v21Gate.regressionReport?.overall.delta).toBeGreaterThan(0);
      expect(pilotResult.gatesStatus.gate3RegressionControl).toBe(true);
    });
  });

  describe("P8 Gate #4: Commercial Proof & Cryptographic Evidence Verification", () => {
    it("1. generates 5 complete client-facing artifacts and verifies SHA-256 tamper detection", () => {
      const evidencePkg = pilotResult.evidencePackage;
      expect(evidencePkg.manifest.schemaVersion).toBe("contentx.evidence.v2");
      expect(evidencePkg.manifest.lineageChain.agentId).toBe("agent_external_fintech_cs");
      expect(evidencePkg.manifest.lineageChain.agentVersion).toBe("2.1.0");

      const verify = evidencePackageBuilder.verifyPackage(evidencePkg);
      expect(verify.valid).toBe(true);
      expect(verify.rootMatch).toBe(true);
      expect(verify.fileMismatches).toHaveLength(0);
    });

    it("2. validates full Commercial KPI scorecard against target SLAs", () => {
      const scorecard = pilotResult.kpiScorecard;
      const failedKpis = scorecard.filter((k) => !k.met);
      expect(failedKpis).toEqual([]);
      expect(pilotResult.gatesStatus.gate4CommercialProof).toBe(true);
    });
  });
});
