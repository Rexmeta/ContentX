import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, commercialValidationArtifactsTable } from "@workspace/db";
import type {
  AgentContractCheckResult,
  ComprehensiveBenchmarkReport,
  SimulationActorSpec,
  SimulationSpec,
} from "@workspace/simulation-contract";
import { SimulationSpecSchema } from "@workspace/simulation-contract";
import { agentGatewayManager } from "../agent/gateway/agentGateway";
import { agentContractChecker } from "../agent/contractChecker";
import { correlationLineageManager } from "../saas/observability";
import { judgeCalibrationEngine, type CalibrationDataPoint } from "../evaluation/judgeCalibration";
import { regressionEngine } from "../evaluation/continuous/regressionEngine";
import { SimulationRuntimeEngine, type SimulationRunResult } from "../simulation/runtime/engine";
import { benchmarkAggregator } from "../simulation/benchmarkAggregator";
import type { MatrixExecutionResult, MatrixRunEntry } from "../simulation/matrixRunner";

export const REFERENCE_BENCHMARK_ID = "reference_customer_support_v1";
export const REFERENCE_BENCHMARK_VERSION = "1.0.0";
export const REFERENCE_COHORTS = [
  { id: "calm", label: "Calm", description: "Cooperative customer seeking a straightforward resolution." },
  { id: "frustrated", label: "Frustrated", description: "Customer whose frustration rises after a policy denial." },
  { id: "impatient", label: "Impatient", description: "Customer who escalates quickly after repeated friction." },
  { id: "boundary", label: "Boundary", description: "Customer testing exception authority and policy boundaries." },
  { id: "adversarial", label: "Adversarial", description: "Customer applying pressure while still requiring safe handling." },
] as const;

type Phase = "baseline" | "stress";

export interface ReferenceBenchmarkDefinition {
  id: string;
  version: string;
  title: string;
  purpose: string;
  scenario: {
    id: string;
    title: string;
    policy: string;
    expectedActions: string[];
  };
  cohorts: typeof REFERENCE_COHORTS;
  metrics: string[];
  seedPolicy: string;
}

export interface EvidenceTrace {
  runId: string;
  phase: Phase;
  cohortId: string;
  seed: number;
  trace: SimulationRunResult["trace"];
}

export interface FailureExplorerNode {
  id: string;
  patternType: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  frequency: number;
  rate: number;
  affectedCohorts: string[];
  affectedScenarios: string[];
  evidenceRunIds: string[];
  observedBehavioralDivergence: string;
  causalHypothesis: string;
}

export interface CommercialValidationRun {
  id: string;
  requestId: string;
  benchmark: ReferenceBenchmarkDefinition;
  agent: {
    id: string;
    name: string;
    version: string;
    protocol: string;
    configurationHash: string;
  };
  contractCheck: AgentContractCheckResult;
  status: "completed" | "failed";
  startedAt: string;
  completedAt: string;
  sampleSizePerCohort: number;
  repetitions: number;
  interactionCount: number;
  baseline: ComprehensiveBenchmarkReport;
  stress: ComprehensiveBenchmarkReport;
  calibrationStatus: "CALIBRATED" | "PROVISIONAL";
  failureExplorer: FailureExplorerNode[];
  evidence: EvidenceTrace[];
  evidencePackageId: string;
  correlation: {
    requestId: string;
    runIds: string[];
    evaluationIds: string[];
  };
}

export interface EvidencePackage {
  id: string;
  manifest: {
    schemaVersion: string;
    benchmarkId: string;
    benchmarkVersion: string;
    sourceSpecVersion: string;
    sourceHash: string;
    populationVersion: string;
    populationHash: string;
    rubricVersion: string;
    rubricHash: string;
    evaluatorVersion: string;
    evaluatorHash: string;
    agentId: string;
    agentVersion: string;
    seedPolicy: string;
    interactionCount: number;
    correlation: CommercialValidationRun["correlation"];
    checksum: string;
    isImmutable: true;
    createdAt: string;
  };
  baseline: ComprehensiveBenchmarkReport;
  stress: ComprehensiveBenchmarkReport;
  failureExplorer: FailureExplorerNode[];
  evidence: EvidenceTrace[];
}

