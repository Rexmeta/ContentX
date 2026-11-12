// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

const { saveMutate, participantHook, removeQueries, forbidden } = vi.hoisted(() => ({
  saveMutate: vi.fn(),
  participantHook: vi.fn(),
  removeQueries: vi.fn(),
  forbidden: (name: string) => () => { throw new Error(`${name} must not be called`); },
}));

vi.mock("@workspace/api-client-react", () => ({
  useCreateAssessmentDiagnosticVersion: () => ({ isPending: false, mutate: saveMutate }),
  requestAssessmentMediaUpload: vi.fn(),
  getGetAssessmentDiagnosticQueryKey: () => ["diagnostic"],
  getGetAssessmentPackageVersionQueryKey: () => ["version"],
  getGetAssessmentQueryKey: () => ["assessment"],
  getListAssessmentsQueryKey: () => ["assessments"],
  useGetAssessmentParticipantPreview: (...args: unknown[]) => participantHook(...args),
  getGetAssessmentParticipantPreviewQueryKey: (...args: unknown[]) => ["participant", ...args],
  useGetAssessment: forbidden("useGetAssessment"),
  useGetAssessmentPackageVersion: forbidden("useGetAssessmentPackageVersion"),
  useGetAssessmentDiagnostic: forbidden("useGetAssessmentDiagnostic"),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(), removeQueries }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("wouter", () => ({
  useRoute: () => [true, { id: "pkg-1" }],
  useSearch: () => "version=2&phase=conversation",
  useLocation: () => ["/assessments/pkg-1/participant", vi.fn()],
  Link: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

import { DiagnosticEditor } from "../assessments/diagnostic-editor";
import ParticipantPreview from "../assessments/participant";
import { initDiagnosticFromPackage } from "@/lib/diagnostic";

const pkg: any = {
  packageKey: "pkg", version: "1",
  scenarios: [
    { key: "s1", title: "S1", context: { playerRole: "팀장", situation: "상황" }, objectives: ["목표"], personas: [{ name: "김", role: "팀원", isPrimary: true }], simulation: { initialPrompt: "시작" }, evaluation: { dimensions: [{ key: "listen", label: "경청", criteria: ["질문한다"] }, { key: "plan", label: "계획", criteria: [] }] } },
    { key: "s2", title: "S2", context: { playerRole: "리더", situation: "상황2" }, objectives: [], personas: [], simulation: {}, evaluation: { dimensions: [{ key: "q", label: "품질", criteria: [] }] } },
  ],
};
const longText = "가".repeat(80);
const initial: any = {
  schemaVersion: "contentx.diagnostic.v1",
  scenarios: [{
    scenarioKey: "s1",
    briefing: { roleAndAuthority: longText, relationship: longText, reason: longText, goals: longText, preparationSeconds: 90 },
    materials: [{ id: "mat-fixed", title: "메일", type: "text", displayAt: "both", reopenDuringConversation: true, text: "본문" }],
    private: { hiddenCauses: "비밀 원인", internalIntent: "", modelAnswer: "", instructions: "" },
    cues: [{ id: "cue-fixed", type: "discovery", intent: "원인 탐색", fact: "사실", criterionIds: ["crit-fixed"] }],
    criteria: [{ id: "crit-fixed", dimensionKey: "listen", competencyName: "경청", observableBehavior: "질문" }],
  }],
};
const renderEditor = (data = initial) => render(<DiagnosticEditor assessmentId="pkg-1" sourceVersion={1} pkg={pkg} initial={data} onCancel={vi.fn()} onSaved={vi.fn()} />);

beforeEach(() => { saveMutate.mockReset(); participantHook.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("diagnostic editor", () => {
  it("reopens with stored IDs intact and saves a successor from the selected version", () => {
    renderEditor();
    fireEvent.change(screen.getByTestId("input-material-title-0"), { target: { value: "수정된 메일" } });
    fireEvent.click(screen.getByTestId("button-save-diagnostic"));
    const call = saveMutate.mock.calls[0][0];
    expect(call.id).toBe("pkg-1");
    expect(call.version).toBe(1);
    const s = call.data.scenarios[0];
    expect(s.materials[0]).toMatchObject({ id: "mat-fixed", title: "수정된 메일" });
    expect(s.cues[0].id).toBe("cue-fixed");
    expect(s.criteria[0].id).toBe("crit-fixed");
  });

  it("mints a material ID exactly once at creation", () => {
    const spy = vi.spyOn(crypto, "randomUUID").mockReturnValue("1111-2222-3333-4444-5555" as any);
    renderEditor();
    fireEvent.click(screen.getByTestId("button-add-material-text"));
    expect(spy).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByTestId("input-material-title-1"), { target: { value: "a" } });
    fireEvent.change(screen.getByTestId("input-material-text-1"), { target: { value: "b" } });
    expect(spy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("button-save-diagnostic"));
    expect(saveMutate.mock.calls[0][0].data.scenarios[0].materials[1].id).toBe("mat-1111-2222-3333-4444-5555");
  });

  it("treats briefing length and preparation time as a recommendation, not a cap", () => {
    const short = structuredClone(initial);
    short.scenarios[0].briefing = { roleAndAuthority: "짧음", relationship: "짧음", reason: "짧음", goals: "짧음", preparationSeconds: 300 };
    renderEditor(short);
    expect(screen.getByTestId("text-briefing-advice")).toHaveTextContent("권장 범위 밖이지만 저장할 수 있습니다");
    expect(screen.getByTestId("button-save-diagnostic")).toBeEnabled();
    fireEvent.click(screen.getByTestId("button-save-diagnostic"));
    expect(saveMutate).toHaveBeenCalledTimes(1);
  });

  it("blocks save when a criterion is removed and its cue loses every connection", () => {
    renderEditor();
    fireEvent.click(screen.getByTestId("button-delete-criterion-0"));
    expect(screen.getByTestId("list-diagnostic-issues")).toBeInTheDocument();
    expect(screen.getByTestId("button-save-diagnostic")).toBeDisabled();
  });

  it("initializes legacy packages for every scenario using existing dimension keys", () => {
    const d = initDiagnosticFromPackage(pkg);
    expect(d.scenarios.map((s) => s.scenarioKey)).toEqual(["s1", "s2"]);
    expect(d.scenarios[0].criteria.map((c) => c.dimensionKey)).toEqual(["listen", "plan"]);
    expect(d.scenarios[1].criteria[0].dimensionKey).toBe("q");
  });
});

describe("participant preview", () => {
  it("uses only the participant hook and renders accessible, API-routed materials", () => {
    participantHook.mockReturnValue({
      isLoading: false, error: null,
      data: { schemaVersion: "contentx.participant.v1", phase: "conversation", scenarios: [{
        scenarioKey: "s1",
        briefing: { roleAndAuthority: "팀장", relationship: "팀원", reason: "이유", goals: "목표", preparationSeconds: 90 },
        materials: [
          { id: "t", title: "실적", type: "table", displayAt: "conversation", reopenDuringConversation: false, text: "요약", table: { columns: ["월", "건수"], rows: [["1월", "12"]] } },
          { id: "i", title: "현장", type: "image", displayAt: "both", reopenDuringConversation: true, text: "사진 설명", assetId: "asset-9", altText: "정리되지 않은 창고" },
        ],
      }] },
    });
    render(<ParticipantPreview />);
    expect(participantHook).toHaveBeenCalledWith("pkg-1", 2, { phase: "conversation" }, expect.anything());
    expect(removeQueries).toHaveBeenCalledWith({ predicate: expect.any(Function) });
    const predicate = removeQueries.mock.lastCall![0].predicate;
    expect(predicate({ queryKey: ["version"] })).toBe(true);
    expect(predicate({ queryKey: ["participant"] })).toBe(false);
    expect(screen.getByRole("columnheader", { name: "월" })).toHaveAttribute("scope", "col");
    const img = screen.getByAltText("정리되지 않은 창고");
    expect(img.getAttribute("src")).toBe("/api/v1/assessments/pkg-1/versions/2/media/asset-9?phase=conversation");
    expect(screen.queryByText("비밀 원인")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-phase-conversation")).toHaveAttribute("aria-checked", "true");
  });
});
