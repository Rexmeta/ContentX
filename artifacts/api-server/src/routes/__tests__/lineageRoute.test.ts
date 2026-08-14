/**
 * Route wiring for GET /v1/evaluations/:id/lineage — verifies the HTTP
 * status mapping (200 resolved / 404 unknown evaluation / 409 broken chain)
 * with the lineage resolver mocked at the domain boundary.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../../domains/evaluation/lineageService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../domains/evaluation/lineageService")
    >();
  return { ...actual, resolveEvaluationLineage: vi.fn() };
});

import { resolveEvaluationLineage, LineageBrokenError } from "../../domains/evaluation/lineageService";
import { EvaluationNotFoundError } from "../../domains/evaluation/model";
import app from "../../app";

const mockResolve = vi.mocked(resolveEvaluationLineage);

const lineage = {
  evaluationId: "evaluation_1",
  kind: "outcome",
  simulationId: "simulation_1",
  simulationSeed: 42,
  agents: [
    {
      agentId: "agent_1",
      snapshotId: "snapshot_1",
      characterId: "character_1",
      samplingRunId: "samplingrun_1",
      populationId: "population_1",
      populationVersion: 3,
      seed: 42,
      importId: "content_1",
      matraixId: "pop.demo",
      sourceUri: "matraix://exports/demo",
    },
  ],
};

describe("GET /v1/evaluations/:id/lineage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 200 with the resolved chain, matching the generated contract", async () => {
    mockResolve.mockResolvedValue(lineage);
    const res = await request(app).get("/api/v1/evaluations/evaluation_1/lineage");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(lineage);
    expect(mockResolve).toHaveBeenCalledWith("evaluation_1");
  });

  it("returns 404 for an unknown evaluation", async () => {
    mockResolve.mockRejectedValue(new EvaluationNotFoundError("nope"));
    const res = await request(app).get("/api/v1/evaluations/nope/lineage");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it("returns 409 when a stored reference no longer resolves", async () => {
    mockResolve.mockRejectedValue(
      new LineageBrokenError('Agent "agent_1" references missing snapshot "snapshot_1".'),
    );
    const res = await request(app).get("/api/v1/evaluations/evaluation_1/lineage");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("missing snapshot");
  });
});
