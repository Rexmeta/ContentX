import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  assessmentPackagesTable,
  assessmentPackageVersionsTable,
  assessmentPublicationsTable,
  db,
  type AssessmentPackageRow,
  type AssessmentPackageVersionRow,
  type AssessmentPublicationRow,
} from "@workspace/db";

/**
 * Storage boundary for immutable RoleplayX assessment package evidence.
 * Snapshots are insert-only; publication state is advanced with compare-and-
 * swap updates so competing workers cannot skip state transitions.
 */

export type AssessmentPublicationStatus =
  | "pending"
  | "validating"
  | "validated"
  | "importing"
  | "succeeded"
  | "failed";

export type CreateAssessmentPackageInput = {
  id: string;
  packageKey: string;
  title: string;
  description: string;
  sourceType: string;
  sourceId: string;
};

export type CreateAssessmentPackageVersionInput = {
  id: string;
  packageId: string;
  version: number;
  packageJson: unknown;
  contentHash: string;
  validationReport: unknown;
  createdBy?: string | null;
};

export type CreatePublicationAttemptInput = {
  id: string;
  packageId: string;
  packageVersion: number;
  target: string;
  targetUrl?: string | null;
  targetOrganizationId: string;
  targetCategoryId: string;
  idempotencyKey: string;
  leaseOwnerToken: string;
  leaseDurationMs: number;
};

export type PublicationTransition = {
  response?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestId?: string | null;
  publishedBy?: string | null;
};

export type AssessmentPublicationTargetSummary = {
  target: string;
  organizationId: string;
  category: string;
  status: AssessmentPublicationStatus;
};

export const DEFAULT_PUBLICATION_LEASE_MS = 5 * 60 * 1000;

function leaseExpiry(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Publication lease duration must be positive");
  }
  return sql`now() + (${Math.floor(durationMs)} * interval '1 millisecond')`;
}

const legalPublicationTransitions: Readonly<
  Record<AssessmentPublicationStatus, readonly AssessmentPublicationStatus[]>
> = {
  pending: ["validating", "failed"],
  validating: ["validated", "failed"],
  validated: ["importing", "failed"],
  importing: ["succeeded", "failed"],
  succeeded: [],
  failed: [],
};

const legalPackageTransitions: Readonly<
  Record<
    "draft" | "validated" | "approved" | "published" | "archived",
    readonly ("draft" | "validated" | "approved" | "published" | "archived")[]
  >
> = {
  draft: ["validated", "archived"],
  validated: ["draft", "approved", "archived"],
  approved: ["draft", "published", "archived"],
  published: ["archived"],
  archived: [],
};

export async function createAssessmentPackage(
  input: CreateAssessmentPackageInput,
): Promise<AssessmentPackageRow> {
  const [row] = await db
    .insert(assessmentPackagesTable)
    .values(input)
    .returning();
  if (!row) throw new Error("Failed to create assessment package");
  return row;
}

export async function getAssessmentPackage(
  id: string,
): Promise<AssessmentPackageRow | undefined> {
  const [row] = await db
    .select()
    .from(assessmentPackagesTable)
    .where(eq(assessmentPackagesTable.id, id));
  return row;
}

export async function getAssessmentPackageByIdentity(
  packageKey: string,
): Promise<AssessmentPackageRow | undefined> {
  const [row] = await db
    .select()
    .from(assessmentPackagesTable)
    .where(eq(assessmentPackagesTable.packageKey, packageKey));
  return row;
}

export async function listAssessmentPackages(): Promise<AssessmentPackageRow[]> {
  return db
    .select()
    .from(assessmentPackagesTable)
    .orderBy(desc(assessmentPackagesTable.updatedAt));
}

/**
 * Read the package's audit-facing state from its immutable version and
 * publication ledgers. Callers deliberately receive no derived package JSON.
 */
