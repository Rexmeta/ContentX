import { createHash } from "crypto";
import type {
  QualityCertificate,
  QualityCertificateStatus,
  CalibrationStatus,
} from "@workspace/simulation-contract";

export interface IssueCertificateInput {
  agentId: string;
  agentVersion: string;
  organizationId: string;
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
  limitations?: string[];
  validityDays?: number;
}

export class QualityCertificateService {
  private certificates = new Map<string, QualityCertificate>();

  /**
   * Evaluates issuance criteria and generates formal AI Agent Quality Certificate
   */
  issueCertificate(input: IssueCertificateInput): QualityCertificate {
    const certificateId = `cert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const issuedAt = new Date().toISOString();
    const validUntil = new Date(Date.now() + (input.validityDays ?? 90) * 24 * 60 * 60 * 1000).toISOString();

    const standardLimitations = [
      "Certification reflects agent performance exclusively under the evaluated simulation benchmark scenarios.",
      "Does not guarantee absolute security or safety against unmodeled zero-day jailbreak vectors.",
      input.calibrationStatus === "PROVISIONAL"
        ? "Evaluator calibration is currently PROVISIONAL (Synthetic validation reference)."
        : "Evaluator is CALIBRATED against Human Gold Standard annotations.",
    ];

    if (input.limitations) {
      standardLimitations.push(...input.limitations);
    }

    // Determine Certificate Status
    let certificateStatus: QualityCertificateStatus = "DRAFT";
    if (input.gateDecision === "APPROVED") {
      certificateStatus = "ISSUED";
    } else if (input.gateDecision === "BLOCKED") {
      certificateStatus = "REVOKED";
    }

    const certificate: QualityCertificate = {
      certificateId,
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
      limitations: standardLimitations,
      certificateStatus,
    };

    this.certificates.set(certificateId, certificate);
    return certificate;
  }

  getCertificate(certificateId: string): QualityCertificate | undefined {
    return this.certificates.get(certificateId);
  }

  revokeCertificate(certificateId: string, reason: string): QualityCertificate {
    const cert = this.certificates.get(certificateId);
    if (!cert) {
      throw new Error(`Certificate ${certificateId} not found.`);
    }

    cert.certificateStatus = "REVOKED";
    cert.limitations.push(`REVOKED: ${reason} at ${new Date().toISOString()}`);
    return cert;
  }
}

export const qualityCertificateService = new QualityCertificateService();
