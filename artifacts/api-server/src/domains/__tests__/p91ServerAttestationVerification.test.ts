import { describe, it, expect } from "vitest";
import { serverAttestationVerificationService } from "../customerValidation/serverAttestationVerificationService";

describe("P9.1 Server-Side Attestation Verification", () => {
  it("generates verified independence status for third_party_customer with valid operator and contract", () => {
    const attestation = serverAttestationVerificationService.verifyAndRecordAttestation({
      organizationId: "org_zenith",
      customerLegalName: "Zenith Financial Technologies Inc.",
      ownershipType: "third_party_customer",
      operatorIdentity: {
        operatorId: "usr_qa_director_zenith",
        role: "Director of Quality Engineering",
        verified: true,
      },
      contractReference: "MSA-ZENITH-ROLEPLAYX-2026-09",
      productionStatus: "staging",
      verificationMethod: "contract",
    });

    expect(attestation.attestationId).toMatch(/^attest_/);
    expect(attestation.independenceStatus).toBe("verified");
    expect(attestation.productionStatus).toBe("staging");
    expect(attestation.customerLegalName).toBe("Zenith Financial Technologies Inc.");
  });

  it("forces unverified and non_production for validation_fixture", () => {
    const attestation = serverAttestationVerificationService.verifyAndRecordAttestation({
      organizationId: "org_test",
      customerLegalName: "ApexPay Validation Fixture",
      ownershipType: "validation_fixture",
      operatorIdentity: {
        operatorId: "usr_tester",
        role: "Test Engineer",
        verified: true,
      },
      verificationMethod: "contract",
    });

    expect(attestation.independenceStatus).toBe("unverified");
    expect(attestation.productionStatus).toBe("non_production");
  });

  it("assigns unverified status if third_party_customer lacks verified operator", () => {
    const attestation = serverAttestationVerificationService.verifyAndRecordAttestation({
      organizationId: "org_unverified",
      customerLegalName: "Unverified Client Corp",
      ownershipType: "third_party_customer",
      operatorIdentity: {
        operatorId: "usr_unknown",
        role: "Anonymous",
        verified: false,
      },
      verificationMethod: "customer_operator",
    });

    expect(attestation.independenceStatus).toBe("unverified");
  });
});