function packageCounts(packageJson: unknown): { scenarioCount: number; competencyCount: number } {
  if (!packageJson || typeof packageJson !== "object" || Array.isArray(packageJson)) {
    return { scenarioCount: 0, competencyCount: 0 };
  }
  const value = packageJson as { scenarios?: unknown; competencies?: unknown };
  return {
    scenarioCount: Array.isArray(value.scenarios) ? value.scenarios.length : 0,
    competencyCount: Array.isArray(value.competencies) ? value.competencies.length : 0,
  };
}
/** Compare-and-swap package lifecycle state; a stale publisher cannot regress it. */
export async function transitionAssessmentPackageStatus(
  id: string,
  from: keyof typeof legalPackageTransitions,
  to: keyof typeof legalPackageTransitions,
): Promise<AssessmentPackageRow | undefined> {
  if (!legalPackageTransitions[from].includes(to)) {
    throw new Error(`Illegal assessment package transition: ${from} -> ${to}`);
  }
  const [row] = await db
    .update(assessmentPackagesTable)
    .set({ status: to })
    .where(
      and(
        eq(assessmentPackagesTable.id, id),
        eq(assessmentPackagesTable.status, from),
      ),
    )
    .returning();
  return row;
}

/**
 * Insert an immutable version, returning an existing equal content-hash snapshot
 * for idempotent compilation. A package-row lock serializes version allocation
 * and prevents a concurrent duplicate from becoming a distinct version.
 */
export async function createAssessmentPackageVersion(
  input: CreateAssessmentPackageVersionInput,
): Promise<AssessmentPackageVersionRow> {
  return db.transaction(async (tx) => {
    const [packageRow] = await tx
      .select({ id: assessmentPackagesTable.id })
      .from(assessmentPackagesTable)
      .where(eq(assessmentPackagesTable.id, input.packageId))
      .for("update");
    if (!packageRow) {
      throw new Error(`Assessment package "${input.packageId}" does not exist`);
    }

    const [matchingChecksum] = await tx
      .select()
      .from(assessmentPackageVersionsTable)
      .where(
        and(
          eq(assessmentPackageVersionsTable.packageId, input.packageId),
          eq(assessmentPackageVersionsTable.contentHash, input.contentHash),
        ),
      );
    if (matchingChecksum) return matchingChecksum;

    const [sameVersion] = await tx
      .select()
      .from(assessmentPackageVersionsTable)
      .where(
        and(
          eq(assessmentPackageVersionsTable.packageId, input.packageId),
          eq(assessmentPackageVersionsTable.version, input.version),
        ),
      );
    if (sameVersion) {
      throw new Error(
        `Assessment package "${input.packageId}" version ${input.version} already exists with different content`,
      );
    }

    const [row] = await tx
      .insert(assessmentPackageVersionsTable)
      .values(input)
      .returning();
    if (!row) throw new Error("Failed to create assessment package version");
    await tx
      .update(assessmentPackagesTable)
      .set({ currentVersion: input.version })
      .where(eq(assessmentPackagesTable.id, input.packageId));
    return row;
  });
}

export async function getAssessmentPackageVersion(
  packageId: string,
  version: number,
): Promise<AssessmentPackageVersionRow | undefined> {
  const [row] = await db
    .select()
    .from(assessmentPackageVersionsTable)
    .where(
      and(
        eq(assessmentPackageVersionsTable.packageId, packageId),
        eq(assessmentPackageVersionsTable.version, version),
      ),
    );
  return row;
}

export async function getAssessmentPackageVersionById(
  id: string,
): Promise<AssessmentPackageVersionRow | undefined> {
  const [row] = await db
    .select()
    .from(assessmentPackageVersionsTable)
    .where(eq(assessmentPackageVersionsTable.id, id));
  return row;
}

export async function listAssessmentPackageVersions(
  packageId: string,
): Promise<AssessmentPackageVersionRow[]> {
  return db
    .select()
    .from(assessmentPackageVersionsTable)
    .where(eq(assessmentPackageVersionsTable.packageId, packageId))
    .orderBy(asc(assessmentPackageVersionsTable.version));
}

