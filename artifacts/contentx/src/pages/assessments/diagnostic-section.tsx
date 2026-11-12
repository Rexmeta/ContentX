import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  exportAssessmentDiagnostic,
  getAssessmentPackageVersion,
  getGetAssessmentDiagnosticQueryKey,
  useGetAssessmentDiagnostic,
  type AssessmentScenarioPackageV1,
  type DiagnosticAuthoring,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, ExternalLink, EyeOff, FilePenLine, RotateCw, Sparkles } from "lucide-react";
import { SignedInGate, useAuthState } from "@/lib/auth-state";
import { MaterialView } from "@/components/diagnostic/material-view";
import { briefingAdvice, downloadJson, initDiagnosticFromPackage, reconcileWithPackage } from "@/lib/diagnostic";
import { DiagnosticEditor } from "./diagnostic-editor";

export function DiagnosticSection({ assessmentId, version, pkg, onSaved, onPresenceChange }: { assessmentId: string; version: number; pkg: AssessmentScenarioPackageV1; onSaved: (version: number) => void; onPresenceChange?: (hasDiagnostic: boolean) => void }) {
  return (
    <section data-testid="section-diagnostic" aria-labelledby="diagnostic-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="diagnostic-heading" className="text-base font-semibold">진단형 롤플레이</h2>
        <span className="tech-label text-muted-foreground">contentx.diagnostic.v1</span>
      </div>
      <SignedInGate reason="진단 편집과 작성자 미리보기에는 숨은 단서가 포함되어 있어 소유자만 볼 수 있습니다.">
        <DiagnosticAuthorPanel assessmentId={assessmentId} version={version} pkg={pkg} onSaved={onSaved} onPresenceChange={onPresenceChange} />
      </SignedInGate>
    </section>
  );
}

