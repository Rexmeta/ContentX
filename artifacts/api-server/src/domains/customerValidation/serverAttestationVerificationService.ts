import type { ServerVerifiedCustomerAttestation } from "@workspace/simulation-contract";

export interface SubmitAttestationInput {
  organizationId: string;
  customerLegalName: string;
  ownershipType: "validation_fixture" | "third_party_customer";
  operatorIdentity: {
    operatorId: string;
    role: string;
    verified: boolean;
  };
  contractReference?: string;
  productionStatus?: "non_production" | "staging" | "production";
  verificationMethod: "contract" | "customer_operator" | "signed_attestation" | "combined";
  evidenceRef?: string;
}

export class ServerAttestationVerificationService {
  private attestations = new Map<string, ServerVerifiedCustomerAttestation>();

  /**
   * Server-side attestation verification.
   * independenceStatus is generated exclusively by server logic.
   */
  verifyAndRecordAttestation(input: SubmitAttestationInput): ServerVerifiedCustomerAttestation {
    const attestationId = `attest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const verifiedAt = new Date().toISOString();

    let independenceStatus: "unverified" | "verified" = "unverified";
    let productionStatus = input.productionStatus ?? "staging";

    if (input.ownershipType === "third_party_customer") {
      const hasVerifiedOperator = input.operatorIdentity.verified;
      const hasContractOrSignedProof =
        input.verificationMethod === "contract" ||
        input.verificationMethod === "signed_attestation" ||
        input.verificationMethod === "combined";

      if (hasVerifiedOperator && (hasContractOrSignedProof || Boolean(input.contractReference))) {
        independenceStatus = "verified";
      } else {
        independenceStatus = "unverified";
      }
    } else {
      // validation_fixture is strictly unverified non-production
      independenceStatus = "unverified";
      productionStatus = "non_production";
    }

    const record: ServerVerifiedCustomerAttestation = {
      attestationId,
      organizationId: input.organizationId,
      customerLegalName: input.customerLegalName,
      ownershipType: input.ownershipType,
      operatorIdentity: input.operatorIdentity,
      contractReference: input.contractReference,
      productionStatus,
      independenceStatus,
      verificationMethod: input.verificationMethod,
      verifiedAt,
      evidenceRef: input.evidenceRef ?? `evid_attest_${attestationId}`,
    };

    this.attestations.set(attestationId, record);
    return record;
  }

  getAttestation(attestationId: string): ServerVerifiedCustomerAttestation | undefined {
    return this.attestations.get(attestationId);
  }
}

export const serverAttestationVerificationService = new ServerAttestationVerificationService();