export async function getSuccessfulPublication(
  packageId: string,
  packageVersion: number,
  target: string,
  targetOrganizationId: string,
  targetCategoryId: string,
): Promise<AssessmentPublicationRow | undefined> {
  const [row] = await db
    .select()
    .from(assessmentPublicationsTable)
    .where(
      and(
        eq(assessmentPublicationsTable.packageId, packageId),
        eq(assessmentPublicationsTable.packageVersion, packageVersion),
        eq(assessmentPublicationsTable.target, target),
        eq(assessmentPublicationsTable.targetOrganizationId, targetOrganizationId),
        eq(assessmentPublicationsTable.targetCategoryId, targetCategoryId),
        eq(assessmentPublicationsTable.status, "succeeded"),
      ),
    );
  return row;
}

/**
 * Create the next auditable attempt, or reuse the one completed success for
 * this exact remote target. Locking the version makes the attempt number
 * monotonic per target even when workers race.
 */
export async function createPublicationAttempt(
  input: CreatePublicationAttemptInput,
): Promise<{
  publication: AssessmentPublicationRow;
  disposition: "acquired" | "succeeded" | "in_progress";
}> {
  return db.transaction(async (tx) => {
    const [version] = await tx
      .select({ id: assessmentPackageVersionsTable.id })
      .from(assessmentPackageVersionsTable)
      .where(
        and(
          eq(assessmentPackageVersionsTable.packageId, input.packageId),
          eq(assessmentPackageVersionsTable.version, input.packageVersion),
        ),
      )
      .for("update");
    if (!version) {
      throw new Error(
        `Assessment package "${input.packageId}" version ${input.packageVersion} does not exist`,
      );
    }

    const targetWhere = and(
      eq(assessmentPublicationsTable.packageId, input.packageId),
      eq(assessmentPublicationsTable.packageVersion, input.packageVersion),
      eq(assessmentPublicationsTable.target, input.target),
      eq(assessmentPublicationsTable.targetOrganizationId, input.targetOrganizationId),
      eq(assessmentPublicationsTable.targetCategoryId, input.targetCategoryId),
    );
    const [succeeded] = await tx
      .select()
      .from(assessmentPublicationsTable)
      .where(and(targetWhere, eq(assessmentPublicationsTable.status, "succeeded")));
    if (succeeded) {
      return { publication: succeeded, disposition: "succeeded" };
    }

    const [inProgress] = await tx
      .select()
      .from(assessmentPublicationsTable)
      .where(
        and(
          targetWhere,
          sql`${assessmentPublicationsTable.status} in ('pending', 'validating', 'validated', 'importing')`,
        ),
      )
      .orderBy(desc(assessmentPublicationsTable.attempt))
      .limit(1);
    if (inProgress) {
      const [takenOver] = await tx
        .update(assessmentPublicationsTable)
        .set({
          status: "pending",
          leaseOwnerToken: input.leaseOwnerToken,
          leaseExpiresAt: leaseExpiry(input.leaseDurationMs),
          errorCode: null,
          errorMessage: null,
          completedAt: null,
        })
        .where(
          and(
            eq(assessmentPublicationsTable.id, inProgress.id),
            sql`(${assessmentPublicationsTable.leaseExpiresAt} is null or ${assessmentPublicationsTable.leaseExpiresAt} <= now())`,
          ),
        )
        .returning();
      if (takenOver) {
        return { publication: takenOver, disposition: "acquired" };
      }
      return { publication: inProgress, disposition: "in_progress" };
    }

    const [latest] = await tx
      .select({ attempt: assessmentPublicationsTable.attempt })
      .from(assessmentPublicationsTable)
      .where(targetWhere)
      .orderBy(desc(assessmentPublicationsTable.attempt))
      .limit(1);
    const [publication] = await tx
      .insert(assessmentPublicationsTable)
      .values({
        id: input.id,
        packageId: input.packageId,
        packageVersion: input.packageVersion,
        target: input.target,
        targetUrl: input.targetUrl,
        targetOrganizationId: input.targetOrganizationId,
        targetCategoryId: input.targetCategoryId,
        idempotencyKey: input.idempotencyKey,
        leaseOwnerToken: input.leaseOwnerToken,
        leaseExpiresAt: leaseExpiry(input.leaseDurationMs),
        attempt: (latest?.attempt ?? 0) + 1,
      })
      .returning();
    if (!publication) throw new Error("Failed to create publication attempt");
    return { publication, disposition: "acquired" };
  });
}

