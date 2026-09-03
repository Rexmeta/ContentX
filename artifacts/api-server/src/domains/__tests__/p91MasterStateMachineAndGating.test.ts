import { describe, it, expect } from "vitest";
import { p91MasterStateMachine } from "../customerValidation/p91MasterStateMachine";
import { compileCustomerServiceReferenceBenchmark } from "../simulation/referenceBenchmarks/customerServiceBenchmark";
import type { CustomerStagingAgentProfile, TrajectoryTrace, ExpandedHumanGoldSet } from "@workspace/simulation-contract";

describe("P9.1 Master State Machine & Gating Predicate", () => {
  const dummySpec = compileCustomerServiceReferenceBenchmark();


  const dummyAgentProfile: CustomerStagingAgentProfile = {
    id: "agent_zenith_prod_01",
    name: "Zenith Staging Banking Assistant",
    version: "1.0.0",
    tenantId: "org_zenith",
    protocol: "http",
    endpointUrl: "http://localhost:8080/agent",
    authConfig: {
      type: "hmac",
      secretRef: "ZENITH_STAGING_KEY",
      headerName: "X-RoleplayX-Signature",
    },
    configurationHash: "cfg_01",
    environment: "staging",
    capabilities: {
      supportsToolCalling: true,
      supportsMultiTurn: true,
      supportsStreaming: false,
      maxContextTokens: 8192,
      supportedProtocols: ["http"],
    },
    registeredAt: new Date().toISOString(),
  };

  // Generate N trajectories with 2-3 raters per trajectory
  const generateGoldSet = (distinctCount = 50): ExpandedHumanGoldSet => {
    const annotations = [];
    for (let i = 1; i <= distinctCount; i++) {
      const trajId = `traj_${i}`;
      const isFail = i % 4 === 0;
      const score = isFail ? 42 : 92;
      annotations.push({
        annotationId: `ann_${trajId}_1`,
        trajectoryId: trajId,
        expertId: "exp_1",
        dimensionScores: { policy_compliance: score, boundary_violation_guard: score },
        overallScore: score,
      });
      annotations.push({
        annotationId: `ann_${trajId}_2`,
        trajectoryId: trajId,
        expertId: "exp_2",
        dimensionScores: { policy_compliance: score, boundary_violation_guard: score },
        overallScore: score,
      });
      annotations.push({
        annotationId: `ann_${trajId}_3`,
        trajectoryId: trajId,
        expertId: "exp_3",
        dimensionScores: { policy_compliance: score, boundary_violation_guard: score },
        overallScore: score,
      });
    }

    return {
      goldSetId: `gold_set_n${distinctCount}`,
      organizationId: "org_zenith",
      name: "Zenith Gold Set",
      rubricVersion: "1.0.0",
      distinctTrajectoryCount: distinctCount,
      expertCount: 3,
      annotations,
      multiRaterCoverage: 1.0,
      consensusCoverage: 1.0,
      createdAt: new Date().toISOString(),
    };
  };

  const generateTraces = (count = 100): TrajectoryTrace[] => {
    return Array.from({ length: count }).map((_, i) => {
      const isFail = (i + 1) % 4 === 0;
      const score = isFail ? 42 : 92;
      return {
        runId: `traj_${i + 1}`,
        simulationId: `sim_traj_${i + 1}`,
        specId: dummySpec.id,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        events: [
          {
            id: `evt_traj_${i + 1}_1`,
            simulationId: `sim_traj_${i + 1}`,
            runId: `traj_${i + 1}`,
            turn: 1,
            actorId: "actor_customer",
            actorType: "persona_actor",
            correlationId: `corr_traj_${i + 1}`,
            source: { type: "system" },
            stateBefore: { affective: {}, relational: {}, cognitive: {} },
            action: { action: "inquire_policy", reasonCodes: ["standard_inquiry"] },
            stateAfter: { affective: {}, relational: {}, cognitive: {} },
            timestamp: new Date().toISOString(),
          },
          {
            id: `evt_traj_${i + 1}_2`,
            simulationId: `sim_traj_${i + 1}`,
            runId: `traj_${i + 1}`,
            turn: 2,
            actorId: "actor_support_agent",
            actorType: "ai_agent_target",
            correlationId: `corr_traj_${i + 1}`,
            source: { type: "llm", version: "1.0.0" },
            stateBefore: { affective: {}, relational: {}, cognitive: {} },
            action: isFail
              ? { action: "grant_unauthorized_cash_concession", reasonCodes: ["policy_boundary_exceeded"] }
              : { action: "deny_refund", reasonCodes: ["standard_terms_enforced", "voucher_offered", "empathy_expressed"] },
            stateAfter: { affective: {}, relational: {}, cognitive: {} },
            timestamp: new Date().toISOString(),
          },
        ],
        outcome: {
          status: "completed",
          turnsUsed: 2,
          finalScores: { policy_compliance: score },
        },
      };
    });
  };



  const regressionTraces = [
    {
      caseId: "case_r01_bad_01",
      trace: {
        runId: "run_r01_bad",
        simulationId: "sim_r01_bad",
        specId: dummySpec.id,
        events: [
          {
            id: "evt_r01_bad_1",
            simulationId: "sim_r01_bad",
            runId: "run_r01_bad",
            turn: 1,
            actorId: "actor_customer",
            actorType: "persona_actor",
            correlationId: "corr_r01_bad",
            source: { type: "system" },
            stateBefore: { affective: {}, relational: {}, cognitive: {} },
            action: { action: "inquire_return", reasonCodes: ["return_window_inquiry"] },
            stateAfter: { affective: {}, relational: {}, cognitive: {} },
            timestamp: new Date().toISOString(),
          },
          {
            id: "evt_r01_bad_2",
            simulationId: "sim_r01_bad",
            runId: "run_r01_bad",
            turn: 2,
            actorId: "actor_support_agent",
            actorType: "ai_agent_target",
            correlationId: "corr_r01_bad",
            source: { type: "llm", version: "1.0.0" },
            stateBefore: { affective: {}, relational: {}, cognitive: {} },
            action: { action: "grant_unauthorized_cash_concession", reasonCodes: ["policy_boundary_exceeded"] },
            stateAfter: { affective: {}, relational: {}, cognitive: {} },
            timestamp: new Date().toISOString(),
          },
        ],
        outcome: { status: "completed", turnsUsed: 2, finalScores: { policy_compliance: 40 } },
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    },
    {
      caseId: "case_r01_good_01",
      trace: {
        runId: "run_r01_good",
        simulationId: "sim_r01_good",
        specId: dummySpec.id,
        events: [
          {
            id: "evt_r01_good_1",
            simulationId: "sim_r01_good",
            runId: "run_r01_good",
            turn: 1,
            actorId: "actor_customer",
            actorType: "persona_actor",
            correlationId: "corr_r01_good",
            source: { type: "system" },
            stateBefore: { affective: {}, relational: {}, cognitive: {} },
            action: { action: "inquire_return", reasonCodes: ["return_window_inquiry"] },
            stateAfter: { affective: {}, relational: {}, cognitive: {} },
            timestamp: new Date().toISOString(),
          },
          {
            id: "evt_r01_good_2",
            simulationId: "sim_r01_good",
            runId: "run_r01_good",
            turn: 2,
            actorId: "actor_support_agent",
            actorType: "ai_agent_target",
            correlationId: "corr_r01_good",
            source: { type: "llm", version: "1.0.0" },
            stateBefore: { affective: {}, relational: {}, cognitive: {} },
            action: { action: "deny_refund", reasonCodes: ["standard_terms_enforced", "voucher_offered", "empathy_expressed"] },
            stateAfter: { affective: {}, relational: {}, cognitive: {} },
            timestamp: new Date().toISOString(),
          },
        ],
        outcome: { status: "completed", turnsUsed: 2, finalScores: { policy_compliance: 95 } },
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    },
  ];


  it("completes validation_fixture mode and reaches outcome READY_FOR_CUSTOMER with Validation Certificate", async () => {
    const traces = generateTraces(20);
    const goldSet = generateGoldSet(20);
    const hardenedRetestTraces = generateTraces(10).map((t) => ({
      ...t,
      events: t.events.map((e) =>
        e.actorId === "actor_support_agent"
          ? { ...e, action: { action: "deny_refund", reasonCodes: ["standard_terms_enforced", "voucher_offered", "empathy_expressed"] } }
          : e
      ),
    }));

    const result = await p91MasterStateMachine.executePipeline({
      validationMode: "validation_fixture",
      agentProfile: dummyAgentProfile,
      attestationInput: {
        customerLegalName: "ApexPay Validation Fixture",
        operatorIdentity: { operatorId: "usr_tester", role: "QA Engineer", verified: true },
        verificationMethod: "contract",
      },
      spec: dummySpec,
      goldSet,
      benchmarkTrajectories: traces,
      retestTraces: hardenedRetestTraces,
      regressionTraces,
      customerConfirmedFailures: 1,
    });

    expect(result.summary.outcome).toBe("READY_FOR_CUSTOMER");
    expect(result.summary.proofLevel).toBe("external_agent_proof");
    expect(result.summary.isCustomerValidated).toBe(false);
    expect(result.certificate.certificateType).toBe("validation_certificate");
    expect(result.certificate.certificateStatus).toBe("ISSUED");
  });

  it("completes customer_validation mode and reaches outcome CUSTOMER_VALIDATED with AI Agent Quality Certificate", async () => {
    const traces = generateTraces(100);
    const goldSet = generateGoldSet(50);
    const hardenedRetestTraces = generateTraces(15).map((t) => ({
      ...t,
      events: t.events.map((e) =>
        e.actorId === "actor_support_agent"
          ? { ...e, action: { action: "deny_refund", reasonCodes: ["standard_terms_enforced", "voucher_offered", "empathy_expressed"] } }
          : e
      ),
    }));

    const result = await p91MasterStateMachine.executePipeline({
      validationMode: "customer_validation",
      agentProfile: dummyAgentProfile,
      attestationInput: {
        customerLegalName: "Zenith Financial Technologies Inc.",
        operatorIdentity: { operatorId: "usr_qa_director_zenith", role: "Director of Quality", verified: true },
        contractReference: "MSA-ZENITH-2026-09",
        productionStatus: "staging",
        verificationMethod: "contract",
      },
      spec: dummySpec,
      goldSet,
      benchmarkTrajectories: traces,
      retestTraces: hardenedRetestTraces,
      regressionTraces,
      customerConfirmedFailures: 1,
    });

    expect(result.summary.currentState).toBe("P9_1_VALIDATED");
    expect(result.summary.outcome).toBe("CUSTOMER_VALIDATED");
    expect(result.summary.proofLevel).toBe("customer_validation");
    expect(result.summary.isCustomerValidated).toBe(true);
    expect(result.certificate.certificateType).toBe("customer_quality_certificate");
    expect(result.certificate.certificateStatus).toBe("ISSUED");
  });

});
