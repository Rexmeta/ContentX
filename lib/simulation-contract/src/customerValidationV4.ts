import { z } from "zod";
import { ContractCheckItemSchema } from "./agentProtocol";
import { ConfusionMatrixSchema } from "./productionEvidence";

export const ValidationModeSchema = z.enum([
  "validation_fixture",   // Standalone test fixture (e.g. ApexPay). Produces validation_certificate only.
  "customer_validation", // Genuine external enterprise client backed by verified operator/contract attestation.
]);
export type ValidationMode = z.infer<typeof ValidationModeSchema>;

export const P91OutcomeSchema = z.enum([
  "IN_PROGRESS",
  "BLOCKED",
  "READY_FOR_CUSTOMER",   // Terminal outcome for validation_fixture (Validation Certificate ISSUED)
  "CUSTOMER_VALIDATED",  // Terminal outcome for customer_validation (Customer Quality Certificate ISSUED)
]);
export type P91Outcome = z.infer<typeof P91OutcomeSchema>;

export const ProofLevelSchema = z.enum([
  "infrastructure_proof", // P0~P8
  "external_agent_proof", // P9
  "customer_validation",  // P9.1 (Staging/Controlled Customer Pilot Proof)
  "production_observed", // Future Live Production Traffic Telemetry
]);
export type ProofLevel = z.infer<typeof ProofLevelSchema>;

export const P91LifecycleStateSchema = z.enum([
  "DRAFT",
  "CUSTOMER_AGENT_CONNECTED",
  "ATTESTATION_VERIFIED",
  "GOLD_SET_INGESTED",
  "CALIBRATION_EVALUATED",
  "PILOT_BENCHMARK_EXECUTED",
  "ADAPTIVE_STRESS_AMPLIFIED",
  "CUSTOMER_FAILURE_REVIEWED",
  "HARDENED_RETEST_PASSED",
  "REGRESSION_GATE_APPROVED",
  "EVIDENCE_V4_SEALED",
  "CERTIFICATE_ISSUABLE",
  "P9_1_VALIDATED",
]);
export type P91LifecycleState = z.infer<typeof P91LifecycleStateSchema>;

export const CustomerStagingAgentProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  tenantId: z.string(),
  protocol: z.enum(["http", "websocket", "custom"]),
  endpointUrl: z.string().url(),
  authConfig: z.object({
    type: z.enum(["hmac", "bearer", "oauth2"]),
    secretRef: z.string(), // Environment variable or vault secret reference, NEVER raw secret
    headerName: z.string().default("X-RoleplayX-Signature"),
  }),
  configurationHash: z.string(),
  environment: z.enum(["staging", "production", "sandbox", "non_production"]).default("staging"),
  capabilities: z.object({
    supportsToolCalling: z.boolean(),
    supportsMultiTurn: z.boolean(),
    supportsStreaming: z.boolean().default(false),
    maxContextTokens: z.number().int().default(8192),
    supportedProtocols: z.array(z.string()).default(["http"]),
  }),
  registeredAt: z.string().default(() => new Date().toISOString()),
});
export type CustomerStagingAgentProfile = z.infer<typeof CustomerStagingAgentProfileSchema>;

export const ServerVerifiedCustomerAttestationSchema = z.object({
  attestationId: z.string(),
  organizationId: z.string(),
  customerLegalName: z.string(),
  ownershipType: z.enum(["validation_fixture", "third_party_customer"]),
  operatorIdentity: z.object({
    operatorId: z.string(),
    role: z.string(),
    verified: z.boolean(),
  }),
  contractReference: z.string().optional(),
  productionStatus: z.enum(["non_production", "staging", "production"]),
  independenceStatus: z.enum(["unverified", "verified"]), // Server-evaluated only
  verificationMethod: z.enum(["contract", "customer_operator", "signed_attestation", "combined"]),
  verifiedAt: z.string().optional(),
  evidenceRef: z.string().optional(),
});
export type ServerVerifiedCustomerAttestation = z.infer<typeof ServerVerifiedCustomerAttestationSchema>;

export const TrajectoryExpertAnnotationSchema = z.object({
  annotationId: z.string(),
  trajectoryId: z.string(),
  expertId: z.string(),
  dimensionScores: z.record(z.number()),
  overallScore: z.number(),
  rationale: z.string().optional(),
  annotatedAt: z.string().default(() => new Date().toISOString()),
});
export type TrajectoryExpertAnnotation = z.infer<typeof TrajectoryExpertAnnotationSchema>;