/**
 * Atomically advance a publication attempt. Callers must provide the expected
 * current state; stale workers receive `undefined` and cannot overwrite a
 * later success or failure.
 */
export async function transitionPublication(
  id: string,
  leaseOwnerToken: string,
  leaseDurationMs: number,
  from: AssessmentPublicationStatus,
  to: AssessmentPublicationStatus,
  detail: PublicationTransition = {},
): Promise<AssessmentPublicationRow | undefined> {
  if (!legalPublicationTransitions[from].includes(to)) {
    throw new Error(`Illegal assessment publication transition: ${from} -> ${to}`);
  }
  const completedAt = to === "succeeded" || to === "failed" ? new Date() : undefined;
  const publishedAt = to === "succeeded" ? new Date() : undefined;
  const [row] = await db
    .update(assessmentPublicationsTable)
    .set({
      status: to,
      ...detail,
      ...(completedAt ? { completedAt } : {}),
      ...(publishedAt ? { publishedAt } : {}),
        leaseExpiresAt: leaseExpiry(leaseDurationMs),
    })
    .where(
      and(
        eq(assessmentPublicationsTable.id, id),
        eq(assessmentPublicationsTable.status, from),
        eq(assessmentPublicationsTable.leaseOwnerToken, leaseOwnerToken),
        sql`${assessmentPublicationsTable.leaseExpiresAt} > now()`,
      ),
    )
    .returning();
  return row;
}

/**
 * Commit the successful remote import and the ContentX package lifecycle in one
 * transaction. A crash cannot leave a succeeded publication attached to an
 * unpublished package (or the inverse).
 */
export async function finalizeSuccessfulPublication(
  publicationId: string,
  packageId: string,
  leaseOwnerToken: string,
  detail: PublicationTransition = {},
): Promise<AssessmentPublicationRow | undefined> {
  return db.transaction(async (tx) => {
    const [publication] = await tx
      .update(assessmentPublicationsTable)
      .set({
        status: "succeeded",
        ...detail,
        completedAt: new Date(),
        publishedAt: new Date(),
      })
      .where(
        and(
          eq(assessmentPublicationsTable.id, publicationId),
          eq(assessmentPublicationsTable.packageId, packageId),
          eq(assessmentPublicationsTable.status, "importing"),
          eq(assessmentPublicationsTable.leaseOwnerToken, leaseOwnerToken),
          sql`${assessmentPublicationsTable.leaseExpiresAt} > now()`,
        ),
      )
      .returning();
    if (!publication) return undefined;

    let [packageRow] = await tx
      .select({ status: assessmentPackagesTable.status })
      .from(assessmentPackagesTable)
      .where(eq(assessmentPackagesTable.id, packageId))
      .for("update");
    if (!packageRow) {
      throw new Error(`Assessment package "${packageId}" does not exist`);
    }
    for (const [from, to] of [
      ["draft", "validated"],
      ["validated", "approved"],
      ["approved", "published"],
    ] as const) {
      if (packageRow.status !== from) continue;
      const [advanced] = await tx
        .update(assessmentPackagesTable)
        .set({ status: to })
        .where(
          and(
            eq(assessmentPackagesTable.id, packageId),
            eq(assessmentPackagesTable.status, from),
          ),
        )
        .returning({ status: assessmentPackagesTable.status });
      if (!advanced) {
        throw new Error(
          `Assessment package "${packageId}" changed state during publication`,
        );
      }
      packageRow = advanced;
    }
    if (packageRow?.status !== "published") {
      throw new Error(
        `Assessment package "${packageId}" could not be atomically published`,
      );
    }
    return publication;
  });
}

export async function listPublicationHistory(
  packageId: string,
  packageVersion: number,
): Promise<AssessmentPublicationRow[]> {
  return db
    .select()
    .from(assessmentPublicationsTable)
    .where(
      and(
        eq(assessmentPublicationsTable.packageId, packageId),
        eq(assessmentPublicationsTable.packageVersion, packageVersion),
      ),
    )
    .orderBy(desc(assessmentPublicationsTable.createdAt), desc(assessmentPublicationsTable.attempt));
}

