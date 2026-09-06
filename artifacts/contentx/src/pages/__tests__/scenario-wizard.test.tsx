// @vitest-environment jsdom
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refetch = vi.fn();
const mutateAsync = vi.fn();
const invalidateQueries = vi.fn();
const setLocation = vi.fn();
const toast = vi.fn();

let templateQuery: Record<string, unknown>;

vi.mock("@workspace/api-client-react", () => ({
  getListAssessmentsQueryKey: () => ["assessments"],
  useListAssessmentTemplates: () => templateQuery,
  useCreateAssessmentFromTemplate: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/assessments/new", setLocation],
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));
vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

const template = {
  id: "tmpl-ldr-01",
  title: "성과 부진 팀원 면담",
  subtitle: "신임 리더의 면담",
  category: "leadership",
  categoryLabel: "리더십",
  targetRole: "신임 팀장",
  difficulty: "intermediate",
  estimatedTime: 15,
  description: "팀원과 개선 계획을 합의합니다.",
  learningObjectives: ["원인 파악"],
  dramatic: {
    logline: "면담",
    synopsis: "성과가 낮아진 팀원과 대화합니다.",
    theme: "신뢰",
    stakes: "일정 지연",
    twist: "번아웃",
    acts: [],
    characters: [{
      name: "이민혁",
      role: "시니어 담당자",
      motivation: "회복",
      traits: ["방어적"],
      initialDialogue: "부르셨습니까?",
      behaviorGuidelines: ["경청하면 답한다"],
    }],
  },
  competencies: [{ key: "coaching", name: "코칭", description: "성장을 지원한다" }],
  evaluation: {
    dimensions: [{ key: "empathy", label: "공감", weight: 1, criteria: ["경청한다"] }],
    defaultPassingScore: 70,
  },
  simulation: { mode: "roleplay", defaultInitialPrompt: "시작", rules: [] },
  termination: { conditions: ["합의"], maxTurns: 12, targetTurns: 8, minValidTurns: 4 },
};

let ScenarioWizard: React.ComponentType;

beforeEach(async () => {
  templateQuery = {
    data: [template],
    isLoading: false,
    isFetching: false,
    isError: false,
    isSuccess: true,
    error: null,
    refetch,
  };
  refetch.mockReset();
  mutateAsync.mockReset();
  invalidateQueries.mockReset();
  setLocation.mockReset();
  toast.mockReset();
  window.history.replaceState({}, "", "/assessments/new");
  if (!ScenarioWizard) ScenarioWizard = (await import("../assessments/scenario-wizard")).default;
});

describe("Scenario wizard", () => {
  it("keeps the page usable when the template payload is not an array", () => {
    templateQuery = {
      ...templateQuery,
      data: { error: "Assessment package not found." },
    };

    render(<ScenarioWizard />);

    expect(screen.getByTestId("scenario-template-error")).toHaveTextContent(
      "템플릿 응답 형식이 올바르지 않습니다",
    );
    expect(screen.queryByText("templates.find is not a function")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("turns a missing template route into a recoverable message", () => {
    templateQuery = {
      ...templateQuery,
      data: undefined,
      isError: true,
      isSuccess: false,
      error: { status: 404, data: { error: "Assessment package not found." } },
    };

    render(<ScenarioWizard />);

    expect(screen.getByTestId("scenario-template-error")).toHaveTextContent(
      "시나리오 템플릿 서비스를 찾을 수 없습니다",
    );
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeEnabled();
  });

  it("creates one draft and navigates to its detail page", async () => {
    let resolveCreation!: (value: unknown) => void;
    mutateAsync.mockReturnValue(new Promise((resolve) => {
      resolveCreation = resolve;
    }));

    render(<ScenarioWizard />);
    await screen.findByText("성과 부진 팀원 면담");

    fireEvent.click(screen.getByRole("button", { name: /다음: 회사 상황 입력/ }));
    fireEvent.change(screen.getByLabelText(/^회사 \/ 조직명/), {
      target: { value: "반도체 생산기술팀" },
    });
    fireEvent.change(screen.getByLabelText("상대역 회사 / 조직명"), {
      target: { value: "품질보증팀" },
    });
    fireEvent.change(screen.getByLabelText("상대역의 입장"), {
      target: { value: "재발 방지 대책이 먼저 확정되어야 한다" },
    });
    fireEvent.click(screen.getByRole("button", { name: /다음: 시나리오 확인/ }));

    const createButton = screen.getByRole("button", { name: /시나리오 만들기/ });
    fireEvent.click(createButton);
    fireEvent.click(createButton);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      data: expect.objectContaining({
        counterpartOrganization: "품질보증팀",
        counterpartStance: "재발 방지 대책이 먼저 확정되어야 한다",
      }),
    });

    await act(async () => {
      resolveCreation({
        assessmentId: "assessment-1",
        version: 1,
        status: "draft",
        title: "성과 부진 팀원 면담 [반도체 생산기술팀]",
        packageKey: "leadership-assessment",
        contentHash: "a".repeat(64),
      });
    });

    await waitFor(() => {
      expect(setLocation).toHaveBeenCalledWith("/assessments/assessment-1?version=1");
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["assessments"] });
  });

  it("keeps entered values and offers a retry when deep generation fails quality validation", async () => {
    mutateAsync.mockRejectedValue({
      status: 422,
      data: { error: "quality contract failed", diagnostics: ["synopsis: Too short"] },
    });

    render(<ScenarioWizard />);
    await screen.findByText("성과 부진 팀원 면담");
    fireEvent.click(screen.getByRole("button", { name: /다음: 회사 상황 입력/ }));
    fireEvent.change(screen.getByLabelText(/^회사 \/ 조직명/), { target: { value: "품질혁신실" } });
    fireEvent.click(screen.getByRole("button", { name: /다음: 시나리오 확인/ }));
    fireEvent.click(screen.getByRole("button", { name: /시나리오 만들기/ }));

    await waitFor(() => expect(screen.getByTestId("scenario-generation-state")).toHaveTextContent("품질 검토에서 초안이 보류되었습니다 (422)"));
    expect(screen.getByTestId("scenario-generation-state")).toHaveTextContent("synopsis: Too short");
    expect(screen.getByTestId("scenario-generation-state")).toHaveTextContent("입력한 회사 상황과 상대역 설정은 유지됩니다");
    expect(screen.getAllByText("품질혁신실").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("button-retry-scenario-generation"));
    expect(mutateAsync).toHaveBeenCalledTimes(2);
  });
});