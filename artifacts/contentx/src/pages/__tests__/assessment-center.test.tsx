// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

const immutablePackage = {
  packageKey: "support-basics",
  version: 1,
  metadata: { title: "Support basics", description: "Handle a customer safely.", locale: "ko-KR" },
  provenance: { contentHash: "a".repeat(64) },
  competencies: [{ key: "empathy", name: "Empathy" }],
  scenarios: [{
    key: "refund",
    title: "Refund request",
    description: "A customer requests a refund.",
    competencies: ["Empathy"],
    personas: [{ key: "concerned-customer-1", name: "Concerned customer", isPrimary: true }],
    simulation: { mode: "roleplay" },
    termination: { maxTurns: 10 },
    evaluation: { dimensions: [{ key: "quality", label: "Quality", weight: 1, criteria: [] }] },
  }],
};

let assessmentStatus = "draft";
let history: any[] = [];
let validationResult = { valid: true, diagnostics: [] as { path: string; message: string }[] };
let publishResult: any = { status: "published", response: { importedScenarioCount: 1 } };
let scenarioRecords: any[] = [];
const createMutate = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useListScenarios: () => ({ data: scenarioRecords, isLoading: false }),
  useCreateAssessmentPackageVersion: () => ({
    isPending: false,
    mutate: createMutate,
  }),
  useGetAssessment: () => ({
    data: { id: "assessment-1", status: assessmentStatus, currentVersion: 1, versions: [{ id: "v1", version: 1, status: assessmentStatus }] },
  }),
  useGetAssessmentPackageVersion: () => ({ data: immutablePackage, isLoading: false }),
  useListAssessmentPackagePublicationHistory: () => ({ data: history, isLoading: false }),
  useValidateAssessmentPackageVersion: () => ({
    isPending: false,
    mutate: (_args: unknown, callbacks: any) => callbacks.onSuccess(validationResult),
  }),
  usePublishAssessmentPackageVersionToRoleplayX: () => ({
    isPending: false,
    mutate: (_args: unknown, callbacks: any) => callbacks.onSuccess(publishResult),
  }),
  getGetAssessmentQueryKey: () => ["assessment"],
  getGetAssessmentPackageVersionQueryKey: () => ["version"],
  getListAssessmentPackagePublicationHistoryQueryKey: () => ["history"],
  getListAssessmentsQueryKey: () => ["assessments"],
}));

vi.mock("wouter", () => ({
  useRoute: () => [true, { id: "assessment-1" }],
  useLocation: () => ["/assessments/assessment-1?version=1", vi.fn()],
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

let AssessmentDetail: React.ComponentType;

beforeEach(async () => {
  assessmentStatus = "draft";
  history = [];
  validationResult = { valid: true, diagnostics: [] };
  publishResult = { status: "published", response: { importedScenarioCount: 1 } };
  scenarioRecords = [];
  createMutate.mockReset();
  if (!AssessmentDetail) AssessmentDetail = (await import("../assessments/detail")).default;
});

describe("Assessment center", () => {
  it("keeps publishing disabled until a successful validation and displays diagnostics", () => {
    validationResult = { valid: false, diagnostics: [{ path: "scenarios[0].evaluation", message: "dimension is required" }] };
    render(<AssessmentDetail />);

    expect(screen.getByTestId("button-publish-assessment")).toBeDisabled();
    fireEvent.click(screen.getByTestId("button-validate-assessment"));

    expect(screen.getByTestId("status-validation-failed")).toBeVisible();
    expect(screen.getByTestId("list-validation-diagnostics")).toHaveTextContent(
      "scenarios[0].evaluation: dimension is required",
    );
    expect(screen.getByTestId("button-publish-assessment")).toBeDisabled();
  });

  it("keeps a successor-version action for published versions while hiding their validate and publish actions", () => {
    assessmentStatus = "published";
    history = [{ id: "publication-1", status: "succeeded", organizationId: "org-1", category: "support", attempt: 1, createdAt: "2026-01-01T00:00:00Z" }];
    render(<AssessmentDetail />);

    expect(screen.getByTestId("status-assessment-immutable")).toBeVisible();
    expect(screen.getByTestId("button-new-assessment-version")).toBeVisible();
    expect(screen.queryByTestId("button-validate-assessment")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-publish-assessment")).not.toBeInTheDocument();
    expect(screen.getByTestId("row-publish-history-publication-1")).toHaveTextContent("succeeded");
  });

  it("renders a safe publish failure detail alongside its history", () => {
    history = [{ id: "publication-failed", status: "failed", organizationId: "org-1", category: "support", attempt: 2, errorMessage: "RoleplayX gateway timeout", createdAt: "2026-01-01T00:00:00Z" }];
    publishResult = { status: "failed", errorCategory: "network" };
    render(<AssessmentDetail />);

    fireEvent.click(screen.getByTestId("button-validate-assessment"));
    fireEvent.click(screen.getByTestId("button-publish-assessment"));
    fireEvent.change(screen.getByTestId("input-publish-organization"), { target: { value: "org-1" } });
    fireEvent.change(screen.getByTestId("input-publish-category"), { target: { value: "support" } });
    fireEvent.click(screen.getByTestId("button-confirm-publish"));

    expect(screen.getByTestId("status-publish-failed")).toHaveTextContent("network");
    expect(screen.getByTestId("row-publish-history-publication-failed")).toHaveTextContent("RoleplayX gateway timeout");
  });

  it("derives each selected scenario primary persona from its saved characters", () => {
    scenarioRecords = [{
      id: "scenario-1", title: "Refund request", scenario: {
        characters: [{ name: "Concerned Customer", role: "customer", motivation: "Needs a refund" }],
      },
    }];
    render(<AssessmentDetail />);

    fireEvent.click(screen.getByTestId("button-new-assessment-version"));
    fireEvent.click(screen.getByTestId("checkbox-assessment-scenario-scenario-1"));
    fireEvent.change(screen.getByLabelText("역량"), { target: { value: "공감적 문제 해결" } });
    fireEvent.change(screen.getByTestId("input-assessment-evaluation-criteria"), { target: { value: "Addresses the request" } });
    fireEvent.click(screen.getByTestId("button-create-assessment-version"));

    expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({
      id: "assessment-1",
      data: expect.objectContaining({
        competencies: [expect.objectContaining({ key: expect.stringMatching(/^competency-[a-f0-9]{8}$/) })],
        scenarios: [expect.objectContaining({ scenarioId: "scenario-1", primaryPersonaKey: "concerned-customer-1" })],
      }),
    }), expect.any(Object));
  });
});