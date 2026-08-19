// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkflowGenerationProgress } from "../workflow-generation-progress";

describe("WorkflowGenerationProgress", () => {
  it("renders completed, active, and failed safe generation phases", () => {
    render(
      <WorkflowGenerationProgress
        testId="progress"
        progress={{
          runId: "run-1",
          startedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:03.000Z",
          events: [
            {
              phase: "outline",
              label: "이야기 구조를 설계했어요.",
              status: "complete",
              at: "2026-01-01T00:00:01.000Z",
            },
            {
              phase: "characters",
              label: "인물과 갈등을 구성하고 있어요.",
              status: "running",
              at: "2026-01-01T00:00:02.000Z",
            },
            {
              phase: "save",
              label: "결과 저장에 실패했어요.",
              status: "failed",
              at: "2026-01-01T00:00:03.000Z",
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("progress")).toBeInTheDocument();
    expect(screen.getByText("이야기 구조를 설계했어요.")).toBeInTheDocument();
    expect(
      screen.getByText("인물과 갈등을 구성하고 있어요."),
    ).toBeInTheDocument();
    expect(screen.getByText("결과 저장에 실패했어요.")).toBeInTheDocument();
  });
});