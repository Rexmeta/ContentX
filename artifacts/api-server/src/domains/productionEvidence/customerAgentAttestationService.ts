import { createHash } from "crypto";
import type {
  ExternalAgentRegistration,
  CustomerAgentAttestation,
  CustomerAgentOwnershipType,
  P9Gate1Result,
} from "@workspace/simulation-contract";
import { agentGatewayManager } from "../agent/gateway/agentGateway";
import { agentContractChecker } from "../agent/contractChecker";

export interface RegisterCustomerAgentInput {
  agent: ExternalAgentRegistration;
  ownershipType: CustomerAgentOwnershipType;
  attestation?: Omit<CustomerAgentAttestation, "customerAgentId" | "organizationId">;
}

export class CustomerAgentAttestationService {
  private attestations = new Map<string, CustomerAgentAttestation>();
  private ownershipMap = new Map<string, CustomerAgentOwnershipType>();

  /**
   * Registers an external customer agent with mandatory ownership classification and attestation.
   */
  async registerAndVerifyAgent(input: RegisterCustomerAgentInput): Promise<{
    registration: ExternalAgentRegistration;
    attestation: CustomerAgentAttestation;
    gate1Result: P9Gate1Result;
  }> {
    const { agent, ownershipType } = input;
    const organizationId = agent.tenantId || "default";

    // 1. Verify ownership validity (Cannot silently claim third_party_customer without attestation)
    let independenceStatus: "verified" | "unverified" = "unverified";
    if (ownershipType === "third_party_customer") {
      if (input.attestation?.attestationType === "contract_verified" || input.attestation?.attestationType === "operator_verified") {
        independenceStatus = "verified";
      } else {
        independenceStatus = "unverified";
      }
    } else if (ownershipType === "validation_fixture") {
      independenceStatus = "unverified"; // Fixtures are explicitly unverified non-production agents
    }

    const attestation: CustomerAgentAttestation = {
      customerAgentId: agent.id,
      organizationId,
      customerName: input.attestation?.customerName ?? (ownershipType === "third_party_customer" ? "Third-Party Pilot Client" : "Test Fixture"),
      attestationType: input.attestation?.attestationType ?? (ownershipType === "third_party_customer" ? "customer_declared" : "operator_verified"),
      declaredBy: input.attestation?.declaredBy ?? "system_operator",
      declaredAt: new Date().toISOString(),
      evidenceReference: input.attestation?.evidenceReference ?? `evid_attest_${agent.id}`,
      productionStatus: input.attestation?.productionStatus ?? (ownershipType === "third_party_customer" ? "staging" : "non_production"),
      independenceStatus,
      notes: input.attestation?.notes,
    };

    this.attestations.set(agent.id, attestation);
    this.ownershipMap.set(agent.id, ownershipType);

    // 2. Register with Agent Gateway
    agentGatewayManager.registerAgent(agent);

    // 3. Execute 8-Step Preflight Check
    const preflight = await agentContractChecker.verifyContract(agent);

    // 4. Determine Gate #1 Status
    let status: "PASS" | "FAIL" | "BLOCKED" = "PASS";
    if (!preflight.isReadyForBenchmarking) {
      status = "FAIL";
    }

    const evidenceId = `evid_gate1_${agent.id}_${Date.now()}`;
    const contextHash = createHash("sha256")
      .update(JSON.stringify({ agentId: agent.id, version: agent.version, configHash: agent.configurationHash }))
      .digest("hex");

    const customerReadiness =
      ownershipType === "third_party_customer" && independenceStatus === "verified"
        ? "CUSTOMER_VALIDATED"
        : "READY_FOR_CUSTOMER";

    const gate1Result: P9Gate1Result = {
      status,
      agentId: agent.id,
      ownershipType,
      checks: preflight.checks,
      independenceStatus,
      customerReadiness,
      evidenceId,
      contextHash,
      timestamp: new Date().toISOString(),
    };


    return {
      registration: agent,
      attestation,
      gate1Result,
    };
  }

  getAttestation(agentId: string): CustomerAgentAttestation | undefined {
    return this.attestations.get(agentId);
  }

  getOwnershipType(agentId: string): CustomerAgentOwnershipType {
    return this.ownershipMap.get(agentId) ?? "validation_fixture";
  }
}

export const customerAgentAttestationService = new CustomerAgentAttestationService();