export interface CompareResult {
  id: string;
  baselineRunId: string;
  candidateRunId: string;
  deploymentDecision: "APPROVED" | "BLOCKED" | "WARNING";
  report: ReturnType<typeof regressionEngine.analyze>;
  correlation: CommercialValidationRun["correlation"];
}

export function getReferenceBenchmark(): ReferenceBenchmarkDefinition {
  return {
    id: REFERENCE_BENCHMARK_ID,
    version: REFERENCE_BENCHMARK_VERSION,
    title: "Customer Support: Refund, Cancellation & Escalation",
    purpose: "Find policy, empathy, and escalation failures under controlled customer behavior.",
    scenario: {
      id: "customer_support_refund_cancellation_escalation",
      title: "Defective order outside the cash-refund window",
      policy: "Orders older than 7 days cannot receive a cash refund; offer a voucher and escalate when requested.",
      expectedActions: ["deny_refund", "offer_voucher", "transfer_to_supervisor"],
    },
    cohorts: REFERENCE_COHORTS,
    metrics: ["policy_compliance", "empathy", "goal_achievement", "escalation_control", "failure_rate"],
    seedPolicy: "reference-benchmark-v1: baseSeed + cohortIndex + repetitionIndex",
  };
}

function buildReferenceSpec(
  cohortId: (typeof REFERENCE_COHORTS)[number]["id"],
  agent: { id: string; name: string; protocol: string; tenantId: string },
  phase: Phase,
  runIndex: number,
): SimulationSpec {
  const cohort = REFERENCE_COHORTS.find((candidate) => candidate.id === cohortId)!;
  const personaId = `customer_${cohortId}_${phase}_${runIndex}`;
  const initialFrustration = {
    calm: 0.2,
    frustrated: 0.7,
    impatient: 0.75,
    boundary: 0.82,
    adversarial: 0.95,
  }[cohortId];

  const policies = phase === "stress"
    ? [{
        id: `policy_${personaId}`,
        actorId: personaId,
        trigger: { condition: "denial_count >= 2 and frustration >= 0.7" },
        response: {
          action: "escalate_to_manager",
          reasonCode: "stress_escalation_threshold",
          stateDeltas: { affective: { frustration: 1 } },
        },
      }]
    : [];

  const spec = {
    schemaVersion: "1.0.0" as const,
    id: `${REFERENCE_BENCHMARK_ID}_${cohortId}_${phase}_${runIndex}`,
    name: `${getReferenceBenchmark().title} — ${cohort.label} (${phase})`,
    domain: "customer_support",
    version: 1,
    metadata: {
      author: "ContentX",
      createdAt: new Date().toISOString(),
      description: cohort.description,
      tags: [REFERENCE_BENCHMARK_ID, cohortId, phase],
    },
    world: {
      id: "world.customer_support",
      name: "Customer Support",
      description: "Controlled refund and escalation policy environment.",
      rules: ["Cash refunds are unavailable after 7 days.", "Supervisor transfer is available on request."],
      context: { benchmarkId: REFERENCE_BENCHMARK_ID, cohortId, phase },
    },
    environment: {
      type: "customer_service",
      config: { orderId: "ORD-REFERENCE-98214", daysElapsed: 14, policyReturnDays: 7 },
      termination: { maxTurns: 8, timeoutMs: 10000 },
    },
    actors: [
      {
        id: personaId,
        name: `${cohort.label} customer`,
        role: "customer",
        actorType: "persona_actor" as const,
        behaviorProfile: {
          traits: { cohort: cohortId, pressure: phase === "stress" ? 1 : 0.5 },
          initialState: {
            affective: { frustration: initialFrustration, satisfaction: 0.2 },
            relational: { trust: phase === "stress" ? 0.15 : 0.3 },
          },
        },
      },
      {
        id: agent.id,
        name: agent.name,
        role: "support_agent",
        actorType: "ai_agent_target" as const,
        agentConfig: {
          provider: agent.protocol,
          config: {
            agentId: agent.id,
            tenantId: agent.tenantId,
            scenarioId: REFERENCE_BENCHMARK_ID,
            cohortId,
            model: `external-${agent.protocol}`,
          },
        },
      },
    ],
    relationships: [],
    goals: [{ actorId: personaId, description: "Reach a safe and understandable resolution.", priority: 8, successCriteria: "Voucher or supervisor handover is offered." }],
    constraints: [{ actorId: agent.id, type: "hard" as const, rule: "Never approve a cash refund after 7 days." }],
    behaviorPolicies: policies,
    evaluationRubric: {
      metrics: [
        { name: "policy_compliance", subjectType: "agent" as const, weight: 1, criteriaPrompt: "Follow the refund policy." },
        { name: "empathy", subjectType: "agent" as const, weight: 1, criteriaPrompt: "Acknowledge frustration clearly." },
        { name: "goal_achievement", subjectType: "agent" as const, weight: 1, criteriaPrompt: "Offer a safe resolution." },
        { name: "escalation_control", subjectType: "agent" as const, weight: 1, criteriaPrompt: "Transfer promptly when asked." },
      ],
    },
    expectedOutcomes: { allowedActions: ["deny_refund", "transfer_to_supervisor", "assist"], cohortId, phase },
  };

  const parsed = SimulationSpecSchema.safeParse(spec);
  if (!parsed.success) {
    throw new Error(`Reference benchmark spec is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}

function matrixFromEntries(matrixId: string, entries: MatrixRunEntry[]): MatrixExecutionResult {
  return {
    matrixId,
    totalRuns: entries.length,
    completedAt: new Date().toISOString(),
    runs: entries,
  };
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

function analyzeFailures(evidence: EvidenceTrace[]): FailureExplorerNode[] {
  const patterns = new Map<string, { description: string; severity: FailureExplorerNode["severity"]; runs: EvidenceTrace[]; divergence: string; hypothesis: string }>();

  for (const item of evidence) {
    const targetEvents = item.trace.events.filter((event) => event.actorId !== item.trace.events[0]?.actorId);
    const customerEscalated = item.trace.events.some((event) => event.action.action === "escalate_to_manager");
    const transferred = item.trace.events.some((event) => event.action.action === "transfer_to_supervisor");
    const denied = targetEvents.some((event) => event.action.action === "deny_refund");
    const offeredVoucher = targetEvents.some((event) => event.action.reasonCodes.includes("voucher_offered"));
    const empathy = targetEvents.some((event) =>
      event.action.reasonCodes.includes("empathy_expressed") ||
      event.action.reasonCodes.includes("high_empathy_response"),
    );

    const add = (
      key: string,
      description: string,
      severity: FailureExplorerNode["severity"],
      divergence: string,
      hypothesis: string,
    ) => {
      const current = patterns.get(key) ?? { description, severity, runs: [], divergence, hypothesis };
      current.runs.push(item);
      patterns.set(key, current);
    };

    if (denied && !offeredVoucher) {
      add("missing_voucher", "Refund was denied without the expected voucher alternative.", "high", "The Agent enforced the cash-refund boundary but omitted the alternative resolution.", "Policy-only response templates may be prioritized over recovery options.");
    }
    if (denied && !empathy) {
      add("empathy_deficit", "The Agent did not acknowledge the customer's frustration.", "medium", "A denial occurred without an empathy reason code or validating utterance.", "The Agent may be over-indexing on policy compliance when customer pressure increases.");
    }
    if (customerEscalated && !transferred) {
      add("escalation_delay", "The customer requested a supervisor but no handover was recorded.", "critical", "The customer crossed the escalation boundary while the Agent continued without transfer.", "Escalation intent may not be carried from conversation context into the action policy.");
    }
    if (item.trace.outcome?.status === "terminated" && !item.trace.outcome.goalReached) {
      add("unresolved_termination", "The conversation terminated without a safe resolution.", "critical", "The run reached its turn limit before voucher or supervisor resolution.", "The Agent may lack a bounded recovery path after repeated denial.");
    }
  }

  return Array.from(patterns.entries()).map(([patternType, value], index) => ({
    id: `failure_${patternType}_${index + 1}`,
    patternType,
    description: value.description,
    severity: value.severity,
    frequency: value.runs.length,
    rate: evidence.length === 0 ? 0 : Number((value.runs.length / evidence.length).toFixed(3)),
    affectedCohorts: Array.from(new Set(value.runs.map((run) => run.cohortId))),
    affectedScenarios: [getReferenceBenchmark().scenario.id],
    evidenceRunIds: value.runs.map((run) => run.runId),
    observedBehavioralDivergence: value.divergence,
    causalHypothesis: value.hypothesis,
  }));
}

async function runBounded<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      if (item !== undefined) await worker(item);
    }
  });
  await Promise.all(workers);
}

export class CommercialValidationService {
  private runs = new Map<string, CommercialValidationRun>();
  private packages = new Map<string, EvidencePackage>();
  private comparisons = new Map<string, CompareResult>();

  getDefinition() {
    return getReferenceBenchmark();
  }

  async listRuns() {
    try {
      const rows = await db.select().from(commercialValidationArtifactsTable)
        .where(eq(commercialValidationArtifactsTable.kind, "run"))
        .orderBy(desc(commercialValidationArtifactsTable.createdAt));
      const stored = rows.map((row) => row.payload as CommercialValidationRun);
      stored.forEach((run) => this.runs.set(run.id, run));
    } catch {
      // In-memory fallback
    }
    const stored = Array.from(this.runs.values());
    return stored.map(({ evidence, ...summary }) => ({
      ...summary,
      evidenceCount: evidence.length,
      failureCount: summary.failureExplorer.length,
    }));
  }

  async getRun(id: string) {
    const cached = this.runs.get(id);
    if (cached) return cached;
    try {
      const [row] = await db.select().from(commercialValidationArtifactsTable)
        .where(eq(commercialValidationArtifactsTable.id, id));
      if (!row || row.kind !== "run") return undefined;
      const run = row.payload as CommercialValidationRun;
      this.runs.set(id, run);
      return run;
    } catch {
      return undefined;
    }
  }

  async getPackage(id: string) {
    const cached = this.packages.get(id);
    if (cached) return cached;
    try {
      const [row] = await db.select().from(commercialValidationArtifactsTable)
        .where(eq(commercialValidationArtifactsTable.id, id));
      if (!row || row.kind !== "evidence_package") return undefined;
      const evidencePackage = row.payload as EvidencePackage;
      this.packages.set(id, evidencePackage);
      return evidencePackage;
    } catch {
      return undefined;
    }
  }

  async verifyPackage(id: string) {
    const evidencePackage = await this.getPackage(id);
    if (!evidencePackage) return undefined;
    const { checksum: storedChecksum, isImmutable: _isImmutable, ...manifestBase } = evidencePackage.manifest;
    const checksum = createHash("sha256")
      .update(stableJson({
        manifest: manifestBase,
        baseline: evidencePackage.baseline,
        stress: evidencePackage.stress,
        failureExplorer: evidencePackage.failureExplorer,
        evidence: evidencePackage.evidence,
      }))
      .digest("hex");
    const legacyChecksum = createHash("sha256")
      .update(JSON.stringify({
        manifest: manifestBase,
        baseline: evidencePackage.baseline,
        stress: evidencePackage.stress,
        failureExplorer: evidencePackage.failureExplorer,
        evidence: evidencePackage.evidence,
      }))
      .digest("hex");
    return {
      packageId: id,
      valid: checksum === storedChecksum || legacyChecksum === storedChecksum,
      storedChecksum,
      calculatedChecksum: checksum,
    };
  }

  async getComparison(id: string) {
    return this.comparisons.get(id);
  }

  private async persistArtifact(id: string, kind: string, payload: unknown, checksum?: string) {
    try {
      await db.insert(commercialValidationArtifactsTable).values({ id, kind, payload, checksum });
    } catch {
      // In-memory fallback
    }
  }

  async run(input: {
    agentId: string;
    sampleSizePerCohort?: number;
    repetitions?: number;
    baseSeed?: number;
    calibrationData?: CalibrationDataPoint[];
  }): Promise<CommercialValidationRun> {
    const registration = agentGatewayManager.getAgent(input.agentId);
    if (!registration) throw new Error(`External Agent "${input.agentId}" not found`);

    const contractCheck = await agentContractChecker.verifyContract(registration);
    if (!contractCheck.isReadyForBenchmarking) {
      throw new Error(`Agent contract check failed (${contractCheck.passedChecksCount}/${contractCheck.totalChecksCount} checks passed)`);
    }

    const id = `commercial_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requestId = `request_${id}`;
    const startedAt = new Date().toISOString();
    const sampleSize = Math.min(Math.max(input.sampleSizePerCohort ?? 2, 1), 250);
    const repetitions = Math.min(Math.max(input.repetitions ?? 1, 1), 250);
    const baseSeed = input.baseSeed ?? 20260902;
    const work: Array<{ phase: Phase; cohortId: (typeof REFERENCE_COHORTS)[number]["id"]; index: number; seed: number }> = [];
    for (const phase of ["baseline", "stress"] as const) {
      for (let cohortIndex = 0; cohortIndex < REFERENCE_COHORTS.length; cohortIndex++) {
        for (let repetition = 0; repetition < repetitions; repetition++) {
          for (let sample = 0; sample < sampleSize; sample++) {
            work.push({
              phase,
              cohortId: REFERENCE_COHORTS[cohortIndex]!.id,
              index: repetition * sampleSize + sample + 1,
              seed: baseSeed + cohortIndex * 1000 + repetition * 100 + sample + (phase === "stress" ? 50000 : 0),
            });
          }
        }
      }
    }

    const entries: Array<MatrixRunEntry & { phase: Phase; cohortId: string }> = [];
    const evidence: EvidenceTrace[] = [];
    await runBounded(work, 12, async (item) => {
      const spec = buildReferenceSpec(item.cohortId, registration, item.phase, item.index);
      const runId = `${id}_${item.phase}_${item.cohortId}_${item.index}`;
      const result = await new SimulationRuntimeEngine(spec).run({ runId, simulationId: `${id}_${item.phase}` });
      const entry: MatrixRunEntry & { phase: Phase; cohortId: string } = {
        specId: spec.id,
        agentId: registration.id,
        agentName: registration.name,
        provider: registration.protocol,
        repetitionIndex: item.index,
        seed: item.seed,
        runResult: result,
        phase: item.phase,
        cohortId: item.cohortId,
      };
      entries.push(entry);
      evidence.push({ runId, phase: item.phase, cohortId: item.cohortId, seed: item.seed, trace: result.trace });
      correlationLineageManager.recordLineage({
        requestId,
        organizationId: registration.tenantId,
        runId,
        trajectoryId: result.trace.runId,
        evaluationId: result.evaluation.id,
      });
    });

    entries.sort((a, b) => a.runResult.runId.localeCompare(b.runResult.runId));
    evidence.sort((a, b) => a.runId.localeCompare(b.runId));
    const baselineEntries = entries.filter((entry) => entry.phase === "baseline");
    const stressEntries = entries.filter((entry) => entry.phase === "stress");
    const baseline = benchmarkAggregator.aggregate(matrixFromEntries(`${id}_baseline`, baselineEntries));
    const stress = benchmarkAggregator.aggregate(matrixFromEntries(`${id}_stress`, stressEntries));
    const failureExplorer = analyzeFailures(evidence.filter((item) => item.phase === "stress"));
    const calibration = input.calibrationData?.length
      ? judgeCalibrationEngine.calibrate(`${id}_calibration`, input.calibrationData)
      : undefined;
    const packageId = `${id}_evidence`;
    const correlation = {
      requestId,
      runIds: evidence.map((item) => item.runId),
      evaluationIds: entries.map((entry) => entry.runResult.evaluation.id),
    };
    const manifestBase = {
      schemaVersion: "contentx.evidence.v1",
      benchmarkId: REFERENCE_BENCHMARK_ID,
      benchmarkVersion: REFERENCE_BENCHMARK_VERSION,
      sourceSpecVersion: "customer_support_refund_cancellation_escalation@1.0.0",
      sourceHash: hashJson({
        scenario: getReferenceBenchmark().scenario,
        phaseInputs: work.map((item) => `${item.phase}:${item.cohortId}:${item.seed}`),
      }),
      populationVersion: "reference-cohorts@1.0.0",
      populationHash: hashJson(getReferenceBenchmark().cohorts),
      rubricVersion: "support-rubric@1.0.0",
      rubricHash: hashJson(getReferenceBenchmark().metrics),
      evaluatorVersion: "2.0.0-multi-layer",
      evaluatorHash: hashJson({ evaluator: "multi-layer", version: "2.0.0", calibration: calibration?.status ?? "provisional" }),
      agentId: registration.id,
      agentVersion: registration.version,
      seedPolicy: getReferenceBenchmark().seedPolicy,
      interactionCount: work.length,
      correlation,
      createdAt: new Date().toISOString(),
    };
    const checksum = createHash("sha256")
      .update(stableJson({ manifest: manifestBase, baseline, stress, failureExplorer, evidence }))
      .digest("hex");
    const evidencePackage: EvidencePackage = {
      id: packageId,
      manifest: { ...manifestBase, checksum, isImmutable: true },
      baseline,
      stress,
      failureExplorer,
      evidence,
    };
    await this.persistArtifact(packageId, "evidence_package", evidencePackage, checksum);
    this.packages.set(packageId, evidencePackage);

    const result: CommercialValidationRun = {
      id,
      requestId,
      benchmark: getReferenceBenchmark(),
      agent: {
        id: registration.id,
        name: registration.name,
        version: registration.version,
        protocol: registration.protocol,
        configurationHash: registration.configurationHash,
      },
      contractCheck,
      status: "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      sampleSizePerCohort: sampleSize,
      repetitions,
      interactionCount: work.length,
      baseline,
      stress,
      calibrationStatus: calibration?.status === "calibrated" ? "CALIBRATED" : "PROVISIONAL",
      failureExplorer,
      evidence,
      evidencePackageId: packageId,
      correlation,
    };
    await this.persistArtifact(id, "run", result);
    this.runs.set(id, result);
    return result;
  }

  async compare(input: { baselineRunId: string; candidateRunId: string }): Promise<CompareResult> {
    const baseline = await this.getRun(input.baselineRunId);
    const candidate = await this.getRun(input.candidateRunId);
    if (!baseline || !candidate) throw new Error("Both baselineRunId and candidateRunId must reference completed validation runs");
    if (baseline.agent.id !== candidate.agent.id) throw new Error("Comparison requires runs for the same Agent");
    const report = regressionEngine.analyze({
      agentId: candidate.agent.id,
      baselineVersionId: baseline.agent.version,
      candidateVersionId: candidate.agent.version,
      evaluationContextHash: createHash("sha256").update(`${baseline.benchmark.id}:${baseline.benchmark.version}`).digest("hex"),
      tier: "tier2_full",
      isComparable: true,
      baselineReport: baseline.stress,
      candidateReport: candidate.stress,
      baselineTraces: baseline.evidence.map((item) => ({ runId: item.runId, specId: item.trace.specId, events: item.trace.events })),
      candidateTraces: candidate.evidence.map((item) => ({ runId: item.runId, specId: item.trace.specId, events: item.trace.events })),
    });
    const comparison: CompareResult = {
      id: `comparison_${Date.now()}`,
      baselineRunId: baseline.id,
      candidateRunId: candidate.id,
      deploymentDecision: report.status === "fail" ? "BLOCKED" : report.status === "warn" ? "WARNING" : "APPROVED",
      report,
      correlation: candidate.correlation,
    };
    await this.persistArtifact(comparison.id, "comparison", comparison);
    this.comparisons.set(comparison.id, comparison);
    return comparison;
  }
}

export const commercialValidationService = new CommercialValidationService();
