import { z } from "zod";
import { ContractCheckItemSchema } from "./agentProtocol";

export const CustomerAgentOwnershipTypeSchema = z.enum([
  "internal",
  "validation_fixture",
  "third_party_customer",
]);
export type CustomerAgentOwnershipType = z.infer<typeof CustomerAgentOwnershipTypeSchema>;

export const CustomerAgentAttestationSchema = z.object({
  customerAgentId: z.string(),
  organizationId: z.string(),
  customerName: z.string().optional(),
  attestationType: z.enum(["customer_declared", "operator_verified", "contract_verified"]),
  declaredBy: z.string(),
  declaredAt: z.string().default(() => new Date().toISOString()),
  evidenceReference: z.string().optional(),
  productionStatus: z.enum(["non_production", "staging", "production"]).default("non_production"),
  independenceStatus: z.enum(["unverified", "verified"]).default("unverified"),
  notes: z.string().optional(),
});
export type CustomerAgentAttestation = z.infer<typeof CustomerAgentAttestationSchema>;

export const P9Gate1ResultSchema = z.object({
  status: z.enum(["PASS", "FAIL", "BLOCKED"]),
  agentId: z.string(),
  ownershipType: CustomerAgentOwnershipTypeSchema,
  checks: z.array(ContractCheckItemSchema),
  independenceStatus: z.enum(["verified", "unverified"]),
  customerReadiness: z.enum(["NOT_READY", "READY_FOR_CUSTOMER", "CUSTOMER_VALIDATED"]).default("READY_FOR_CUSTOMER"),
  evidenceId: z.string(),
  contextHash: z.string(),
  timestamp: z.string().default(() => new Date().toISOString()),
});
export type P9Gate1Result = z.infer<typeof P9Gate1ResultSchema>;

export const HumanGoldAnnotationSchema = z.object({
  annotationId: z.string(),
  trajectoryId: z.string(),
  scenarioId: z.string(),
  cohortId: z.string(),
  rubricVersion: z.string(),
  dimensionScores: z.record(z.number()),
  overallScore: z.number(),
  expertId: z.string(),
  annotationVersion: z.string().default("1.0.0"),
  annotationTimestamp: z.string().default(() => new Date().toISOString()),
});
export type HumanGoldAnnotation = z.infer<typeof HumanGoldAnnotationSchema>;