function DiagnosticAuthorPanel({ assessmentId, version, pkg, onSaved, onPresenceChange }: { assessmentId: string; version: number; pkg: AssessmentScenarioPackageV1; onSaved: (version: number) => void; onPresenceChange?: (hasDiagnostic: boolean) => void }) {
  const { isSignedIn } = useAuthState();
  const { toast } = useToast();
  const [editing, setEditing] = useState<DiagnosticAuthoring | null>(null);
  const query = useGetAssessmentDiagnostic(assessmentId, version, { query: { enabled: isSignedIn && !!assessmentId, queryKey: getGetAssessmentDiagnosticQueryKey(assessmentId, version), retry: false } });
  const status = (query.error as { status?: number } | null)?.status;
  const isLegacy = status === 404;
  const hasDiagnostic = !!query.data;
  const presenceRef = useRef(onPresenceChange);
  presenceRef.current = onPresenceChange;
  useEffect(() => { presenceRef.current?.(hasDiagnostic); }, [hasDiagnostic]);

  const download = async (kind: "diagnostic" | "package") => {
    try {
      const data = kind === "diagnostic" ? await exportAssessmentDiagnostic(assessmentId, version) : await getAssessmentPackageVersion(assessmentId, version);
      downloadJson(`${pkg.packageKey}-v${version}-${kind}.json`, data);
    } catch (error) {
      toast({ variant: "destructive", title: "내보내기 실패", description: error instanceof Error ? error.message : undefined });
    }
  };

  if (editing) {
    return <DiagnosticEditor key={`${assessmentId}-${version}`} assessmentId={assessmentId} sourceVersion={version} pkg={pkg} initial={editing} onCancel={() => setEditing(null)} onSaved={(next) => { setEditing(null); onSaved(next); }} />;
  }
  if (query.isLoading) return <div data-testid="status-diagnostic-loading" className="space-y-2"><div className="h-10 rounded-lg bg-muted animate-pulse" /><div className="h-32 rounded-lg bg-muted/60 animate-pulse" /></div>;
  if (query.error && !isLegacy) {
    return (
      <div data-testid="status-diagnostic-error" className="rounded-xl border border-destructive/40 p-4 text-sm flex items-center justify-between gap-3">
        <span>진단 데이터를 불러오지 못했습니다{status ? ` (${status})` : ""}.</span>
        <Button size="sm" variant="outline" data-testid="button-retry-diagnostic" onClick={() => query.refetch()}><RotateCw className="mr-1.5 h-3.5 w-3.5" />다시 시도</Button>
      </div>
    );
  }
  if (isLegacy || !query.data) {
    return (
      <div data-testid="status-diagnostic-legacy" className="rounded-xl border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">이 버전에는 진단 설계가 없습니다</p>
          <p className="text-xs text-muted-foreground mt-1">시나리오 {pkg.scenarios.length}개의 기존 평가 차원을 재사용합니다. 기존 상황 설명에는 숨은 정보가 있을 수 있어 대화 이유와 목표는 직접 작성하세요. 저장하면 v{version}을 이어받은 새 버전이 생깁니다.</p>
        </div>
        <Button data-testid="button-init-diagnostic" onClick={() => setEditing(initDiagnosticFromPackage(pkg))}><Sparkles className="mr-1.5 h-4 w-4" />진단 설계 시작</Button>
      </div>
    );
  }

  const diagnostic = query.data;
  return (
    <div className="rounded-xl border bg-card">
      <p data-testid="status-diagnostic-publish-notice" className="border-b bg-muted/40 px-3 py-2 text-xs">진단 v1은 RoleplayX 발행 시 단서·자료 필드가 유실되므로 발행 대신 ‘진단 내보내기’로 수신 측 매핑을 진행하세요. 일반 새 버전 폼은 데이터 손실 방지를 위해 숨겨집니다.</p>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <nav aria-label="작성자 미리보기 영역" className="flex flex-wrap gap-1 text-xs">
          {[["dx-briefing", "브리핑"], ["dx-materials", "자료"], ["dx-private", "비공개"], ["dx-evaluation", "평가"]].map(([anchor, label]) => <a key={anchor} href={`#${anchor}-0`} data-testid={`link-${anchor}`} className="rounded-md px-2.5 py-1 hover:bg-muted">{label}</a>)}
        </nav>
        <div className="flex flex-wrap gap-2">
          <Link href={`/assessments/${assessmentId}/participant?version=${version}&phase=preparation`} data-testid="link-participant-preview" className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />응시자 화면</Link>
          <Button size="sm" variant="outline" data-testid="button-export-diagnostic" onClick={() => download("diagnostic")}><Download className="mr-1.5 h-3.5 w-3.5" />진단 내보내기</Button>
          <Button size="sm" variant="outline" data-testid="button-export-package" onClick={() => download("package")}><Download className="mr-1.5 h-3.5 w-3.5" />패키지 JSON</Button>
          <Button size="sm" data-testid="button-edit-diagnostic" onClick={() => setEditing(reconcileWithPackage(diagnostic, pkg))}><FilePenLine className="mr-1.5 h-3.5 w-3.5" />진단 편집 · 새 버전</Button>
        </div>
      </div>
      <div className="divide-y">
        {diagnostic.scenarios.map((scenario, s) => {
          const title = pkg.scenarios.find((item) => item.key === scenario.scenarioKey)?.title ?? scenario.scenarioKey;
          const advice = briefingAdvice(scenario.briefing);
          return (
            <article key={scenario.scenarioKey} data-testid={`diagnostic-preview-${scenario.scenarioKey}`} className="p-4 md:p-5 space-y-4">
              <h3 className="headline-lg">{title}</h3>
              <div id={`dx-briefing-${s}`} className="scroll-mt-20">
                <p className="tech-label text-primary mb-2">01 응시자 브리핑 · {advice.chars}자 · 준비 {scenario.briefing.preparationSeconds}초</p>
                <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                  {[["역할과 권한", scenario.briefing.roleAndAuthority], ["관계", scenario.briefing.relationship], ["대화 이유", scenario.briefing.reason], ["목표", scenario.briefing.goals]].map(([label, value]) => <div key={label} className="rounded-md bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-line mt-0.5">{value}</dd></div>)}
                </dl>
              </div>
              <div id={`dx-materials-${s}`} className="scroll-mt-20">
                <p className="tech-label text-primary mb-2">02 자료 {scenario.materials.length}</p>
                {scenario.materials.length ? <div className="grid gap-2">{scenario.materials.map((m) => <MaterialView key={m.id} material={m} />)}</div> : <p className="text-xs text-muted-foreground">자료 없음</p>}
              </div>
              <div id={`dx-private-${s}`} className="scroll-mt-20 rounded-lg border border-foreground/20 p-3">
                <p className="tech-label mb-2 flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5" />03 비공개 · 응시자 화면에 나오지 않음</p>
                <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                  {[["숨은 원인", scenario.private.hiddenCauses], ["상대역 속마음", scenario.private.internalIntent], ["모범 대응", scenario.private.modelAnswer], ["연기 지침", scenario.private.instructions]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-line">{value || "—"}</dd></div>)}
                </dl>
                {scenario.cues.length > 0 && <ul className="mt-3 space-y-1.5 text-xs">{scenario.cues.map((cue) => <li key={cue.id} className="rounded bg-muted/50 p-2"><b>{cue.type === "discovery" ? "발견" : "공통"}</b> · {cue.type === "discovery" ? cue.intent : cue.condition} → {cue.fact}{cue.fallbackCondition ? <span className="text-muted-foreground"> · 대체: {cue.fallbackCondition}</span> : null}</li>)}</ul>}
              </div>
              <div id={`dx-evaluation-${s}`} className="scroll-mt-20">
                <p className="tech-label text-primary mb-2">04 관찰 평가</p>
                <ul className="grid gap-2 sm:grid-cols-2 text-sm">{scenario.criteria.map((c) => <li key={c.id} className="rounded-md border p-3"><span className="font-mono text-[11px] text-muted-foreground">{c.dimensionKey}</span><p className="font-medium">{c.competencyName}</p><p className="text-xs text-muted-foreground whitespace-pre-line mt-1">{c.observableBehavior}</p></li>)}</ul>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