/** List all publication attempts across every immutable version of a package. */
export async function listAssessmentPackagePublicationHistory(
  packageId: string,
): Promise<AssessmentPublicationRow[]> {
  return db
    .select()
    .from(assessmentPublicationsTable)
    .where(eq(assessmentPublicationsTable.packageId, packageId))
    .orderBy(
      desc(assessmentPublicationsTable.createdAt),
      desc(assessmentPublicationsTable.packageVersion),
      desc(assessmentPublicationsTable.attempt),
    );
}

/** Exported for tests and service-level transition guards. */
export const assessmentPublicationTransitionMap = legalPublicationTransitions;
export const assessmentPackageTransitionMap = legalPackageTransitions;

export type AssessmentPackageReadModel = {
  assessmentPackage: AssessmentPackageRow;
  scenarioCount: number;
  competencyCount: number;
  latestTarget: AssessmentPublicationTargetSummary | null;
  versions: AssessmentPackageVersionReadSummary[];
  publicationHistory: AssessmentPublicationRow[];
};

export type AssessmentPackageVersionReadSummary = {
  id: string;
  packageId: string;
  version: number;
  contentHash: string;
  validation: unknown;
  status: "draft" | "validated" | "published";
  latestTarget: AssessmentPublicationTargetSummary | null;
  createdBy: string | null;
  createdAt: Date;
};

function publicationTarget(
  publication: AssessmentPublicationRow | undefined,
): AssessmentPublicationTargetSummary | null {
  if (!publication) return null;
  return {
    target: publication.target,
    organizationId: publication.targetOrganizationId,
    category: publication.targetCategoryId,
    status: publication.status as AssessmentPublicationStatus,
  };
}

function validationPassed(validationReport: unknown): boolean {
  return (
    !!validationReport &&
    typeof validationReport === "object" &&
    (validationReport as { valid?: unknown }).valid === true
  );
}

export async function getAssessmentPackageReadModel(
  packageId: string,
): Promise<AssessmentPackageReadModel | undefined> {
  const assessmentPackage = await getAssessmentPackage(packageId);
  return assessmentPackage ? buildAssessmentPackageReadModel(assessmentPackage) : undefined;
}

/** List audit-facing package summaries derived from immutable evidence ledgers. */
export async function listAssessmentPackageReadModels(): Promise<AssessmentPackageReadModel[]> {
  const packages = await listAssessmentPackages();
  return Promise.all(packages.map(buildAssessmentPackageReadModel));
}

async function buildAssessmentPackageReadModel(
  assessmentPackage: AssessmentPackageRow,
): Promise<AssessmentPackageReadModel> {
  const [versions, publicationHistory] = await Promise.all([
    listAssessmentPackageVersions(assessmentPackage.id),
    listAssessmentPackagePublicationHistory(assessmentPackage.id),
  ]);
  const publicationsByVersion = new Map<number, AssessmentPublicationRow[]>();
  for (const publication of publicationHistory) {
    const entries = publicationsByVersion.get(publication.packageVersion) ?? [];
    entries.push(publication);
    publicationsByVersion.set(publication.packageVersion, entries);
  }
  const currentVersion =
    versions.find((version) => version.version === assessmentPackage.currentVersion) ??
    versions.at(-1);
  const counts = packageCounts(currentVersion?.packageJson);
  return {
    assessmentPackage,
    ...counts,
    latestTarget: publicationTarget(publicationHistory[0]),
    versions: versions.map((version) => {
      const publications = publicationsByVersion.get(version.version) ?? [];
      return {
        id: version.id,
        packageId: version.packageId,
        version: version.version,
        contentHash: version.contentHash,
        validation: version.validationReport,
        status: publications.some((publication) => publication.status === "succeeded")
          ? "published"
          : validationPassed(version.validationReport)
            ? "validated"
            : "draft",
        latestTarget: publicationTarget(publications[0]),
        createdBy: version.createdBy,
        createdAt: version.createdAt,
      };
    }),
    publicationHistory,
  };
}
