import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Network, Search, Sparkles } from "lucide-react";
import {
  commitScenarioGraph, composeScenarioGraph, getGetContentQueryKey, getListContentQueryKey,
  researchScenarioMaterial, type ScenarioGraphDraft, type ScenarioMaterial,
  type ScenarioResearchInput, type ScenarioResearchResult,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ScenarioGraphEditor } from "@/components/scenario-studio/graph-editor";
import { ScenarioStoryboard } from "@/components/scenario-studio/storyboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const steps = ["작성 브리프", "자료와 소재", "시나리오 그래프", "장면 편집", "검토 및 저장"] as const;
const kindLabels: Record<ScenarioMaterial["kind"], string> = {
  event: "사건", situation: "상황", evidence: "관련 자료", tradeoff: "트레이드오프",
  conflict: "갈등", relationship: "인간관계", opposition: "대립 문제",
};
const emptyBrief = { industry: "", organization: "", focus: "" };

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "data" in error) {
    const { data } = error;
    if (typeof data === "object" && data && "error" in data && typeof data.error === "string") return data.error;
  }
  return "작업을 완료하지 못했습니다. 입력을 확인하고 다시 시도하세요.";
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function ScenarioStudio() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<ScenarioResearchInput>(emptyBrief);
  const [research, setResearch] = useState<ScenarioResearchResult | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [direction, setDirection] = useState("");
  const [draft, setDraft] = useState<ScenarioGraphDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");

  const go = (next: number) => { setError(""); setStep(next); };
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const validBrief = Boolean(brief.industry.trim() && brief.organization.trim());
  const changeBrief = (patch: Partial<ScenarioResearchInput>) => {
    setBrief({ ...brief, ...patch });
    setResearch(null);
    setSelected([]);
    setSelectedSources([]);
  };
  const collect = () => run(async () => {
    const result = await researchScenarioMaterial(brief);
    setResearch(result);
    setSelected([]);
    setSelectedSources([]);
    go(1);
  });
  const compose = () => run(async () => {
    const candidates = research?.candidates.filter((_, index) => selected.includes(index)) ?? [];
    const usedSources = new Set([...selectedSources, ...candidates.flatMap(({ sourceIds }) => sourceIds)]);
    const sources = research?.sources.filter(({ id }) => usedSources.has(id)) ?? [];
    const result = await composeScenarioGraph({ brief, candidates, sources, direction });
    setDraft(result);
    go(2);
  });
  const commit = () => run(async () => {
    if (!draft) return;
    const graph = await commitScenarioGraph(draft);
    queryClient.setQueryData(getGetContentQueryKey(graph.id), graph);
    void queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });
    navigate(`/content/${graph.id}`);
  });

  return <Layout breadcrumbs={[{ label: "ContentX", href: "/" }, { label: "새 시나리오" }]}>
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <Link href="/assessments/new" className="text-sm text-primary underline underline-offset-4">평가 템플릿으로 시작</Link>
        <h1 className="text-3xl font-bold tracking-tight">시나리오 자유 작성</h1>
      </header>
      <nav aria-label="작성 단계" className="grid gap-1 sm:grid-cols-5">
        {steps.map((label, index) => <Button key={label} variant={index === step ? "default" : "outline"} size="sm"
          aria-current={index === step ? "step" : undefined} disabled={busy || (index === 1 && !validBrief) || (index >= 2 && !draft)}
          onClick={() => go(index)}>{label}</Button>)}
      </nav>

      <h2 className="text-xl font-semibold">{steps[step]}</h2>
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p>}
      {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />
        {step < 2 ? "AI 작업 중입니다. 결과를 기다리는 동안 입력이 유지됩니다." : "시나리오를 저장하고 있습니다."}</p>}

      <fieldset disabled={busy} className="min-w-0 space-y-6">
        {step === 0 && <section className="max-w-3xl space-y-4 rounded-xl border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">산업 분야<Input maxLength={100} placeholder="예: 반도체 제조" value={brief.industry} onChange={(event) => changeBrief({ industry: event.target.value })} /></label>
            <label className="block space-y-1 text-sm">조직·부서<Input maxLength={120} placeholder="예: 글로벌 품질보증팀" value={brief.organization} onChange={(event) => changeBrief({ organization: event.target.value })} /></label>
          </div>
          <label className="block space-y-1 text-sm">다루고 싶은 주제 또는 제약<Textarea maxLength={2000} rows={4} placeholder="예: 고객 납기와 품질 기준이 충돌하는 긴급 회의. 팀장과 현장 책임자의 목표를 다르게 설정." value={brief.focus} onChange={(event) => changeBrief({ focus: event.target.value })} /></label>
          <p className="text-xs text-muted-foreground">자료를 찾을 때 산업과 조직명이 외부 검색에 사용됩니다. 비공개 조직은 일반 명칭을 사용하세요.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!validBrief || busy} onClick={() => void collect()}><Search className="mr-2 h-4 w-4" />자료 수집 및 후보 제안</Button>
            <Button variant="outline" disabled={!validBrief || busy} onClick={() => go(1)}>소재 직접 입력</Button>
          </div>
        </section>}

        {step === 1 && <section className="space-y-5">
          {research && <div className="space-y-3">
            <h3 className="font-semibold">참고 자료</h3>
            {research.sources.length ? <div className="grid gap-2 md:grid-cols-2">
              {research.sources.map(({ id, title, url, excerpt }) => <article key={id} className="rounded-md border bg-card p-3 text-sm">
                <a className="font-medium text-primary underline" href={url} target="_blank" rel="noreferrer">{title}</a>
                <p className="mt-1 text-muted-foreground">{excerpt}</p>
                <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={selectedSources.includes(id)} onChange={() => setSelectedSources(toggle(selectedSources, id))} /> 초안 참고 자료에 포함</label>
              </article>)}
            </div> : <p className="text-sm text-muted-foreground">수집된 출처가 없습니다. 아래 후보는 창작 가설입니다.</p>}
            <h3 className="font-semibold">소재 후보</h3>
            <p className="text-sm text-muted-foreground">함께 쓰고 싶은 소재를 고르세요. 출처가 연결된 후보는 해당 자료도 함께 전달됩니다.</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {research.candidates.map((candidate, index) => <article key={index} className="space-y-2 rounded-lg border bg-card p-4">
                <label className="flex cursor-pointer items-start gap-2">
                  <input className="mt-1" type="checkbox" checked={selected.includes(index)} onChange={() => setSelected(toggle(selected, index))} />
                  <span><span className="block text-xs text-muted-foreground">{kindLabels[candidate.kind]}</span><strong>{candidate.title}</strong></span>
                </label>
                <p className="text-sm">{candidate.detail}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {candidate.sourceIds.length ? research.sources.filter(({ id }) => candidate.sourceIds.includes(id)).map(({ id, title, url }) => <a key={id} href={url} target="_blank" rel="noreferrer" className="underline">{title}</a>) : "창작 가설"}
                </div>
              </article>)}
            </div>
          </div>}
          <label className="block space-y-1 text-sm">직접 추가할 상황·인물·작성 방향
            <Textarea maxLength={4000} rows={4} value={direction} onChange={(event) => setDirection(event.target.value)} placeholder="예: 영업팀이 48시간 안에 결정을 요구한다. 품질 책임자는 이전 리콜 경험을 숨기고 있다." />
          </label>
          <Button disabled={!validBrief || (!selected.length && !direction.trim()) || busy} onClick={() => void compose()}>
            <Sparkles className="mr-2 h-4 w-4" />{draft ? "새 그래프 초안으로 교체" : "선택한 소재로 그래프 만들기"}
          </Button>
        </section>}

        {step === 2 && draft && <ScenarioGraphEditor draft={draft} onChange={setDraft} />}
        {step === 3 && draft && <ScenarioStoryboard draft={draft} onChange={setDraft} />}
        {step === 4 && draft && <section className="max-w-3xl space-y-4 rounded-lg border bg-card p-5">
          <label className="block space-y-1 text-sm">시나리오 제목<Input maxLength={200} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <p className="whitespace-pre-wrap text-sm">{draft.entities.find(({ kind }) => kind === "narrative")?.description}</p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Network className="h-4 w-4" />노드 {draft.entities.length}개 · 관계 {draft.relationships.length}개</p>
          <Button disabled={!draft.title.trim() || busy} onClick={() => void commit()}>콘텐츠 그래프 저장</Button>
        </section>}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        {step > 0 && <Button disabled={busy} variant="outline" onClick={() => go(step - 1)}><ArrowLeft className="mr-2 h-4 w-4" />이전</Button>}
        {draft && step >= 2 && step < 4 && <Button disabled={busy} onClick={() => go(step + 1)}>{steps[step + 1]}<ArrowRight className="ml-2 h-4 w-4" /></Button>}
      </div>
    </div>
  </Layout>;
}
