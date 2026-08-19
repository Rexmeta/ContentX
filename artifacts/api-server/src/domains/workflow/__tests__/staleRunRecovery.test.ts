/**
 * Stale-run recovery: a workflow persisted as "running" whose row has not
 * been touched for STALE_RUNNING_MS was interrupted mid-execution (server
 * restart / dropped request) and must be repaired to failed-retryable state
 * on read. Repository writes are mocked; only the recovery logic is tested.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WorkflowStep } from "../model";

vi.mock("../repository", () => ({
  updateWorkflow: vi.fn().mockResolvedValue({}),
  updateWorkflowIfUntouched: vi.fn().mockResolvedValue({}),
}));

import * as repo from "../repository";
import { recoverStaleRun, STALE_RUNNING_MS } from "../executor";

const mockUpdate = vi.mocked(repo.updateWorkflowIfUntouched);

function steps(): WorkflowStep[] {
  return [
    {
      id: "s1", type: "auto", title: "완료 단계", description: "",
      importance: "required", status: "complete", input: [], output: [],
      dependencies: [], binding: null, result: null, error: null,
    },
    {
      id: "s2", type: "auto", title: "끊긴 단계", description: "",
      importance: "required", status: "running", input: [], output: [],
      dependencies: ["s1"], binding: null, result: null, error: null,
    },
    {
      id: "s3", type: "auto", title: "대기 단계", description: "",
      importance: "required", status: "pending", input: [], output: [],
      dependencies: ["s2"], binding: null, result: null, error: null,
    },
  ] as unknown as WorkflowStep[];
}

const staleDate = () => new Date(Date.now() - STALE_RUNNING_MS - 60_000);

describe("recoverStaleRun", () => {
  beforeEach(() => mockUpdate.mockClear());

  it("marks long-stale running steps failed and persists recomputed status", async () => {
    const s = steps();
    const observed = staleDate();
    const recovered = await recoverStaleRun({
      id: "workflow_1", status: "running", updatedAt: observed, steps: s,
    });
    expect(recovered).toBe(true);
    expect(s[1]!.status).toBe("failed");
    expect(s[1]!.error).toContain("중단");
    // Conditional write keyed on the observed updatedAt — never a blind update.
    expect(mockUpdate).toHaveBeenCalledWith("workflow_1", observed, {
      steps: s,
      status: "failed",
    });
  });

  it("does not touch a recently-updated running workflow", async () => {
    const recovered = await recoverStaleRun({
      id: "workflow_1", status: "running", updatedAt: new Date(), steps: steps(),
    });
    expect(recovered).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("ignores non-running workflows and running status without running steps", async () => {
    expect(
      await recoverStaleRun({ id: "w", status: "complete", updatedAt: staleDate(), steps: steps() }),
    ).toBe(false);
    const s = steps();
    s[1]!.status = "complete";
    expect(
      await recoverStaleRun({ id: "w", status: "running", updatedAt: staleDate(), steps: s }),
    ).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
