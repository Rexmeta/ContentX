/**
 * Real-PostgreSQL regression coverage for immutable assessment package evidence
 * and RoleplayX publication attempts. Skipped outside a configured DB unless
 * ASSESSMENT_DB_TEST_REQUIRED=true makes DB coverage mandatory in CI.
 */
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  assessmentPackagesTable,
  assessmentPublicationsTable,
  db,
} from "@workspace/db";
import * as repository from "../repository";

const hasDb = Boolean(process.env["DATABASE_URL"]);
if (process.env["ASSESSMENT_DB_TEST_REQUIRED"] === "true" && !hasDb) {
  throw new Error(
    "DATABASE_URL is required because assessment DB regression coverage is mandatory",
  );
}
const d = hasDb ? describe : describe.skip;
const createdPackageIds = new Set<string>();
const runTag = `assessment-db-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  for (const packageId of createdPackageIds) {
    await db
      .delete(assessmentPublicationsTable)
      .where(eq(assessmentPublicationsTable.packageId, packageId))
      .catch(() => {});
    // Package-version rows cascade when their owning package is removed.
    await db
      .delete(assessmentPackagesTable)
      .where(eq(assessmentPackagesTable.id, packageId))
      .catch(() => {});
  }
});

d("assessment repository (real DB)", () => {
  it("persists immutable snapshots and an idempotent publication history", async () => {
    const packageId = `${runTag}-package`;
    const versionId = `${runTag}-version`;
    createdPackageIds.add(packageId);

    const created = await repository.createAssessmentPackage({
      id: packageId,
      packageKey: `${runTag}-key`,
      title: "Assessment DB regression package",
      description: "A package created only for repository regression coverage.",
      sourceType: "contentx",
      sourceId: `${runTag}-source`,
    });
    expect(created).toMatchObject({
      id: packageId,
      packageKey: `${runTag}-key`,
      status: "draft",
      currentVersion: 0,
    });

    const snapshot = {
      schemaVersion: "1.0",
      packageKey: created.packageKey,
      scenarios: [{ key: "customer-call", title: "Customer call" }],
    };
    const hash = "a".repeat(64);
    const firstVersion = await repository.createAssessmentPackageVersion({
      id: versionId,
      packageId,
      version: 1,
      packageJson: snapshot,
      contentHash: hash,
      validationReport: { valid: true, diagnostics: [] },
      createdBy: "assessment-db-test",
    });
    expect(firstVersion).toMatchObject({
      id: versionId,
      packageId,
      version: 1,
      packageJson: snapshot,
      contentHash: hash,
    });

    const reusedVersion = await repository.createAssessmentPackageVersion({
      id: `${runTag}-ignored-id`,
      packageId,
      version: 99,
      packageJson: { changed: "this must not be written" },
      contentHash: hash,
      validationReport: { valid: false },
    });
    expect(reusedVersion.id).toBe(versionId);
    expect(await repository.listAssessmentPackageVersions(packageId)).toHaveLength(1);

    await expect(
      repository.createAssessmentPackageVersion({
        id: `${runTag}-conflict`,
        packageId,
        version: 1,
        packageJson: { changed: true },
        contentHash: "b".repeat(64),
        validationReport: { valid: true },
      }),
    ).rejects.toThrow(/version 1 already exists with different content/);

    // Snapshots expose no mutation API, and later repository activity leaves
    // the stored JSON/hash evidence exactly as inserted.
    expect(repository).not.toHaveProperty("updateAssessmentPackageVersion");
    const packageAfterVersion = await repository.getAssessmentPackage(packageId);
    expect(packageAfterVersion?.currentVersion).toBe(1);
    const storedSnapshot = await repository.getAssessmentPackageVersion(packageId, 1);
    expect(storedSnapshot).toMatchObject({ packageJson: snapshot, contentHash: hash });

    const publicationInput = {
      packageId,
      packageVersion: 1,
      target: "roleplayx",
      targetUrl: "https://roleplayx.example.test",
      targetOrganizationId: `${runTag}-organization`,
      targetCategoryId: `${runTag}-category`,
      idempotencyKey: `${runTag}-idempotency`,
      leaseOwnerToken: `${runTag}-owner`,
      leaseDurationMs: 60_000,
    };
    const attempt = await repository.createPublicationAttempt({
      id: `${runTag}-publication-1`,
      ...publicationInput,
    });
    expect(attempt.disposition).toBe("acquired");
    expect(attempt.publication).toMatchObject({ attempt: 1, status: "pending" });

    await expect(
      repository.transitionPublication(attempt.publication.id, publicationInput.leaseOwnerToken, 60_000, "pending", "validating"),
    ).resolves.toMatchObject({ status: "validating" });
    await expect(
      repository.transitionPublication(attempt.publication.id, publicationInput.leaseOwnerToken, 60_000, "validating", "validated"),
    ).resolves.toMatchObject({ status: "validated" });
    await expect(
      repository.transitionPublication(attempt.publication.id, publicationInput.leaseOwnerToken, 60_000, "validated", "importing"),
    ).resolves.toMatchObject({ status: "importing" });
    await repository.transitionAssessmentPackageStatus(packageId, "draft", "validated");
    await repository.transitionAssessmentPackageStatus(packageId, "validated", "approved");
    await expect(
      repository.finalizeSuccessfulPublication(attempt.publication.id, packageId, publicationInput.leaseOwnerToken, {
        response: { importId: "remote-assessment-1" },
        requestId: "request-1",
      }),
    ).resolves.toMatchObject({ status: "succeeded", requestId: "request-1" });

    const history = await repository.listPublicationHistory(packageId, 1);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: attempt.publication.id,
      attempt: 1,
      status: "succeeded",
      response: { importId: "remote-assessment-1" },
    });
    expect(history[0]?.completedAt).toBeInstanceOf(Date);
    expect(history[0]?.publishedAt).toBeInstanceOf(Date);

    const duplicate = await repository.createPublicationAttempt({
      id: `${runTag}-publication-duplicate`,
      ...publicationInput,
    });
    expect(duplicate).toEqual({
      publication: history[0],
      disposition: "succeeded",
    });
    expect(await repository.listPublicationHistory(packageId, 1)).toHaveLength(1);
    expect(
      await repository.getSuccessfulPublication(
        packageId,
        1,
        publicationInput.target,
        publicationInput.targetOrganizationId,
        publicationInput.targetCategoryId,
      ),
    ).toMatchObject({ id: attempt.publication.id });

    expect(await repository.getAssessmentPackageVersion(packageId, 1)).toMatchObject({
      packageJson: snapshot,
      contentHash: hash,
    });

    // A package already marked published can still atomically finalize a later
    // immutable version's independent publication record.
    await repository.createAssessmentPackageVersion({
      id: `${runTag}-version-2`,
      packageId,
      version: 2,
      packageJson: { ...snapshot, version: "2" },
      contentHash: "c".repeat(64),
      validationReport: { valid: true, diagnostics: [] },
    });
    const versionTwoAttempt = await repository.createPublicationAttempt({
      id: `${runTag}-publication-v2`,
      ...publicationInput,
      packageVersion: 2,
      idempotencyKey: `${runTag}-idempotency-v2`,
      leaseOwnerToken: `${runTag}-owner-v2`,
    });
    await repository.transitionPublication(
      versionTwoAttempt.publication.id,
      `${runTag}-owner-v2`,
      60_000,
      "pending",
      "validating",
    );
    await repository.transitionPublication(
      versionTwoAttempt.publication.id,
      `${runTag}-owner-v2`,
      60_000,
      "validating",
      "validated",
    );
    await repository.transitionPublication(
      versionTwoAttempt.publication.id,
      `${runTag}-owner-v2`,
      60_000,
      "validated",
      "importing",
    );
    await expect(
      repository.finalizeSuccessfulPublication(
        versionTwoAttempt.publication.id,
        packageId,
        `${runTag}-owner-v2`,
      ),
    ).resolves.toMatchObject({ status: "succeeded", packageVersion: 2 });

    // The version-row lock ensures concurrent publishers acquire only one
    // active attempt for a target; the other observes it as in progress.
    const concurrentTarget = {
      ...publicationInput,
      targetCategoryId: `${runTag}-concurrent-category`,
      idempotencyKey: `${runTag}-concurrent-key`,
      leaseOwnerToken: `${runTag}-concurrent-owner`,
    };
    const concurrent = await Promise.all([
      repository.createPublicationAttempt({
        id: `${runTag}-concurrent-a`,
        ...concurrentTarget,
      }),
      repository.createPublicationAttempt({
        id: `${runTag}-concurrent-b`,
        ...concurrentTarget,
      }),
    ]);
    expect(concurrent.map((item) => item.disposition).sort()).toEqual([
      "acquired",
      "in_progress",
    ]);

    // Simulate a hard process stop while a remote validation is in flight.
    const crashed = concurrent.find((item) => item.disposition === "acquired")!;
    const crashedOwner = crashed.publication.leaseOwnerToken!;
    await repository.transitionPublication(
      crashed.publication.id,
      crashedOwner,
      60_000,
      "pending",
      "validating",
    );

    const protectedRetry = await repository.createPublicationAttempt({
      id: `${runTag}-protected-retry`,
      ...concurrentTarget,
      leaseOwnerToken: `${runTag}-protected-owner`,
    });
    expect(protectedRetry.disposition).toBe("in_progress");
    expect(protectedRetry.publication.id).toBe(crashed.publication.id);
    await expect(
      repository.transitionPublication(
        protectedRetry.publication.id,
        `${runTag}-protected-owner`,
        60_000,
        "validating",
        "failed",
      ),
    ).resolves.toBeUndefined();
    expect(
      (await repository.listPublicationHistory(packageId, 1)).find(
        (item) => item.id === crashed.publication.id,
      ),
    ).toMatchObject({
      status: "validating",
      leaseOwnerToken: crashedOwner,
    });

    await db
      .update(assessmentPublicationsTable)
      .set({ leaseExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(assessmentPublicationsTable.id, crashed.publication.id));

    const takeoverOwners = [
      `${runTag}-takeover-a`,
      `${runTag}-takeover-b`,
    ];
    const takeovers = await Promise.all(
      takeoverOwners.map((leaseOwnerToken, index) =>
        repository.createPublicationAttempt({
          id: `${runTag}-takeover-${index}`,
          ...concurrentTarget,
          leaseOwnerToken,
        }),
      ),
    );
    expect(takeovers.map((item) => item.disposition).sort()).toEqual([
      "acquired",
      "in_progress",
    ]);
    const winner = takeovers.find((item) => item.disposition === "acquired")!;
    expect(winner.publication.id).toBe(crashed.publication.id);
    expect(winner.publication.idempotencyKey).toBe(concurrentTarget.idempotencyKey);
    expect(winner.publication.attempt).toBe(crashed.publication.attempt);

    // A worker returning after its lease expired cannot advance the takeover.
    await expect(
      repository.transitionPublication(
        crashed.publication.id,
        crashedOwner,
        60_000,
        "pending",
        "validating",
      ),
    ).resolves.toBeUndefined();
    await expect(
      repository.transitionPublication(
        winner.publication.id,
        winner.publication.leaseOwnerToken!,
        60_000,
        "pending",
        "validating",
      ),
    ).resolves.toMatchObject({ status: "validating" });

    // Finalization fences package lifecycle changes with the same lease token.
    const recoveryPackageId = `${runTag}-recovery-package`;
    createdPackageIds.add(recoveryPackageId);
    await repository.createAssessmentPackage({
      id: recoveryPackageId,
      packageKey: `${runTag}-recovery-key`,
      title: "Lease recovery package",
      description: "Verifies stale finalizers cannot publish a package.",
      sourceType: "contentx",
      sourceId: `${runTag}-recovery-source`,
    });
    await repository.createAssessmentPackageVersion({
      id: `${runTag}-recovery-version`,
      packageId: recoveryPackageId,
      version: 1,
      packageJson: snapshot,
      contentHash: "d".repeat(64),
      validationReport: { valid: true },
    });
    const recoveryInput = {
      packageId: recoveryPackageId,
      packageVersion: 1,
      target: "roleplayx",
      targetOrganizationId: `${runTag}-recovery-org`,
      targetCategoryId: `${runTag}-recovery-category`,
      idempotencyKey: `${runTag}-recovery-key`,
      leaseOwnerToken: `${runTag}-crashed-finalizer`,
      leaseDurationMs: 60_000,
    };
    const recoveryAttempt = await repository.createPublicationAttempt({
      id: `${runTag}-recovery-publication`,
      ...recoveryInput,
    });
    for (const [from, to] of [
      ["pending", "validating"],
      ["validating", "validated"],
      ["validated", "importing"],
    ] as const) {
      await repository.transitionPublication(
        recoveryAttempt.publication.id,
        recoveryInput.leaseOwnerToken,
        60_000,
        from,
        to,
      );
    }
    await db
      .update(assessmentPublicationsTable)
      .set({ leaseExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(assessmentPublicationsTable.id, recoveryAttempt.publication.id));
    const recovered = await repository.createPublicationAttempt({
      id: `${runTag}-ignored-recovery-id`,
      ...recoveryInput,
      leaseOwnerToken: `${runTag}-recovery-winner`,
    });
    expect(recovered.disposition).toBe("acquired");

    await expect(
      repository.finalizeSuccessfulPublication(
        recoveryAttempt.publication.id,
        recoveryPackageId,
        recoveryInput.leaseOwnerToken,
      ),
    ).resolves.toBeUndefined();
    expect(await repository.getAssessmentPackage(recoveryPackageId)).toMatchObject({
      status: "draft",
    });

    for (const [from, to] of [
      ["pending", "validating"],
      ["validating", "validated"],
      ["validated", "importing"],
    ] as const) {
      await repository.transitionPublication(
        recovered.publication.id,
        recovered.publication.leaseOwnerToken!,
        60_000,
        from,
        to,
      );
    }
    await expect(
      repository.finalizeSuccessfulPublication(
        recovered.publication.id,
        recoveryPackageId,
        recovered.publication.leaseOwnerToken!,
      ),
    ).resolves.toMatchObject({ status: "succeeded" });
    expect(await repository.getAssessmentPackage(recoveryPackageId)).toMatchObject({
      status: "published",
    });
  });
});