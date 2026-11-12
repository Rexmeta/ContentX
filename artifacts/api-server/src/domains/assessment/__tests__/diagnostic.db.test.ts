import { describe, expect, it, afterAll } from "vitest";
import { db, pool, assessmentPackagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as repository from "../repository";
import { diagnosticSample } from "../diagnosticSample";
import { diagnosticHash, parseDiagnostic, projectParticipant, exportDiagnostic } from "../diagnostic";
import type { AssessmentScenarioPackageV1 } from "../model";

// Only the isolated runner may enable this suite. Never initialize/reset ambient DBs.
const d = process.env.ASSESSMENT_DB_ISOLATED === "true" ? describe : describe.skip;
const ids: string[] = [];
afterAll(async () => {
  if (process.env.ASSESSMENT_DB_ISOLATED !== "true") return;
  for (const id of ids) await db.delete(assessmentPackagesTable).where(eq(assessmentPackagesTable.id, id));
  await pool.end();
});
d("immutable diagnostic persistence in isolated PostgreSQL", () => {
  it("saves/reopens stable IDs, edits a successor and restores an old snapshot without changing it", async () => {
    const id = `diagnostic_${crypto.randomUUID()}`, actor = "owner-one";
    ids.push(id);
    const sample = diagnosticSample(id, actor);
    await repository.createAssessmentPackage({ id, packageKey: id, title: sample.package.metadata.title, description: sample.package.metadata.description, sourceType: "diagnostic-sample", sourceId: id, diagnosticOwnerId: actor });
    const original = await repository.createAssessmentPackageVersion({
      id: `${id}_v1`, packageId: id, version: 1, packageJson: sample.package,
      diagnosticJson: sample.diagnostic, contentHash: sample.package.provenance.contentHash,
      validationReport: { valid: true, diagnostics: [] }, createdBy: actor,
    });
    expect(original.diagnosticHash).toBe(diagnosticHash(sample.diagnostic));
    const reopened = await repository.getAssessmentPackageVersion(id, 1);
    expect(reopened!.diagnosticJson).toEqual(sample.diagnostic);
    const edited = structuredClone(sample.diagnostic);
    edited.scenarios[0]!.briefing.reason = "가".repeat(900);
    edited.scenarios[0]!.briefing.preparationSeconds = 240;
    const successor = await repository.createDiagnosticSuccessor(id, 1, edited, actor);
    expect(successor.version).toBe(2);
    const again = await repository.getAssessmentPackageVersion(id, 2);
    expect(again!.diagnosticJson).toEqual(edited);
    const source = parseDiagnostic(again!.diagnosticJson, again!.packageJson as AssessmentScenarioPackageV1);
    expect(source.scenarios[0]!.cues.map((c) => [c.id, c.criterionIds])).toEqual(sample.diagnostic.scenarios[0]!.cues.map((c) => [c.id, c.criterionIds]));
    expect(exportDiagnostic(again!.packageJson as AssessmentScenarioPackageV1, source).diagnostic).toEqual(edited);
    expect(JSON.stringify(projectParticipant(source, "preparation"))).not.toContain("주요 고객 두 곳");
    const restored = await repository.createDiagnosticSuccessor(id, 1, reopened!.diagnosticJson, actor);
    expect(restored.version).toBe(3);
    expect(restored.diagnosticJson).toEqual(sample.diagnostic);
    expect((await repository.getAssessmentPackageVersion(id, 1))!.packageJson).toEqual(original.packageJson);
    expect((await repository.getAssessmentPackageVersion(id, 1))!.diagnosticJson).toEqual(sample.diagnostic);
    await expect(repository.createDiagnosticSuccessor(id, 1, edited, "other-author")).rejects.toThrow("Forbidden");
    await expect(repository.createAssessmentPackageVersion({
      id: `${id}_invalid`, packageId: id, version: 4, packageJson: sample.package,
      contentHash: sample.package.provenance.contentHash, validationReport: {}, createdBy: actor,
    })).rejects.toThrow("preserve diagnostic source");
  });
  it("serializes concurrent successor allocation and rolls back invalid references", async () => {
    const id = `diagnostic_${crypto.randomUUID()}`, actor = "owner-two";
    ids.push(id);
    const sample = diagnosticSample(id, actor);
    await repository.createAssessmentPackage({ id, packageKey: id, title: "sample", description: "sample", sourceType: "diagnostic", sourceId: id, diagnosticOwnerId: actor });
    await repository.createAssessmentPackageVersion({ id: `${id}_v1`, packageId: id, version: 1, packageJson: sample.package, diagnosticJson: sample.diagnostic, contentHash: sample.package.provenance.contentHash, validationReport: {}, createdBy: actor });
    const results = await Promise.all([repository.createDiagnosticSuccessor(id, 1, sample.diagnostic, actor), repository.createDiagnosticSuccessor(id, 1, sample.diagnostic, actor)]);
    expect(results.map((r) => r.version).sort()).toEqual([2, 3]);
    const invalid = structuredClone(sample.diagnostic);
    invalid.scenarios[0]!.cues[0]!.criterionIds = ["absent"];
    await expect(repository.createDiagnosticSuccessor(id, 1, invalid, actor)).rejects.toThrow();
    expect((await repository.getAssessmentPackage(id))!.currentVersion).toBe(3);
    expect(await repository.listAssessmentPackageVersions(id)).toHaveLength(3);
  });
});
