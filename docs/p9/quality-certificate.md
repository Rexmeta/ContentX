# Quality Certificate Specification

## 1. Certificate Types & Purpose
RoleplayX supports two distinct certificate types:
1. **`Validation Certificate`**: Issued for deterministic testing fixtures (e.g. ApexPay) in non-production validation workflows.
2. **`AI Agent Quality Certificate`**: Issued for third-party commercial customer pilots upon completion of closed-loop quality verification.

> **Certification Statement**:  
> *"The evaluated AI agent version passed the defined benchmark, evaluation, regression, and deployment-gate criteria under the documented test configuration."*

## 2. Certification Scope Data Model
Every certificate contains a complete, reproducible `certificationScope`:
```typescript
interface CertificationScope {
  agentVersion: string;
  benchmarkVersion: string;
  populationVersion: string;
  rubricVersion: string;
  evaluatorVersion: string;
  calibrationDataset: string;
  regressionCorpus: string;
  environment: string;
  evaluationContextHash: string;
  evidencePackageId: string;
  validityPeriod?: string;
}
```

## 3. Certificate Data Model
```typescript
interface QualityCertificate {
  certificateId: string;
  certificateType: "validation_certificate" | "customer_quality_certificate";
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
  certificationScope: CertificationScope;
  limitations: string[];
  certificateStatus: "DRAFT" | "ISSUED" | "REVOKED";
}
```
