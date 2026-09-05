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
};

export type PublicationTransition = {
  response?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestId?: string | null;
  publishedBy?: string | null;
};

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
      .values({ ...input, attempt: (latest?.attempt ?? 0) + 1 })
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
    })
    .where(
      and(
        eq(assessmentPublicationsTable.id, id),
        eq(assessmentPublicationsTable.status, from),
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
        ),
      )
      .returning();
    if (!publication) return undefined;

    const [packageRow] = await tx
      .select({ status: assessmentPackagesTable.status })
      .from(assessmentPackagesTable)
      .where(eq(assessmentPackagesTable.id, packageId))
      .for("update");
    if (packageRow?.status === "approved") {
      const [publishedPackage] = await tx
        .update(assessmentPackagesTable)
        .set({ status: "published" })
        .where(
          and(
            eq(assessmentPackagesTable.id, packageId),
            eq(assessmentPackagesTable.status, "approved"),
          ),
        )
        .returning({ id: assessmentPackagesTable.id });
      if (!publishedPackage) {
        throw new Error(
          `Assessment package "${packageId}" changed state during publication`,
        );
      }
      return publication;
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