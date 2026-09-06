import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getGetAssessmentPackageVersionQueryKey, getGetAssessmentQueryKey, getListAssessmentsQueryKey, getListAssessmentPackagePublicationHistoryQueryKey, useCreateAssessmentPackageVersion, useGetAssessment, useGetAssessmentPackageVersion, useListAssessmentPackagePublicationHistory, usePublishAssessmentPackageVersionToRoleplayX, useValidateAssessmentPackageVersion, type AssessmentPackageVersionCreateInput } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, PlusCircle, Send, ShieldAlert } from "lucide-react";
import { AssessmentVersionForm } from "./assessment-version-form";

export default function AssessmentDetail() {
  const [, params] = useRoute("/assessments/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ?? "";
  const version = Number(new URLSearchParams(window.location.search).get("version") ?? "1");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [validation, setValidation] = useState<boolean | null>(null);
  const [diagnostics, setDiagnostics] = useState<{ path: string; message: string }[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [category, setCategory] = useState("");
  const [publishResult, setPublishResult] = useState<{ status: string; errorCategory?: string; response?: Record<string, unknown> } | null>(null);
  const assessmentDetail = useGetAssessment(id, { query: { enabled: !!id, queryKey: getGetAssessmentQueryKey(id) } });
  const packageQuery = useGetAssessmentPackageVersion(id, version, { query: { enabled: !!id && Number.isFinite(version), queryKey: getGetAssessmentPackageVersionQueryKey(id, version) } });
  const latestVersion = Number(assessmentDetail.data?.currentVersion ?? version);
  const latestPackageQuery = useGetAssessmentPackageVersion(id, latestVersion, { query: { enabled: !!id && Number.isFinite(latestVersion), queryKey: getGetAssessmentPackageVersionQueryKey(id, latestVersion) } });
  const historyQuery = useListAssessmentPackagePublicationHistory(id, { query: { enabled: !!id, queryKey: getListAssessmentPackagePublicationHistoryQueryKey(id) } });
  const validate = useValidateAssessmentPackageVersion();
  const publish = usePublishAssessmentPackageVersionToRoleplayX();
  const createVersion = useCreateAssessmentPackageVersion();
  const runValidation = () => validate.mutate({ id, version }, { onSuccess: (report) => { setValidation(report.valid); setDiagnostics(report.diagnostics); queryClient.invalidateQueries({ queryKey: getGetAssessmentQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getGetAssessmentPackageVersionQueryKey(id, version) }); queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() }); toast({ title: report.valid ? "검증을 통과했습니다" : "검증 실패", description: report.valid ? "RoleplayX 발행을 진행할 수 있습니다." : report.diagnostics.map((d) => `${d.path}: ${d.message}`).join(" · ") }); }, onError: (error) => toast({ variant: "destructive", title: "검증을 실행하지 못했습니다", description: error.message }) });
  const runPublish = () => publish.mutate({ id, version, data: { organizationId, category } }, { onSuccess: (result) => { setPublishResult(result); queryClient.invalidateQueries({ queryKey: getListAssessmentPackagePublicationHistoryQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getGetAssessmentQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getGetAssessmentPackageVersionQueryKey(id, version) }); queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() }); if (result.status === "published") toast({ title: "RoleplayX 발행 완료", description: "최신 발행 이력에서 결과를 확인하세요." }); else toast({ variant: "destructive", title: "발행 실패 — 재시도할 수 있습니다", description: result.errorCategory ?? "unknown" }); }, onError: (error) => { queryClient.invalidateQueries({ queryKey: getListAssessmentPackagePublicationHistoryQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getGetAssessmentQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() }); setPublishResult({ status: "failed", errorCategory: error.message }); toast({ variant: "destructive", title: "발행 실패 — 재시도할 수 있습니다", description: error.message }); } });

  if (packageQuery.isLoading) return <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Assessments", href: "/assessments" }, { label: "Loading" }]}><div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div></Layout>;
  if (!packageQuery.data) return <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Assessments", href: "/assessments" }, { label: id }]}><div className="p-8 text-muted-foreground">Assessment version을 찾을 수 없습니다.</div></Layout>;
  const assessment = packageQuery.data;
  const selectedVersion = assessmentDetail.data?.versions.find((item) => item.version === version);
  const alreadyPublished = selectedVersion?.status === "published";
  const nextVersion = latestVersion + 1;
  const createNewVersion = (packageId: string, data: AssessmentPackageVersionCreateInput) => createVersion.mutate({ id: packageId, data }, {
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAssessmentQueryKey(packageId) });
      queryClient.invalidateQueries({ queryKey: getGetAssessmentPackageVersionQueryKey(packageId, created.version) });
      queryClient.invalidateQueries({ queryKey: getListAssessmentPackagePublicationHistoryQueryKey(packageId) });
      setNewVersionOpen(false);
      toast({ title: "새 immutable version이 생성되었습니다", description: `v${created.version}을 검증하세요.` });
      setLocation(`/assessments/${packageId}?version=${created.version}`);
    },
    onError: (error) => toast({ variant: "destructive", title: "새 버전을 저장하지 못했습니다", description: error.message }),
  });
  return <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Assessments", href: "/assessments" }, { label: assessment.metadata.title }]} title={<span className="font-mono text-sm">v{assessment.version}</span>}>
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
      {assessmentDetail.data && <div data-testid="assessment-overview" className="rounded-xl border p-3 text-sm">상태: <b>{selectedVersion?.status ?? "draft"}</b> · 최신 v{assessmentDetail.data.currentVersion} · <span className="inline-flex gap-1 ml-2">{assessmentDetail.data.versions.map((item) => <Button key={item.id} data-testid={`button-version-${item.version}`} size="sm" variant={item.version === version ? "default" : "outline"} onClick={() => setLocation(`/assessments/${id}?version=${item.version}`)}>v{item.version} · {item.status}</Button>)}</span> · RoleplayX target</div>}
      <div className="rounded-xl border bg-card p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div><h1 className="text-xl font-semibold">{assessment.metadata.title}</h1><p className="text-sm text-muted-foreground mt-1">{assessment.metadata.description}</p><p data-testid="text-package-summary" className="text-xs text-muted-foreground mt-3">{assessment.metadata.locale} · {assessment.competencies.length} competencies · {assessment.scenarios.length} scenarios</p></div><div className="flex flex-wrap gap-2"><Button data-testid="button-new-assessment-version" variant="outline" onClick={() => setNewVersionOpen(true)}><PlusCircle className="h-4 w-4 mr-2" />새 버전</Button>{!alreadyPublished && <><Button data-testid="button-validate-assessment" variant="outline" onClick={runValidation} disabled={validate.isPending}>{validate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}검증</Button><Button data-testid="button-publish-assessment" onClick={() => setPublishOpen(true)} disabled={validation !== true}> <Send className="h-4 w-4 mr-2" />RoleplayX 발행</Button></>}</div></div>
      {alreadyPublished && <div data-testid="status-assessment-immutable" className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">선택한 v{version}은 발행되어 immutable 상태입니다. 검증·발행·편집은 불가하지만 새 후속 버전은 만들 수 있습니다.</div>}
      {validation === false && <div data-testid="status-validation-failed" className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm flex gap-2"><ShieldAlert className="h-4 w-4 text-destructive" />검증에 실패했습니다. 오류를 고친 새 immutable version을 생성하세요.</div>}
      {diagnostics.length > 0 && <ul data-testid="list-validation-diagnostics" className="rounded-lg border p-3 text-sm">{diagnostics.map((item, index) => <li key={`${item.path}-${index}`}>{item.path}: {item.message}</li>)}</ul>}
      {validation === true && <div data-testid="status-validation-passed" className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />검증 성공. {assessment.scenarios.length} scenarios · {assessment.competencies.length} competencies · {assessment.scenarios.reduce((total, scenario) => total + scenario.evaluation.dimensions.length, 0)} evaluation dimensions</div>}
      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview" data-testid="tab-human-preview">사람이 읽는 preview (실전 미리보기)</TabsTrigger>
          <TabsTrigger value="json" data-testid="tab-advanced-json">고급 JSON (Spec v1.0)</TabsTrigger>
        </TabsList>
        <TabsContent value="preview" className="rounded-xl border bg-card p-5 mt-3 space-y-6">
          {assessment.scenarios.map((scenario) => {
            const primaryPersona = scenario.personas.find((p) => p.isPrimary) || scenario.personas[0];
            return (
              <div key={scenario.key} className="space-y-5">
                {/* 1. Candidate Briefing */}
                <div className="rounded-lg border p-4 space-y-3 bg-muted/10">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-sm flex items-center gap-1.5">
                      <span>응시자 브리핑</span>
                      <span className="text-xs font-normal text-muted-foreground">({scenario.title})</span>
                    </h3>
                    <span data-testid={`status-scenario-validation-${scenario.key}`} className="text-xs text-primary font-mono">
                      {validation === false ? "diagnostics available" : "valid"}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded bg-muted/40 p-2.5">
                      <span className="text-muted-foreground block mb-0.5">응시자 역할</span>
                      <span className="font-semibold text-foreground">{scenario.context.playerRole}</span>
                    </div>
                    <div className="rounded bg-muted/40 p-2.5">
                      <span className="text-muted-foreground block mb-0.5">진행 시간 및 턴</span>
                      <span className="font-semibold text-foreground">{scenario.estimatedTime}분 · 권장 {scenario.targetTurns}턴 / 최대 {scenario.termination.maxTurns}턴</span>
                    </div>
                    <div className="rounded bg-muted/40 p-2.5">
                      <span className="text-muted-foreground block mb-0.5">통과 기준 점수</span>
                      <span className="font-semibold text-foreground">{scenario.evaluation.passingScore ?? 70}점 / 100점</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-muted-foreground block mb-1">상황 설명</span>
                    <p className="text-xs text-muted-foreground/90 whitespace-pre-line leading-relaxed bg-background p-3 rounded border">
                      {scenario.context.situation}
                    </p>
                  </div>

                  {scenario.objectives.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground block mb-1">주요 달성 목표</span>
                      <ul className="grid sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                        {scenario.objectives.map((obj, i) => (
                          <li key={i} className="flex items-center gap-1.5 bg-background p-1.5 rounded border">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            <span>{obj}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* 2. AI Persona & Simulation Settings */}
                {primaryPersona && (
                  <div className="rounded-lg border p-4 space-y-3 bg-muted/10">
                    <div className="border-b pb-2">
                      <h3 className="font-bold text-sm">AI 상대역 페르소나 설정</h3>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block mb-0.5">캐릭터</span>
                        <div className="font-bold text-foreground">
                          {primaryPersona.name} ({primaryPersona.role})
                        </div>
                        <p className="text-muted-foreground mt-1 leading-relaxed">
                          {primaryPersona.background}
                        </p>
                      </div>
                      {scenario.simulation.initialPrompt && (
                        <div className="rounded bg-background p-2.5 border">
                          <span className="text-primary font-medium block mb-1">AI 지침 프롬프트</span>
                          <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                            {scenario.simulation.initialPrompt}
                          </p>
                        </div>
                      )}
                    </div>

                    {scenario.flow.length > 0 && (
                      <div className="pt-2 border-t">
                        <span className="text-xs font-medium text-muted-foreground block mb-1.5">권장 대화 흐름 (Recommended Flow)</span>
                        <div className="grid sm:grid-cols-3 gap-2">
                          {scenario.flow.map((stage, idx) => (
                            <div key={stage.key} className="rounded bg-background p-2 border text-xs">
                              <span className="font-bold text-primary block mb-0.5">{idx + 1}. {stage.title}</span>
                              <p className="text-[11px] text-muted-foreground">{stage.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Evaluation Dimensions */}
                <div className="rounded-lg border p-4 space-y-3 bg-muted/10">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-sm">행동 평가 루브릭</h3>
                    <span className="text-xs text-muted-foreground font-mono">
                      가중치 합: {Math.round(scenario.evaluation.dimensions.reduce((s, d) => s + d.weight, 0) * 100)}%
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {scenario.evaluation.dimensions.map((dim) => (
                      <div key={dim.key} className="rounded bg-background p-3 border space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs">{dim.label}</span>
                          <span className="text-[10px] font-mono text-primary bg-primary/10 px-1 rounded">
                            {Math.round(dim.weight * 100)}%
                          </span>
                        </div>
                        <ul className="space-y-0.5 text-xs text-muted-foreground">
                          {dim.criteria.map((crit, cIdx) => (
                            <li key={cIdx} className="flex items-start gap-1">
                              <span className="text-primary font-bold">·</span>
                              <span>{crit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <details className="rounded-lg border p-3 text-xs">
            <summary className="cursor-pointer font-medium">고급 정보 및 Provenance</summary>
            <p className="mt-2 font-mono">content hash: {assessment.provenance.contentHash}</p>
          </details>
        </TabsContent>
        <TabsContent value="json" className="mt-3">
          <pre data-testid="text-assessment-json" className="rounded-xl border bg-card p-4 max-h-[520px] overflow-auto text-xs">{JSON.stringify(assessment, null, 2)}</pre>
        </TabsContent>
      </Tabs>
      <section className="rounded-xl border bg-card overflow-hidden"><div className="p-4 border-b font-semibold">발행 이력 <span className="text-xs font-normal text-muted-foreground">최신순</span></div><div className="divide-y">{historyQuery.isLoading ? <div className="p-4 text-sm text-muted-foreground">이력을 불러오는 중…</div> : historyQuery.data?.length ? historyQuery.data.map((record) => <div data-testid={`row-publish-history-${record.id}`} key={record.id} className="p-4 text-sm flex justify-between gap-3"><div><b>{record.status}</b><span className="text-muted-foreground"> · {record.organizationId}/{record.category} · 시도 {record.attempt}</span>{record.errorMessage && <p className="text-destructive text-xs mt-1">{record.errorMessage}</p>}</div><time className="text-xs text-muted-foreground whitespace-nowrap">{new Date(record.createdAt).toLocaleString()}</time></div>) : <div className="p-4 text-sm text-muted-foreground">아직 발행 이력이 없습니다.</div>}</div></section>
    </div>
    <Dialog open={publishOpen} onOpenChange={setPublishOpen}><DialogContent><DialogHeader><DialogTitle>RoleplayX에 발행</DialogTitle><DialogDescription>검증된 immutable v{version}을 조직과 카테고리에 가져옵니다.</DialogDescription></DialogHeader><ol data-testid="publish-progress" className="text-xs space-y-1">{["Package preparation", "Local validation", "Target validation", "Import", "Complete"].map((step, index) => <li key={step} className={publish.isPending || publishResult?.status === "published" ? "text-primary" : "text-muted-foreground"}>{index + 1}. {step}{publish.isPending && index === 3 ? "…" : ""}</li>)}</ol><div className="space-y-3"><div className="space-y-1"><Label htmlFor="input-publish-organization">Organization ID</Label><Input id="input-publish-organization" data-testid="input-publish-organization" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} /></div><div className="space-y-1"><Label htmlFor="input-publish-category">Category</Label><Input id="input-publish-category" data-testid="input-publish-category" value={category} onChange={(event) => setCategory(event.target.value)} /></div></div>{publishResult?.status === "published" && <div data-testid="status-publish-success" className="text-sm text-primary">Import complete · {String(publishResult.response?.importedScenarioCount ?? 0)} scenarios · {typeof publishResult.response?.roleplayXUrl === "string" && <a className="underline" href={publishResult.response.roleplayXUrl}>RoleplayX에서 열기</a>}</div>}{publishResult?.status === "failed" && <div data-testid="status-publish-failed" className="text-sm text-destructive">안전하게 실패했습니다: {publishResult.errorCategory ?? "unknown"}. 아래 버튼으로 재시도하세요.</div>}<DialogFooter><Button data-testid="button-confirm-publish" onClick={runPublish} disabled={!organizationId || !category || publish.isPending}>{publish.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{publishResult?.status === "failed" ? "발행 재시도" : "발행 시작"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={newVersionOpen} onOpenChange={setNewVersionOpen}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>새 버전 만들기</DialogTitle><DialogDescription>최신 v{latestVersion} 내용을 바탕으로 v{nextVersion}을 생성합니다.</DialogDescription></DialogHeader><AssessmentVersionForm packageId={id} version={nextVersion} initialValues={{ title: (latestPackageQuery.data ?? assessment).metadata.title, description: (latestPackageQuery.data ?? assessment).metadata.description, competency: (latestPackageQuery.data ?? assessment).competencies[0]?.name, dimensionLabel: (latestPackageQuery.data ?? assessment).scenarios[0]?.evaluation.dimensions[0]?.label, dimensionKey: (latestPackageQuery.data ?? assessment).scenarios[0]?.evaluation.dimensions[0]?.key, criteria: (latestPackageQuery.data ?? assessment).scenarios[0]?.evaluation.dimensions[0]?.criteria.join("\n"), passingScore: String((latestPackageQuery.data ?? assessment).scenarios[0]?.evaluation.passingScore ?? 70), maxTurns: String((latestPackageQuery.data ?? assessment).scenarios[0]?.termination.maxTurns ?? 10), targetTurns: String((latestPackageQuery.data ?? assessment).scenarios[0]?.targetTurns ?? 5) }} isPending={createVersion.isPending} onSubmit={createNewVersion} /></DialogContent></Dialog>
  </Layout>;
}