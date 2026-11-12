import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { diagnosticSample } from "../../domains/assessment/diagnosticSample";
import { diagnosticHash } from "../../domains/assessment/diagnostic";

const state = vi.hoisted(() => ({ actor: null as string | null, row: null as any, owner: "owner" }));
vi.mock("@clerk/express", () => ({ getAuth: () => ({ userId: state.actor }) }));
vi.mock("../../domains/assessment/repository", () => ({
  getAssessmentPackage: vi.fn(async () => ({ diagnosticOwnerId: state.owner })),
  getAssessmentPackageVersion: vi.fn(async () => state.row),
  createDiagnosticSuccessor: vi.fn(async (_id, _version, source) => ({ ...state.row, version: 2, diagnosticJson: source })),
  listAssessmentPackageReadModels: vi.fn(async () => []),
  createAssessmentPackage: vi.fn(), createAssessmentPackageVersion: vi.fn(),
}));
vi.mock("../../domains/assessment/media", () => ({
  validateDiagnosticMedia: vi.fn(), requestMediaUpload: vi.fn(async () => ({ assetId: "private-asset", uploadURL: "https://storage.example/signed" })),
  getAssessmentMedia: vi.fn(async () => ({ objectPath: "/objects/private-storage-path", contentType: "image/png" })),
  mediaStorage: { getObjectEntityFile: vi.fn(async () => ({ createReadStream: () => Readable.from(Buffer.from("PNG")) })) },
}));
import assessmentsRouter from "../assessments";
import * as repository from "../../domains/assessment/repository";
const app = express().use(express.json()).use("/api", assessmentsRouter);
const base = "/api/v1/assessments/private-package/versions/1";
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = null; state.owner = "owner";
  const sample = diagnosticSample("private-package", "owner");
  state.row = { id: "v1", packageId: "private-package", version: 1, packageJson: sample.package, diagnosticJson: sample.diagnostic, diagnosticHash: diagnosticHash(sample.diagnostic), contentHash: sample.package.provenance.contentHash, validationReport: { valid: true, diagnostics: [] }, createdAt: new Date() };
});
describe("diagnostic API privacy and compatibility boundary", () => {
  it("anonymous participant responses allow only briefing and visible materials with no source payload", async () => {
    const response = await request(app).get(`${base}/participant?phase=preparation`).expect(200);
    expect(Object.keys(response.body).sort()).toEqual(["phase", "scenarios", "schemaVersion"]);
    const json = JSON.stringify(response.body);
    for (const forbidden of ["cues", "criteria", "private", "personas", "internalPrompt", "provenance", "주요 고객 두 곳", "결과만 보고", "modelAnswer"]) expect(json).not.toContain(forbidden);
    expect(json).toContain("훈련용 예시 수치");
    await request(app).get(`${base}/participant?phase=unknown`).expect(400);
  });
  it("denies full source, v1 package, version metadata, publication and deprecated aliases to participants and other authors", async () => {
    for (const suffix of ["/diagnostic", "/diagnostic-export", "/package", "/validate", "/publish"]) {
      if (["/validate", "/publish"].includes(suffix)) await request(app).post(`${base}${suffix}`).send({}).expect(401);
      else await request(app).get(`${base}${suffix}`).expect(401);
    }
    await request(app).get("/api/v1/assessments/private-package").expect(401);
    await request(app).get("/api/v1/assessment-packages/private-package/versions/1").expect(401);
    // Spoofed tenant/session-like headers do not constitute verified authentication.
    await request(app).get(`${base}/diagnostic`).set("x-organization-id", "owner").expect(401);
    state.actor = "other";
    await request(app).get(`${base}/package`).expect(403);
    await request(app).post(`${base}/diagnostic`).send(state.row.diagnosticJson).expect(403);
    expect(repository.createDiagnosticSuccessor).not.toHaveBeenCalled();
    state.actor = "owner";
    const pkg = await request(app).get(`${base}/package`).expect(200);
    expect(pkg.body.schemaVersion).toBe("1.0");
    expect(pkg.headers["cache-control"]).toBe("private, no-store");
    expect((await request(app).get(`${base}/diagnostic`).expect(200)).body).toEqual(state.row.diagnosticJson);
  });
  it("preserves long human inputs in successor writes and reports unsupported v1 publishing explicitly", async () => {
    state.actor = "owner";
    const input = structuredClone(state.row.diagnosticJson);
    input.scenarios[0].briefing.reason = "가".repeat(1000);
    input.scenarios[0].briefing.preparationSeconds = 250;
    await request(app).post(`${base}/diagnostic`).send(input).expect(201);
    expect(repository.createDiagnosticSuccessor).toHaveBeenCalledWith("private-package", 1, input, "owner");
    await request(app).post(`${base}/publish`).send({ organizationId: "org", category: "leadership" }).expect(422);
    const exported = await request(app).get(`${base}/diagnostic-export`).expect(200);
    expect(exported.body.runtimeResults).toBeNull();
    expect(exported.body.diagnostic).toEqual(state.row.diagnosticJson);
  });
  it("rejects malformed references, raw unknown fields and corrupted stored sources", async () => {
    state.actor = "owner";
    const input = structuredClone(state.row.diagnosticJson);
    input.scenarios[0].cues[0].criterionIds = ["unknown"];
    await request(app).post(`${base}/diagnostic`).send(input).expect(400);
    input.scenarios[0].cues[0].criterionIds = ["criterion-cause"];
    input.scenarios[0].briefing.private = "not allowed";
    await request(app).post(`${base}/diagnostic`).send(input).expect(400);
    expect(repository.createDiagnosticSuccessor).not.toHaveBeenCalled();
    state.row.diagnosticHash = "invalid";
    await request(app).get(`${base}/participant?phase=preparation`).expect(500);
  });
  it("never serves phase-hidden or unreferenced assets, and never exposes storage paths", async () => {
    const material = state.row.diagnosticJson.scenarios[0].materials[0];
    material.assetId = "private-asset"; material.type = "image"; material.altText = "accessible table";
    material.displayAt = "preparation"; material.reopenDuringConversation = false;
    state.row.diagnosticHash = diagnosticHash(state.row.diagnosticJson);
    await request(app).get(`${base}/media/private-asset?phase=conversation`).expect(404);
    await request(app).get(`${base}/media/unknown?phase=preparation`).expect(404);
    const media = await request(app).get(`${base}/media/private-asset?phase=preparation`).expect(200);
    expect(media.headers["cache-control"]).toBe("private, no-store");
    expect(media.headers["x-content-type-options"]).toBe("nosniff");
    await request(app).get("/api/storage/objects/private-storage-path").expect(404);
    await request(app).post("/api/v1/assessment-media/uploads").send({ contentType: "image/png" }).expect(401);
    state.actor = "owner";
    await request(app).post("/api/v1/assessment-media/uploads").send({ contentType: "text/html" }).expect(400);
    await request(app).post("/api/v1/assessment-media/uploads").send({ contentType: "image/png" }).expect(200);
  });
});
