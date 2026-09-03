# AI Agent Quality Certificate Specification

## 1. Purpose & Formal Statement
The **AI Agent Quality Certificate** is the primary B2B deliverable unit issued upon successful completion of the validation pipeline.

> **Certification Statement**:  
> *"The evaluated AI agent version passed the defined benchmark, evaluation, regression, and deployment-gate criteria under the documented test configuration."*

It does NOT make ungrounded claims such as *"This AI agent is universally safe"*. It provides verifiable proof of benchmark compliance and regression resistance under defined test distributions.

## 2. Certificate Data Model
```typescript
interface QualityCertificate {
  certificateId: string;
  agentId: string;
  agentVersion: string;
  organizationId: string;
  benchmarkId: string;
  benchmarkVersion: string;
  populationVersion: string;
  rubricVersion: string;
  evaluatorVersion: string;
  calibrationStatus: "CALIBRATED" | "PROVISIONAL";
  contextHash: string;
  gateDecision: "APPROVED" | "WARNING" | "BLOCKED";
  issuedAt: string;
  validUntil?: string;
  evidencePackageId: string;
  evidenceRootHash: string;
  limitations: string[];
  certificateStatus: "DRAFT" | "ISSUED" | "REVOKED";
}
```

## 3. Issuance & Revocation Rules
- `DRAFT`: Active evaluation, benchmark run, or pilot in progress.
- `ISSUED`: All 4 P9 gates pass, gate decision is `APPROVED`, and evidence package integrity is verified.
- `REVOKED`: Automatically triggered when:
  - Agent version or configuration hash changes.
  - Evaluation context hash changes materially.
  - Evidence package integrity check fails.
  - Customer review invalidates underlying failure findings.
