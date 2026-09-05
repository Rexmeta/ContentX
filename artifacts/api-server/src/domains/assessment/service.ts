import {
  RoleplayXClientError,
  roleplayXIdempotencyKey,
  type RoleplayXClient,
  type RoleplayXResponse,
} from "./roleplayxClient";

export interface AssessmentPackageVersion {
  packageId: string;
  version: number;
  organizationId: string;
  category: string;
  payload: Record<string, unknown>;
  hash: string;
  status: "draft" | "published";
}

export interface AssessmentDiagnostic {
  path: string;
  code: string;
  severity: "error" | "warning";
  message: string;
}

export interface PublicationAttempt {
  packageId: string;
  version: number;
  organizationId: string;
  category: string;
  idempotencyKey: string;
  stage: "local_validation" | "remote_validation" | "import";
  outcome: "started" | "succeeded" | "failed";
  errorCategory?: string;
  diagnostics?: AssessmentDiagnostic[];
  remoteResponse?: Record<string, unknown>;
}

export interface AssessmentPublishingDependencies {
  loadVersion(input: {
    packageId: string;
    version: number;
    organizationId: string;
    category: string;
  }): Promise<AssessmentPackageVersion | undefined>;
  findSuccessfulPublication(input: {
    packageId: string;
    version: number;
    organizationId: string;
    category: string;
  }): Promise<PublicationAttempt | undefined>;
  beginPublication(
    input: {
      packageId: string;
      version: number;
      organizationId: string;
      category: string;
    },
    idempotencyKey: string,
  ): Promise<"acquired" | "succeeded" | "in_progress">;
  recordAttempt(attempt: PublicationAttempt): Promise<void>;
  markPublished(input: {
    packageId: string;
    version: number;
    organizationId: string;
    category: string;
  }): Promise<void>;
  validateLocal(payload: Record<string, unknown>): Promise<AssessmentDiagnostic[]> | AssessmentDiagnostic[];
  roleplayX: RoleplayXClient;
}

export type PublishAssessmentResult =
  | { status: "published"; reused: boolean; idempotencyKey: string; response?: RoleplayXResponse }
  | { status: "failed"; reused: false; idempotencyKey: string; diagnostics?: AssessmentDiagnostic[]; errorCategory?: string };

function remoteDiagnostics(response: RoleplayXResponse): AssessmentDiagnostic[] {
  const source = response.diagnostics ?? response.errors ?? [];
  return source.map((item, index) => ({
    path: `/remote/${index}`,
    code: "roleplayx_validation",
    severity: "error" as const,
    message: typeof item === "string" ? item : JSON.stringify(item),
  }));
}

function rejected(response: RoleplayXResponse): boolean {
  return response.valid === false || response.accepted === false || response.success === false;
}

function safeRemoteResponse(value: Record<string, unknown>): Record<string, unknown> {
  const secret = /^(authorization|api[-_]?key|token|secret|password)$/i;
  const cleanse = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(cleanse);
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(
      Object.entries(item as Record<string, unknown>)
        .filter(([key]) => !secret.test(key))
        .map(([key, child]) => [key, cleanse(child)]),
    );
  };
  return cleanse(value) as Record<string, unknown>;
}

/**
 * This boundary only orchestrates collaborators. Repository/compiler/validator
 * implementations are injected so it has no DB side effects at module load and
 * can be tested without a RoleplayX instance.
 */
export function createAssessmentPublishingService(deps: AssessmentPublishingDependencies) {
  return {
    async publish(input: {
      packageId: string;
      version: number;
      organizationId: string;
      category: string;
    }): Promise<PublishAssessmentResult> {
      const idempotencyKey = roleplayXIdempotencyKey(input);
      const previous = await deps.findSuccessfulPublication(input);
      if (previous) return { status: "published", reused: true, idempotencyKey };

      const version = await deps.loadVersion(input);
      if (!version) {
        const diagnostics: AssessmentDiagnostic[] = [{
          path: "/",
          code: "package_version_not_found",
          severity: "error",
          message: "Assessment package version was not found",
        }];
        await deps.recordAttempt({ ...input, idempotencyKey, stage: "local_validation", outcome: "failed", diagnostics });
        return { status: "failed", reused: false, idempotencyKey, diagnostics };
      }

      const local = await deps.validateLocal(version.payload);
      if (local.some((diagnostic) => diagnostic.severity === "error")) {
        await deps.recordAttempt({ ...input, idempotencyKey, stage: "local_validation", outcome: "failed", diagnostics: local });
        return { status: "failed", reused: false, idempotencyKey, diagnostics: local, errorCategory: "validation" };
      }

      const disposition = await deps.beginPublication(input, idempotencyKey);
      if (disposition === "succeeded") {
        return { status: "published", reused: true, idempotencyKey };
      }
      if (disposition === "in_progress") {
        return {
          status: "failed",
          reused: false,
          idempotencyKey,
          errorCategory: "conflict",
        };
      }

      let stage: PublicationAttempt["stage"] = "remote_validation";
      try {
        await deps.recordAttempt({ ...input, idempotencyKey, stage: "remote_validation", outcome: "started" });
        const validated = await deps.roleplayX.validate(version.payload, idempotencyKey);
        if (rejected(validated)) {
          const diagnostics = remoteDiagnostics(validated);
          await deps.recordAttempt({ ...input, idempotencyKey, stage: "remote_validation", outcome: "failed", diagnostics, remoteResponse: safeRemoteResponse(validated) });
          return { status: "failed", reused: false, idempotencyKey, diagnostics, errorCategory: "validation" };
        }
        await deps.recordAttempt({ ...input, idempotencyKey, stage: "remote_validation", outcome: "succeeded", remoteResponse: safeRemoteResponse(validated) });

        stage = "import";
        await deps.recordAttempt({ ...input, idempotencyKey, stage, outcome: "started" });
        const imported = await deps.roleplayX.import(version.payload, idempotencyKey);
        if (rejected(imported)) {
          const diagnostics = remoteDiagnostics(imported);
          await deps.recordAttempt({ ...input, idempotencyKey, stage: "import", outcome: "failed", diagnostics, remoteResponse: safeRemoteResponse(imported) });
          return { status: "failed", reused: false, idempotencyKey, diagnostics, errorCategory: "validation" };
        }
        await deps.recordAttempt({ ...input, idempotencyKey, stage: "import", outcome: "succeeded", remoteResponse: safeRemoteResponse(imported) });
        await deps.markPublished(input);
        return { status: "published", reused: false, idempotencyKey, response: safeRemoteResponse(imported) as RoleplayXResponse };
      } catch (error) {
        const roleplayError = error instanceof RoleplayXClientError ? error : undefined;
        await deps.recordAttempt({
          ...input,
          idempotencyKey,
          stage,
          outcome: "failed",
          errorCategory: roleplayError?.category ?? "server",
          remoteResponse: roleplayError?.response && safeRemoteResponse(roleplayError.response),
        });
        return { status: "failed", reused: false, idempotencyKey, errorCategory: roleplayError?.category ?? "server" };
      }
    },
  };
}

/** Convenience entry point for route handlers that construct dependencies. */
export async function publishAssessmentVersion(
  deps: AssessmentPublishingDependencies,
  input: {
    packageId: string;
    version: number;
    organizationId: string;
    category: string;
  },
): Promise<PublishAssessmentResult> {
  return createAssessmentPublishingService(deps).publish(input);
}