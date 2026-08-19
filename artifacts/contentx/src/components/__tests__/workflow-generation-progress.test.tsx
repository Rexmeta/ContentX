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
          checkpoints: [
            {
              kind: "input",
              title: "이번 단계에 사용한 내용",
              summary: "아이디어를 바탕으로 시작했습니다.",
              details: [{ label: "아이디어", value: "폐쇄된 연구소" }],
              at: "2026-01-01T00:00:01.000Z",
            },
            {
              kind: "preview",
              title: "현재까지 만들어진 결과",
              summary: "연구원들의 충돌이 중심인 초안입니다.",
              details: [{ label: "한 줄 소개", value: "서로 다른 목적이 충돌한다." }],
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
    expect(screen.getByText("이번 단계에 사용한 내용")).toBeInTheDocument();
    expect(screen.getByText("현재까지 만들어진 결과")).toBeInTheDocument();
    expect(screen.getByText("서로 다른 목적이 충돌한다.")).toBeInTheDocument();
  });

  it("shows legacy stored results but filters internal reasoning-shaped keys", () => {
    render(
      <WorkflowGenerationProgress
        testId="legacy-progress"
        progress={null}
        inputParams={{ idea: "우주 정거장" }}
        result={{
          title: "고립된 신호",
          systemPrompt: "do not expose",
          reasoning: "hidden chain",
          payload: {
            publicSummary: "공개 가능한 요약",
            reasoning: "nested hidden chain",
            providerTrace: "nested hidden trace",
          },
        }}
      />,
    );

    expect(screen.getByText("우주 정거장")).toBeInTheDocument();
    expect(screen.getByText("고립된 신호")).toBeInTheDocument();
    expect(screen.getByText(/공개 가능한 요약/)).toBeInTheDocument();
    expect(screen.queryByText("do not expose")).not.toBeInTheDocument();
    expect(screen.queryByText("hidden chain")).not.toBeInTheDocument();
    expect(screen.queryByText("nested hidden chain")).not.toBeInTheDocument();
    expect(screen.queryByText("nested hidden trace")).not.toBeInTheDocument();
  });
});