import * as repository from "./repository";
import { validateAssessmentScenarioPackage } from "./validator";
import { createRoleplayXClient } from "./roleplayxClient";
import {
  createAssessmentPublishingService,
  type AssessmentDiagnostic,
  type PublicationAttempt,
} from "./service";

type PublishTarget = {
  packageId: string;
  version: number;
  organizationId: string;
  category: string;
};

const asDiagnostics = (payload: unknown): AssessmentDiagnostic[] =>
  validateAssessmentScenarioPackage(payload).diagnostics;

/**
 * HTTP composition owns the concrete persistence adapter. The publishing
 * service remains transport- and database-agnostic while every remote stage
 * advances one auditable publication row.
 */
export function createHttpAssessmentPublishingService() {
  let activePublicationId: string | undefined;
  let activeLeaseOwnerToken: string | undefined;
  const leaseDurationMs = repository.DEFAULT_PUBLICATION_LEASE_MS;
  const requireTransition = <T>(row: T | undefined): T => {
    if (!row) throw new Error("Publication lease ownership was lost");
    return row;
  };
  let successfulImportResponse: Record<string, unknown> | undefined;

  const fail = async (attempt: PublicationAttempt, current: "pending" | "validating" | "validated" | "importing") => {
    if (!activePublicationId) {
      const leaseOwnerToken = crypto.randomUUID();
      const created = await repository.createPublicationAttempt({
        id: `publication_${crypto.randomUUID()}`,
        packageId: attempt.packageId,
        packageVersion: attempt.version,
        target: "roleplayx",
        targetOrganizationId: attempt.organizationId,
        targetCategoryId: attempt.category,
        idempotencyKey: attempt.idempotencyKey,
        leaseOwnerToken,
        leaseDurationMs,
      });
      activePublicationId = created.publication.id;
      activeLeaseOwnerToken =
        created.disposition === "acquired" ? leaseOwnerToken : undefined;
    }
    if (!activeLeaseOwnerToken) return;
    await repository.transitionPublication(activePublicationId, activeLeaseOwnerToken, leaseDurationMs, current, "failed", {
      response: attempt.remoteResponse,
      errorCode: attempt.errorCategory ?? attempt.diagnostics?.[0]?.code ?? null,
      errorMessage: attempt.diagnostics?.[0]?.message ?? null,
    });
  };

  return createAssessmentPublishingService({
    async loadVersion(input: PublishTarget) {
      const row = await repository.getAssessmentPackageVersion(input.packageId, input.version);
      if (!row || !row.packageJson || typeof row.packageJson !== "object" || Array.isArray(row.packageJson)) return undefined;
      return {
        packageId: input.packageId,
        version: input.version,
        organizationId: input.organizationId,
        category: input.category,
        payload: row.packageJson as Record<string, unknown>,
        hash: row.contentHash,
        status: "draft" as const,
      };
    },
    async findSuccessfulPublication(input: PublishTarget) {
      const row = await repository.getSuccessfulPublication(input.packageId, input.version, "roleplayx", input.organizationId, input.category);
      return row ? {
        packageId: input.packageId, version: input.version, organizationId: input.organizationId, category: input.category,
        idempotencyKey: row.idempotencyKey, stage: "import", outcome: "succeeded",
      } : undefined;
    },
    async beginPublication(input: PublishTarget, idempotencyKey: string) {
      const leaseOwnerToken = crypto.randomUUID();
      const created = await repository.createPublicationAttempt({
        id: `publication_${crypto.randomUUID()}`,
        packageId: input.packageId,
        packageVersion: input.version,
        target: "roleplayx",
        targetOrganizationId: input.organizationId,
        targetCategoryId: input.category,
        idempotencyKey,
        leaseOwnerToken,
        leaseDurationMs,
      });
      activePublicationId = created.publication.id;
      activeLeaseOwnerToken = created.disposition === "acquired" ? leaseOwnerToken : undefined;
      return {
        disposition: created.disposition,
        idempotencyKey: created.publication.idempotencyKey,
      };
    },
    async recordAttempt(attempt) {
      if (attempt.outcome === "started" && attempt.stage === "remote_validation") {
        if (!activePublicationId) throw new Error("Publication attempt is missing");
        if (!activeLeaseOwnerToken) throw new Error("Publication lease is missing");
        requireTransition(await repository.transitionPublication(activePublicationId, activeLeaseOwnerToken, leaseDurationMs, "pending", "validating"));
        return;
      }
      if (attempt.outcome === "succeeded" && attempt.stage === "remote_validation" && activePublicationId) {
        if (!activeLeaseOwnerToken) throw new Error("Publication lease is missing");
        requireTransition(await repository.transitionPublication(activePublicationId, activeLeaseOwnerToken, leaseDurationMs, "validating", "validated", { response: attempt.remoteResponse }));
        return;
      }
      if (attempt.outcome === "started" && attempt.stage === "import" && activePublicationId) {
        if (!activeLeaseOwnerToken) throw new Error("Publication lease is missing");
        requireTransition(await repository.transitionPublication(activePublicationId, activeLeaseOwnerToken, leaseDurationMs, "validated", "importing"));
        return;
      }
      if (attempt.outcome === "succeeded" && attempt.stage === "import" && activePublicationId) {
        successfulImportResponse = attempt.remoteResponse;
        return;
      }
      const state = attempt.stage === "local_validation" ? "pending" : attempt.stage === "remote_validation" ? "validating" : "importing";
      if (attempt.outcome === "failed") await fail(attempt, state);
    },
    async markPublished(input) {
      const item = await repository.getAssessmentPackage(input.packageId);
      if (!item) return;
      if (!activePublicationId) throw new Error("Publication attempt is missing");
      if (!activeLeaseOwnerToken) throw new Error("Publication lease is missing");
      const finalized = await repository.finalizeSuccessfulPublication(
        activePublicationId,
        item.id,
        activeLeaseOwnerToken,
        { response: successfulImportResponse },
      );
      if (!finalized) throw new Error("Publication attempt could not be finalized");
    },
    validateLocal: asDiagnostics,
    roleplayX: createRoleplayXClient(),
  });
}