import { Link, useLocation, useRoute, useSearch } from "wouter";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAssessmentParticipantPreviewQueryKey, useGetAssessmentParticipantPreview } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Clock, RotateCw } from "lucide-react";
import { MaterialView } from "@/components/diagnostic/material-view";
import { participantMediaUrl } from "@/lib/diagnostic";

type Phase = "preparation" | "conversation";

/** Standalone participant view: uses ONLY the participant preview endpoint. No package, detail, or author data. */
export default function ParticipantPreview() {
  const [, params] = useRoute("/assessments/:id/participant");
  const [, setLocation] = useLocation();
  const search = new URLSearchParams(useSearch());
  const id = params?.id ?? "";
  const version = Number(search.get("version") ?? "1");
  const phase: Phase = search.get("phase") === "conversation" ? "conversation" : "preparation";
  const valid = !!id && Number.isInteger(version) && version > 0;
  const queryClient = useQueryClient();
  const participantKey = getGetAssessmentParticipantPreviewQueryKey(id, version, { phase })[0];
  // In-app navigation from an author page must not retain its private query data.
  useEffect(() => {
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== participantKey });
  }, [queryClient, participantKey]);
  const preview = useGetAssessmentParticipantPreview(id, version, { phase }, { query: { enabled: valid, queryKey: getGetAssessmentParticipantPreviewQueryKey(id, version, { phase }) } });
  const go = (next: Phase) => setLocation(`/assessments/${id}/participant?version=${version}&phase=${next}`);

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="tech-label text-primary">응시자 화면 미리보기 · v{version}</p>
            <h1 className="headline-lg mt-1">{phase === "preparation" ? "대화 전 준비" : "대화 진행 중"}</h1>
          </div>
          <div role="radiogroup" aria-label="단계" className="inline-flex rounded-lg border p-1">
            {(["preparation", "conversation"] as Phase[]).map((value) => (
              <button key={value} type="button" role="radio" aria-checked={phase === value} data-testid={`button-phase-${value}`} onClick={() => go(value)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${phase === value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}>
                {value === "preparation" ? "준비" : "대화"}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 p-4 md:py-8">
        {!valid ? <p data-testid="status-participant-invalid" className="text-sm text-muted-foreground">잘못된 주소입니다.</p>
          : preview.isLoading ? <div data-testid="status-participant-loading" className="space-y-3"><div className="h-28 rounded-xl bg-muted animate-pulse" /><div className="h-40 rounded-xl bg-muted/60 animate-pulse" /></div>
          : preview.error || !preview.data ? (
            <div data-testid="status-participant-error" className="rounded-xl border border-destructive/40 p-4 text-sm flex items-center justify-between gap-3">
              <span>응시자 화면을 불러오지 못했습니다.</span>
              <Button size="sm" variant="outline" onClick={() => preview.refetch()}><RotateCw className="mr-1.5 h-3.5 w-3.5" />다시 시도</Button>
            </div>
          ) : preview.data.scenarios.length === 0 ? <p data-testid="status-participant-empty" className="text-sm text-muted-foreground">이 버전에는 응시자에게 보일 진단 내용이 없습니다.</p>
          : preview.data.scenarios.map((scenario) => (
            <article key={scenario.scenarioKey} data-testid={`participant-scenario-${scenario.scenarioKey}`} className="space-y-4">
              <section aria-label="브리핑" className="rounded-xl border bg-card p-5">
                <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />준비 시간 {scenario.briefing.preparationSeconds}초</p>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {[["나의 역할과 권한", scenario.briefing.roleAndAuthority], ["상대와의 관계", scenario.briefing.relationship], ["대화하는 이유", scenario.briefing.reason], ["이번 대화의 목표", scenario.briefing.goals]].map(([label, value]) => (
                    <div key={label}><dt className="text-xs font-semibold">{label}</dt><dd className="mt-1 text-sm leading-relaxed whitespace-pre-line">{value}</dd></div>
                  ))}
                </dl>
              </section>
              {scenario.materials.length > 0 && (
                <section aria-label="자료" className="space-y-2">
                  <h2 className="text-sm font-semibold">{phase === "preparation" ? "자료" : "다시 볼 수 있는 자료"}</h2>
                  {scenario.materials.map((material) => (
                    <MaterialView key={material.id} material={material} showMeta={false} src={material.assetId ? participantMediaUrl(id, version, material.assetId, phase) : undefined} />
                  ))}
                </section>
              )}
            </article>
          ))}
        <Link href="/" className="inline-block text-xs text-muted-foreground underline" data-testid="link-participant-home">ContentX</Link>
      </main>
    </div>
  );
}
