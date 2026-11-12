// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { ScenarioGraphDraft } from "@workspace/api-client-react";
import ScenarioStudio from "../scenario-studio";

const { research, compose, commit } = vi.hoisted(() => ({ research: vi.fn(), compose: vi.fn(), commit: vi.fn() }));
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...await importOriginal<typeof import("@workspace/api-client-react")>(),
  researchScenarioMaterial: research, composeScenarioGraph: compose, commitScenarioGraph: commit,
}));
vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

it("takes selected research through graph edits, scene ordering, and canonical save", async () => {
  const source = { id: "entity_source", title: "품질 기준", url: "https://example.com/quality", excerpt: "검수 조건" };
  const material = { kind: "tradeoff", title: "검수 대 납기", detail: "검사 비용과 지연 부담", sourceIds: [source.id] };
  const draft: ScenarioGraphDraft = {
    title: "출하 결정", sourcePrompt: "제조 / 품질팀",
    entities: [
      { id: "entity_narrative", kind: "narrative", name: "출하 결정", description: "두 팀의 이해관계가 충돌한다." },
      { id: "entity_a", kind: "action", name: "전화", attributes: { order: 1, seconds: 10, beat: "hook", line: "" } },
      { id: "entity_b", kind: "action", name: "회의", attributes: { order: 2, seconds: 20, beat: "decision", line: "" } },
    ],
    relationships: [],
  };
  research.mockResolvedValue({ provider: "brave", sources: [source], candidates: [material] });
  compose.mockResolvedValue(draft);
  commit.mockResolvedValue({ id: "content_test" });
  const location = memoryLocation({ path: "/scenario-studio", record: true });
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient()}>
    <Router hook={location.hook}><ScenarioStudio /></Router>
  </QueryClientProvider>);

  await user.type(screen.getByLabelText("산업 분야"), "제조");
  await user.type(screen.getByLabelText("조직·부서"), "품질팀");
  await user.click(screen.getByRole("button", { name: "자료 수집 및 후보 제안" }));
  await user.click(await screen.findByRole("checkbox", { name: /검수 대 납기/ }));
  await user.type(screen.getByLabelText("직접 추가할 상황·인물·작성 방향"), "고객 납기 포함");
  await user.click(screen.getByRole("button", { name: "선택한 소재로 그래프 만들기" }));
  const editor = await screen.findByRole("region", { name: "시나리오 지식 그래프" });
  expect(compose).toHaveBeenCalledWith(expect.objectContaining({ candidates: [material], sources: [source], direction: "고객 납기 포함" }));

  await user.click(within(editor).getByRole("button", { name: "추가", exact: true }));
  const name = within(editor).getByLabelText("이름");
  await user.clear(name);
  await user.type(name, "고객사 담당자");
  await user.click(within(screen.getByRole("navigation", { name: "작성 단계" })).getByRole("button", { name: "장면 편집" }));
  await user.click(screen.getByRole("button", { name: "장면 2 앞으로" }));
  await user.click(within(screen.getByRole("navigation", { name: "작성 단계" })).getByRole("button", { name: "검토 및 저장" }));
  await user.click(screen.getByRole("button", { name: "콘텐츠 그래프 저장" }));

  expect(commit).toHaveBeenCalledWith(expect.objectContaining({ entities: expect.arrayContaining([
    expect.objectContaining({ name: "고객사 담당자", kind: "character" }),
    expect.objectContaining({ id: "entity_b", attributes: expect.objectContaining({ order: 1 }) }),
  ]) }));
  expect(location.history?.at(-1)).toBe("/content/content_test");
});