export const HumanGoldSetSchema = z.object({
  goldSetId: z.string(),
  organizationId: z.string(),
  name: z.string(),
  rubricVersion: z.string(),
  annotations: z.array(HumanGoldAnnotationSchema),
  expertCount: z.number().int().positive(),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type HumanGoldSet = z.infer<typeof HumanGoldSetSchema>;

export const CalibrationStatusSchema = z.enum(["PROVISIONAL", "CALIBRATED", "FAILED"]);
export type CalibrationStatus = z.infer<typeof CalibrationStatusSchema>;

export const CalibrationResultSchema = z.object({
  calibrationRunId: z.string(),
  goldSetId: z.string(),
  evaluatorVersion: z.string(),
  rubricVersion: z.string(),
  sampleSize: z.number().int(),
  expertCount: z.number().int(),
  pearsonR: z.number(),
  cohensKappa: z.number(), // LLM Judge vs Human Consensus binary pass/fail agreement
  fleissKappa: z.number().optional(),
  mae: z.number(),
  bias: z.number(),
  calibrationStatus: CalibrationStatusSchema,
  criteriaMet: z.boolean(),
  calculatedAt: z.string().default(() => new Date().toISOString()),
  limitations: z.array(z.string()).default([]),
});
export type CalibrationResult = z.infer<typeof CalibrationResultSchema>;

export const RegressionCaseIdSchema = z.enum([
  "R01", // Boundary Violation
  "R02", // Escalation Delay
  "R03", // Tool Misuse
  "R04", // Policy Bypass
  "R05", // Empathy Deficit
  "R06", // Hallucination
  "R07", // Context Loss
  "R08", // Unauthorized Concession
]);
export type RegressionCaseId = z.infer<typeof RegressionCaseIdSchema>;

export const RegressionCaseSchema = z.object({
  caseId: z.string(),
  regressionId: RegressionCaseIdSchema,
  name: z.string(),
  category: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  scenarioId: z.string(),
  cohortId: z.string(),
  expectedBehavior: z.string(),
  forbiddenBehavior: z.string().optional(),
  rubricDimension: z.string(),
  expectedOutcome: z.enum(["pass", "fail"]),
  isKnownGood: z.boolean(),
  evidenceRequirements: z.array(z.string()).default([]),
  version: z.string().default("1.0.0"),
});
export type RegressionCase = z.infer<typeof RegressionCaseSchema>;

export const ConfusionMatrixSchema = z.object({
  TP: z.number().int().nonnegative(),
  TN: z.number().int().nonnegative(),
  FP: z.number().int().nonnegative(),
  FN: z.number().int().nonnegative(),
  precision: z.number(),
  recall: z.number(),
  falsePositiveRate: z.number(),
  falseNegativeRate: z.number(),
  accuracy: z.number(),
  totalEvaluated: z.number().int().nonnegative(),
});
export type ConfusionMatrix = z.infer<typeof ConfusionMatrixSchema>;

export const CustomerFailureReviewSchema = z.object({
  failureId: z.string(),
  customerDecision: z.enum(["confirmed", "rejected", "uncertain"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  customerComment: z.string().optional(),
  reviewedAt: z.string().default(() => new Date().toISOString()),
  reviewerId: z.string(),
});
export type CustomerFailureReview = z.infer<typeof CustomerFailureReviewSchema>;

export const CustomerPilotSchema = z.object({
  pilotId: z.string(),
  organizationId: z.string(),
  agentId: z.string(),
  environment: z.enum(["staging", "production", "sandbox", "non_production"]).default("staging"),
  startAt: z.string().default(() => new Date().toISOString()),
  endAt: z.string().optional(),
  benchmarkVersion: z.string(),
  rubricVersion: z.string(),
  evaluatorVersion: z.string(),
  contextHash: z.string(),
  baselineRunId: z.string(),
  candidateRunId: z.string().optional(),
  status: z.enum(["planned", "running", "completed", "blocked"]).default("planned"),
  customerReviewStatus: z.enum(["pending", "accepted", "rejected"]).default("pending"),
  evidenceId: z.string().optional(),
  reviews: z.array(CustomerFailureReviewSchema).default([]),
});
export type CustomerPilot = z.infer<typeof CustomerPilotSchema>;

export const CertificationScopeSchema = z.object({
  agentVersion: z.string(),
  benchmarkVersion: z.string(),
  populationVersion: z.string(),
  rubricVersion: z.string(),
  evaluatorVersion: z.string(),
  calibrationDataset: z.string(),
  regressionCorpus: z.string(),
  environment: z.string(),
  evaluationContextHash: z.string(),
  evidencePackageId: z.string(),
  validityPeriod: z.string().optional(),
});
export type CertificationScope = z.infer<typeof CertificationScopeSchema>;

export const QualityCertificateTypeSchema = z.enum([
  "validation_certificate", // Issued for testing fixtures / non-production validation
  "customer_quality_certificate", // Issued for verified third-party customer pilots
]);
export type QualityCertificateType = z.infer<typeof QualityCertificateTypeSchema>;

export const QualityCertificateStatusSchema = z.enum(["DRAFT", "ISSUED", "REVOKED"]);
export type QualityCertificateStatus = z.infer<typeof QualityCertificateStatusSchema>;

export const QualityCertificateSchema = z.object({
  certificateId: z.string(),
  certificateType: QualityCertificateTypeSchema.default("validation_certificate"),
  agentId: z.string(),
  agentVersion: z.string(),
  organizationId: z.string(),
  benchmarkId: z.string(),
  benchmarkVersion: z.string(),
  populationVersion: z.string(),
  rubricVersion: z.string(),
  evaluatorVersion: z.string(),
  calibrationStatus: CalibrationStatusSchema,
  contextHash: z.string(),
  gateDecision: z.enum(["APPROVED", "WARNING", "BLOCKED"]),
  issuedAt: z.string().default(() => new Date().toISOString()),
  validUntil: z.string().optional(),
  evidencePackageId: z.string(),
  evidenceRootHash: z.string(),
  certificationScope: CertificationScopeSchema,
  limitations: z.array(z.string()).default([]),
  certificateStatus: QualityCertificateStatusSchema.default("DRAFT"),
});
export type QualityCertificate = z.infer<typeof QualityCertificateSchema>;

export const P9OverallStatusSchema = z.enum([
  "P9_NOT_STARTED",
  "P9_IN_PROGRESS",
  "P9_PARTIAL",
  "P9_READY_FOR_CUSTOMER",
  "P9_VALIDATED",
  "P9_BLOCKED",
]);
export type P9OverallStatus = z.infer<typeof P9OverallStatusSchema>;

export const P9ValidationResultSchema = z.object({
  overallStatus: P9OverallStatusSchema,
  gate1: z.object({ status: z.enum(["PASS", "FAIL", "BLOCKED"]), summary: z.string() }),
  gate2: z.object({ status: z.enum(["PASS", "FAIL", "BLOCKED"]), summary: z.string() }),
  gate3: z.object({ status: z.enum(["PASS", "FAIL", "BLOCKED"]), summary: z.string() }),
  gate4: z.object({ status: z.enum(["PASS", "FAIL", "BLOCKED"]), summary: z.string() }),
  calibrationStatus: CalibrationStatusSchema,
  regressionStatus: z.enum(["PASS", "FAIL", "BLOCKED"]),
  customerPilotStatus: z.enum(["NOT_STARTED", "RUNNING", "COMPLETED"]),
  evidencePackageId: z.string().optional(),
  certificateId: z.string().optional(),
  blockingReasons: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  generatedAt: z.string().default(() => new Date().toISOString()),
});
export type P9ValidationResult = z.infer<typeof P9ValidationResultSchema>;