export const ExpandedHumanGoldSetSchema = z.object({
  goldSetId: z.string(),
  organizationId: z.string(),
  name: z.string(),
  rubricVersion: z.string(),
  distinctTrajectoryCount: z.number().int().nonnegative(), // N >= 50 for customer validation
  expertCount: z.number().int().positive(), // >= 3
  annotations: z.array(TrajectoryExpertAnnotationSchema),
  multiRaterCoverage: z.number().min(0).max(1), // % of trajectories with >= 2 independent expert ratings (>= 0.90)
  consensusCoverage: z.number().min(0).max(1),  // % of multi-rated trajectories with consensus score (>= 0.90)
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type ExpandedHumanGoldSet = z.infer<typeof ExpandedHumanGoldSetSchema>;

export const CalibrationDriftReportSchema = z.object({
  driftReportId: z.string(),
  baselineGoldSetId: z.string(),
  currentGoldSetId: z.string(),
  baselinePearsonR: z.number(),
  currentPearsonR: z.number(),
  deltaPearsonR: z.number(),
  baselineMAE: z.number(),
  currentMAE: z.number(),
  deltaMAE: z.number(),
  driftStatus: z.enum(["STABLE", "DRIFT_WARNING", "DRIFT_CRITICAL"]),
  calculatedAt: z.string().default(() => new Date().toISOString()),
});
export type CalibrationDriftReport = z.infer<typeof CalibrationDriftReportSchema>;

export const PilotRetestResultSchema = z.object({
  retestId: z.string(),
  pilotId: z.string(),
  targetFailureId: z.string(),
  targetMetricId: z.string(),
  baselineFailureRate: z.number(),
  retestFailureRate: z.number(),
  targetRecurrenceRate: z.number(), // Exactly 0.0 on verified target fix
  newFailureRate: z.number(),
  overallFailureRate: z.number(),
  passed: z.boolean(),
  retestedAt: z.string().default(() => new Date().toISOString()),
});
export type PilotRetestResult = z.infer<typeof PilotRetestResultSchema>;

export const SegregatedTelemetrySchema = z.object({
  // 1. RoleplayX Platform Engine Performance
  platformTelemetry: z.object({
    orchestrationLatencyMs: z.object({ p50: z.number(), p95: z.number(), p99: z.number() }),
    evaluationLatencyMs: z.object({ p50: z.number(), p95: z.number(), p99: z.number() }),
    throughputSimulationsPerSec: z.number(),
    platformCostUSD: z.number(),
  }),

  // 2. External Customer Agent Performance
  agentTelemetry: z.object({
    inferenceLatencyMs: z.object({ p50: z.number(), p95: z.number(), p99: z.number() }),
    networkTransportLatencyMs: z.object({ p50: z.number(), p95: z.number(), p99: z.number() }),
    toolExecutionLatencyMs: z.object({ p50: z.number(), p95: z.number(), p99: z.number() }),
    timeoutRate: z.number(),
    httpErrorRate: z.number(),
  }),

  // 3. Evaluator Quality & Cost
  evaluatorQuality: z.object({
    goldSetSampleSize: z.number(),
    expertCount: z.number(),
    multiRaterCoverage: z.number(),
    consensusCoverage: z.number(),
    pearsonR: z.number(),
    cohensKappaJudgeVsHuman: z.number(),
    mae: z.number(),
    bias: z.number(),
    judgeLatencyMs: z.object({ p50: z.number(), p95: z.number(), p99: z.number() }),
    judgeCostUSD: z.number(),
    calibrationStatus: z.enum(["CALIBRATED", "PROVISIONAL", "FAILED"]),
    confusionMatrix: ConfusionMatrixSchema,
  }),

  // 4. Client Business Value & Defect Remediation
  customerBusinessValue: z.object({
    failuresDiscovered: z.number(),
    failuresCustomerConfirmed: z.number(),
    confirmationRate: z.number(),
    failuresRemediatedInHardenedVersion: z.number(),
    targetFailureRecurrenceRateOnRetest: z.number(),
  }),
});
export type SegregatedTelemetryReport = z.infer<typeof SegregatedTelemetrySchema>;

export const EvidencePackageV4Schema = z.object({
  packageId: z.string(),
  manifest: z.object({
    schemaVersion: z.literal("contentx.evidence.v4"),
    packageId: z.string(),
    generatedAt: z.string(),
    validationMode: ValidationModeSchema,
    outcome: P91OutcomeSchema,
    proofLevel: ProofLevelSchema,
    lineageChain: z.object({
      customerLegalName: z.string(),
      agentId: z.string(),
      agentVersion: z.string(),
      organizationId: z.string(),
      specId: z.string(),
      goldSetId: z.string(),
      calibrationStatus: z.string(),
      retestPassed: z.boolean(),
      gateDecision: z.string(),
      certificateId: z.string(),
    }),
    rootChecksum: z.string(),
  }),
  artifacts: z.record(z.unknown()),
  sha256Sums: z.record(z.string()),
});
export type EvidencePackageV4 = z.infer<typeof EvidencePackageV4Schema>;

export const P91ValidationSummarySchema = z.object({
  currentState: P91LifecycleStateSchema,
  outcome: P91OutcomeSchema,
  validationMode: ValidationModeSchema,
  proofLevel: ProofLevelSchema,
  isCustomerValidated: z.boolean(),
  stateTransitions: z.array(
    z.object({
      state: P91LifecycleStateSchema,
      enteredAt: z.string(),
      passed: z.boolean(),
      notes: z.string().optional(),
    })
  ),
  telemetry: SegregatedTelemetrySchema,
  evidencePackageId: z.string().optional(),
  certificateId: z.string().optional(),
  blockingReasons: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  generatedAt: z.string().default(() => new Date().toISOString()),
});
export type P91ValidationSummary = z.infer<typeof P91ValidationSummarySchema>;

