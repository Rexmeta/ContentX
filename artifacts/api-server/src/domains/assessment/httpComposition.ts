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
  let successfulImportResponse: Record<string, unknown> | undefined;

  const fail = async (attempt: PublicationAttempt, current: "pending" | "validating" | "validated" | "importing") => {
    if (!activePublicationId) {
      const created = await repository.createPublicationAttempt({
        id: `publication_${crypto.randomUUID()}`,
        packageId: attempt.packageId,
        packageVersion: attempt.version,
        target: "roleplayx",
        targetOrganizationId: attempt.organizationId,
        targetCategoryId: attempt.category,
        idempotencyKey: attempt.idempotencyKey,
      });
      activePublicationId = created.publication.id;
    }
    await repository.transitionPublication(activePublicationId, current, "failed", {
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
      const created = await repository.createPublicationAttempt({
        id: `publication_${crypto.randomUUID()}`,
        packageId: input.packageId,
        packageVersion: input.version,
        target: "roleplayx",
        targetOrganizationId: input.organizationId,
        targetCategoryId: input.category,
        idempotencyKey,
      });
      activePublicationId = created.publication.id;
      return created.disposition;
    },
    async recordAttempt(attempt) {
      if (attempt.outcome === "started" && attempt.stage === "remote_validation") {
        if (!activePublicationId) throw new Error("Publication attempt is missing");
        await repository.transitionPublication(activePublicationId, "pending", "validating");
        return;
      }
      if (attempt.outcome === "succeeded" && attempt.stage === "remote_validation" && activePublicationId) {
        await repository.transitionPublication(activePublicationId, "validating", "validated", { response: attempt.remoteResponse });
        return;
      }
      if (attempt.outcome === "started" && attempt.stage === "import" && activePublicationId) {
        await repository.transitionPublication(activePublicationId, "validated", "importing");
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
      if (item.status === "draft") await repository.transitionAssessmentPackageStatus(item.id, "draft", "validated");
      const afterValidation = await repository.getAssessmentPackage(item.id);
      if (afterValidation?.status === "validated") await repository.transitionAssessmentPackageStatus(item.id, "validated", "approved");
      if (!activePublicationId) throw new Error("Publication attempt is missing");
      const finalized = await repository.finalizeSuccessfulPublication(
        activePublicationId,
        item.id,
        { response: successfulImportResponse },
      );
      if (!finalized) throw new Error("Publication attempt could not be finalized");
    },
    validateLocal: asDiagnostics,
    roleplayX: createRoleplayXClient(),
  });
}