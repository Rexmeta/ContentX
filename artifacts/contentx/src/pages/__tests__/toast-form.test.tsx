// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { Toaster } from "@/components/ui/toaster";
import { toast, useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AssessmentVersionForm } from "../assessments/assessment-version-form";

vi.mock("@workspace/api-client-react", () => ({
  useListScenarios: () => ({ data: [], isLoading: false }),
}));

function Harness() {
  const { dismiss } = useToast();
  return <>
    <button onClick={() => dismiss()}>모두 닫기</button>
    <Dialog defaultOpen>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>새 평가</DialogTitle>
        <AssessmentVersionForm packageId="" version={1} showPackageId onSubmit={vi.fn()} />
      </DialogContent>
    </Dialog>
    <Toaster />
  </>;
}

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("form error notifications", () => {
  it("can be dismissed while an assessment dialog is open without losing input", () => {
    render(<Harness />);
    const title = screen.getByPlaceholderText("고객 지원 roleplay");
    fireEvent.change(title, { target: { value: "고객 상담 평가" } });
    act(() => { toast({ title: "입력 오류", description: "값을 확인하세요", variant: "destructive" }); });
    const close = screen.getByRole("button", { name: "알림 닫기", hidden: true });
    expect(close).toHaveAttribute("type", "button");
    expect(close).toHaveClass("opacity-100");
    expect(close.closest("ol")).toHaveClass("pointer-events-none");
    fireEvent.change(title, { target: { value: "고객 상담 평가 수정" } });
    expect(title).toHaveValue("고객 상담 평가 수정");
    fireEvent.click(close);
    expect(screen.queryByText("입력 오류")).not.toBeInTheDocument();
    expect(title).toHaveValue("고객 상담 평가 수정");
  });

  it("dismisses notifications automatically after five seconds", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => { toast({ title: "자동 닫힘 확인" }); });
    expect(screen.getByText("자동 닫힘 확인")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(5100); });
    expect(screen.queryByText("자동 닫힘 확인")).not.toBeInTheDocument();
  });
});
