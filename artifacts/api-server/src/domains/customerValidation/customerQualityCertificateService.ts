import type {
  QualityCertificate,
  QualityCertificateType,
  CalibrationStatus,
  CertificationScope,
} from "@workspace/simulation-contract";

export interface IssueP91CertificateInput {
  agentId: string;
  agentVersion: string;
  organizationId: string;
  certificateType: QualityCertificateType;
  benchmarkId: string;
  benchmarkVersion: string;
  populationVersion: string;
  rubricVersion: string;
  evaluatorVersion: string;
  calibrationStatus: CalibrationStatus;
  contextHash: string;
  gateDecision: "APPROVED" | "WARNING" | "BLOCKED";
  evidencePackageId: string;
  evidenceRootHash: string;
  certificationScope: CertificationScope;
  limitations?: string[];
  validityDays?: number;
}

export class CustomerQualityCertificateService {
  private certificates = new Map<string, QualityCertificate>();

  /**
   * Generates formal certificates enforcing certificateType semantics
   */
  issueCertificate(input: IssueP91CertificateInput): QualityCertificate {
    const certificateId = `cert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const issuedAt = new Date().toISOString();
    const validUntil = new Date(Date.now() + (input.validityDays ?? 90) * 24 * 60 * 60 * 1000).toISOString();

    const standardLimitations = [
      "Certification reflects agent performance exclusively under the evaluated simulation benchmark scenarios.",
      "Does not guarantee absolute security or safety against unmodeled zero-day jailbreak vectors.",
      input.certificateType === "validation_certificate"
        ? "Scope: NON_PRODUCTION / VALIDATION FIXTURE evaluation."
        : "Scope: CUSTOMER PILOT verified under multi-expert human gold calibration.",
    ];

    if (input.limitations) {
      standardLimitations.push(...input.limitations);
    }

    let certificateStatus: "DRAFT" | "ISSUED" | "REVOKED" = "DRAFT";
    if (input.gateDecision === "APPROVED") {
      certificateStatus = "ISSUED";
    } else if (input.gateDecision === "BLOCKED") {
      certificateStatus = "REVOKED";
    }

    const certificate: QualityCertificate = {
      certificateId,
      certificateType: input.certificateType,
      agentId: input.agentId,
      agentVersion: input.agentVersion,
      organizationId: input.organizationId,
      benchmarkId: input.benchmarkId,
      benchmarkVersion: input.benchmarkVersion,
      populationVersion: input.populationVersion,
      rubricVersion: input.rubricVersion,
      evaluatorVersion: input.evaluatorVersion,
      calibrationStatus: input.calibrationStatus,
      contextHash: input.contextHash,
      gateDecision: input.gateDecision,
      issuedAt,
      validUntil,
      evidencePackageId: input.evidencePackageId,
      evidenceRootHash: input.evidenceRootHash,
      certificationScope: input.certificationScope,
      limitations: standardLimitations,
      certificateStatus,
    };

    this.certificates.set(certificateId, certificate);
    return certificate;
  }

  getCertificate(certificateId: string): QualityCertificate | undefined {
    return this.certificates.get(certificateId);
  }
}

export const customerQualityCertificateService = new CustomerQualityCertificateService();
