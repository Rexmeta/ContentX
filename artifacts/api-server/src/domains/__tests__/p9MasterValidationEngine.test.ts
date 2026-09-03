import { describe, it, expect } from "vitest";
import { p9MasterValidationEngine } from "../productionEvidence/p9MasterValidationEngine";
import { compileCustomerServiceReferenceBenchmark } from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import { standardRegressionCorpusService } from "../productionEvidence/standardRegressionCorpusService";
import type {
  ExternalAgentRegistration,
  HumanGoldSet,
  HumanGoldAnnotation,
  TrajectoryTrace,
} from "@workspace/simulation-contract";

describe("P9 Master Validation Engine Suite (Gate #1 ~ Gate #4 Integration)", () => {
  const spec = compileCustomerServiceReferenceBenchmark();

  const dummyAgent: ExternalAgentRegistration = {
    id: "agent_client_apexpay_master",
    name: "ApexPay Enterprise Pilot Agent",
    version: "2.1.0",
    tenantId: "org_pilot_client_2026",
    protocol: "http",
    endpointUrl: "http://localhost/apexpay-master",
    authConfig: {
      type: "hmac",
      secretToken: "master_secret",
      headerName: "X-RoleplayX-Signature",
    },
    configurationHash: "cfg_hash_apexpay_master",
    capabilities: {
      supportsToolCalling: true,
      supportsMultiTurn: true,
      supportsStreaming: false,
      maxContextTokens: 8192,
      supportedProtocols: ["http"],
    },
    createdAt: new Date().toISOString(),
  };

  function createGoldData(): { goldSet: HumanGoldSet; benchmarkTrajectories: TrajectoryTrace[]; regressionTraces: Array<{ caseId: string; trace: TrajectoryTrace }> } {
    const annotations: HumanGoldAnnotation[] = [];
    const benchmarkTrajectories: TrajectoryTrace[] = [];

    for (let i = 1; i <= 20; i++) {
      const trajId = `traj_p9_${String(i).padStart(2, "0")}`;
      const isFail = i % 4 === 0;
      const score = isFail ? 42 : 92;

      benchmarkTrajectories.push({
        runId: trajId,
        simulationId: `sim_${trajId}`,
        specId: spec.id,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        events: [
          {
            id: `evt_${trajId}_1`,
            simulationId: `sim_${trajId}`,
            runId: trajId,
            turn: 1,
            actorId: "actor_customer",
            actorType: "persona_actor",
            correlationId: `corr_${trajId}`,
            source: { type: "system" },
            stateBefore: { affective: {}, relational: {}, cognitive: {} },
            action: { action: "customer_inquiry", reasonCodes: ["test"] },
            stateAfter: { affective: {}, relational: {}, cognitive: {} },
            timestamp: new Date().toISOString(),
          },
          {
            id: `evt_${trajId}_2`,
            simulationId: `sim_${trajId}`,
            runId: trajId,
            turn: 2,
            actorId: "actor_support_agent",
            actorType: "ai_agent_target",
            correlationId: `corr_${trajId}`,
            source: { type: "llm", version: "1.0.0" },
            stateBefore: { affective: {}, relational: {}, cognitive: {} },
            action: !isFail
              ? { action: "deny_refund", reasonCodes: ["standard_terms_enforced", "voucher_offered", "empathy_expressed"] }
              : { action: "grant_unauthorized_cash_concession", reasonCodes: ["policy_boundary_exceeded"] },
            stateAfter: { affective: {}, relational: {}, cognitive: {} },
            timestamp: new Date().toISOString(),
          },
        ],
        outcome: { status: "completed", turnsUsed: 2, finalScores: { policy_compliance: score } },
      });

      for (const expertId of ["exp_01", "exp_02", "exp_03"]) {
        annotations.push({
          annotationId: `ann_${trajId}_${expertId}`,
          trajectoryId: trajId,
          scenarioId: "policy_boundary_cash_limit",
          cohortId: "boundary_tester_customer",
          rubricVersion: "1.0.0",
          dimensionScores: { policy_compliance: score },
          overallScore: score,
          expertId,
          annotationVersion: "1.0.0",
          annotationTimestamp: new Date().toISOString(),
        });
      }
    }

    const goldSet: HumanGoldSet = {
      goldSetId: "gold_set_p9_master",
      organizationId: "org_pilot_client_2026",
      name: "P9 Master Validation Gold Set",
      rubricVersion: "1.0.0",
      annotations,
      expertCount: 3,
      createdAt: new Date().toISOString(),
    };

    const corpus = standardRegressionCorpusService.getCanonicalCorpus();
    const regressionTraces = corpus.map((c) => {
      const isFail = !c.isKnownGood;
      return {
        caseId: c.caseId,
        trace: {
          runId: `run_reg_${c.caseId}`,
          simulationId: `sim_reg_${c.caseId}`,
          specId: spec.id,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          events: [
            {
              id: `evt_reg_${c.caseId}_1`,
              simulationId: `sim_reg_${c.caseId}`,
              runId: `run_reg_${c.caseId}`,
              turn: 1,
              actorId: "actor_customer",
              actorType: "persona_actor",
              correlationId: `corr_reg_${c.caseId}`,
              source: { type: "system" },
              stateBefore: { affective: {}, relational: {}, cognitive: {} },
              action: { action: "test_inquiry", reasonCodes: ["test_probe"] },
              stateAfter: { affective: {}, relational: {}, cognitive: {} },
              timestamp: new Date().toISOString(),
            },
            {
              id: `evt_reg_${c.caseId}_2`,
              simulationId: `sim_reg_${c.caseId}`,
              runId: `run_reg_${c.caseId}`,
              turn: 2,
              actorId: "actor_support_agent",
              actorType: "ai_agent_target",
              correlationId: `corr_reg_${c.caseId}`,
              source: { type: "llm", version: "1.0.0" },
              stateBefore: { affective: {}, relational: {}, cognitive: {} },
              action: isFail
                ? { action: "grant_unauthorized_cash_concession", reasonCodes: ["policy_boundary_exceeded"] }
                : { action: "deny_refund", reasonCodes: ["standard_terms_enforced", "voucher_offered", "empathy_expressed"] },
              stateAfter: { affective: {}, relational: {}, cognitive: {} },
              timestamp: new Date().toISOString(),
            },
          ],
          outcome: { status: "completed", turnsUsed: 2, finalScores: { policy_compliance: isFail ? 42 : 92 } },
        },
      };
    });

    return { goldSet, benchmarkTrajectories, regressionTraces };
  }

  it("1. executes full P9 pipeline on validation fixture and outputs P9_READY_FOR_CUSTOMER", async () => {
    const { goldSet, benchmarkTrajectories, regressionTraces } = createGoldData();

    const { result, evidencePackageV3 } = await p9MasterValidationEngine.executeValidation({
      agent: dummyAgent,
      ownershipType: "validation_fixture",
      spec,
      goldSet,
      benchmarkTrajectories,
      regressionTraces,
      environment: "staging",
    });

    expect(result.blockingReasons).toEqual([]);
    expect(result.overallStatus).toBe("P9_READY_FOR_CUSTOMER");
    expect(result.gate1.status).toBe("PASS");
    expect(result.gate2.status).toBe("PASS");
    expect(result.gate3.status).toBe("PASS");
    expect(result.gate4.status).toBe("PASS");
    expect(result.calibrationStatus).toBe("CALIBRATED");
    expect(result.certificateId).toBeTruthy();

    expect(evidencePackageV3.manifest.schemaVersion).toBe("contentx.evidence.v3");
    expect(Object.keys(evidencePackageV3.files).length).toBe(20);
  });
});
