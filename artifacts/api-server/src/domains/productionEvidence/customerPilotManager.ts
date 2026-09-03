import type {
  CustomerPilot,
  CustomerFailureReview,
} from "@workspace/simulation-contract";

export interface CreateCustomerPilotInput {
  organizationId: string;
  agentId: string;
  environment: "staging" | "production" | "sandbox";
  benchmarkVersion: string;
  rubricVersion: string;
  evaluatorVersion: string;
  contextHash: string;
  baselineRunId: string;
}

export class CustomerPilotManager {
  private pilots = new Map<string, CustomerPilot>();

  createPilot(input: CreateCustomerPilotInput): CustomerPilot {
    const pilotId = `pilot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const pilot: CustomerPilot = {
      pilotId,
      organizationId: input.organizationId,
      agentId: input.agentId,
      environment: input.environment,
      startAt: new Date().toISOString(),
      benchmarkVersion: input.benchmarkVersion,
      rubricVersion: input.rubricVersion,
      evaluatorVersion: input.evaluatorVersion,
      contextHash: input.contextHash,
      baselineRunId: input.baselineRunId,
      status: "running",
      customerReviewStatus: "pending",
      reviews: [],
    };

    this.pilots.set(pilotId, pilot);
    return pilot;
  }

  getPilot(pilotId: string): CustomerPilot | undefined {
    return this.pilots.get(pilotId);
  }

  addFailureReview(pilotId: string, review: CustomerFailureReview): CustomerPilot {
    const pilot = this.pilots.get(pilotId);
    if (!pilot) {
      throw new Error(`Pilot with ID ${pilotId} not found.`);
    }

    pilot.reviews.push(review);

    // Update customer review status
    const hasRejections = pilot.reviews.some((r) => r.customerDecision === "rejected");
    const allConfirmed = pilot.reviews.every((r) => r.customerDecision === "confirmed");

    if (hasRejections) {
      pilot.customerReviewStatus = "rejected";
    } else if (allConfirmed && pilot.reviews.length > 0) {
      pilot.customerReviewStatus = "accepted";
    }

    return pilot;
  }

  completePilot(pilotId: string, evidenceId: string): CustomerPilot {
    const pilot = this.pilots.get(pilotId);
    if (!pilot) {
      throw new Error(`Pilot with ID ${pilotId} not found.`);
    }

    pilot.status = "completed";
    pilot.endAt = new Date().toISOString();
    pilot.evidenceId = evidenceId;
    return pilot;
  }
}

export const customerPilotManager = new CustomerPilotManager();
