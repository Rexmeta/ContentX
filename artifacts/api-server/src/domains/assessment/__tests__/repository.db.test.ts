/**
 * Real-PostgreSQL regression coverage for immutable assessment package evidence
 * and RoleplayX publication attempts. Skipped outside a configured DB.
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
    };
    const attempt = await repository.createPublicationAttempt({
      id: `${runTag}-publication-1`,
      ...publicationInput,
    });
    expect(attempt.disposition).toBe("acquired");
    expect(attempt.publication).toMatchObject({ attempt: 1, status: "pending" });

    await expect(
      repository.transitionPublication(attempt.publication.id, "pending", "validating"),
    ).resolves.toMatchObject({ status: "validating" });
    await expect(
      repository.transitionPublication(attempt.publication.id, "validating", "validated"),
    ).resolves.toMatchObject({ status: "validated" });
    await expect(
      repository.transitionPublication(attempt.publication.id, "validated", "importing"),
    ).resolves.toMatchObject({ status: "importing" });
    await repository.transitionAssessmentPackageStatus(packageId, "draft", "validated");
    await repository.transitionAssessmentPackageStatus(packageId, "validated", "approved");
    await expect(
      repository.finalizeSuccessfulPublication(attempt.publication.id, packageId, {
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
    });
    await repository.transitionPublication(
      versionTwoAttempt.publication.id,
      "pending",
      "validating",
    );
    await repository.transitionPublication(
      versionTwoAttempt.publication.id,
      "validating",
      "validated",
    );
    await repository.transitionPublication(
      versionTwoAttempt.publication.id,
      "validated",
      "importing",
    );
    await expect(
      repository.finalizeSuccessfulPublication(
        versionTwoAttempt.publication.id,
        packageId,
      ),
    ).resolves.toMatchObject({ status: "succeeded", packageVersion: 2 });

    // The version-row lock ensures concurrent publishers acquire only one
    // active attempt for a target; the other observes it as in progress.
    const concurrentTarget = {
      ...publicationInput,
      targetCategoryId: `${runTag}-concurrent-category`,
      idempotencyKey: `${runTag}-concurrent-key`,
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
  });
});