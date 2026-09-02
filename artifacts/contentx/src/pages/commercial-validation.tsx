import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, AlertTriangle, ArrowDownToLine, CheckCircle2, ChevronRight,
  FlaskConical, Gauge, GitCompare, Loader2, LockKeyhole, Play, ShieldCheck,
  TriangleAlert, Users,
} from "lucide-react";

type Agent = {
  id: string; name: string; version: string; protocol: string; configurationHash: string;
  authConfig?: { type: string };
};
type Cohort = { id: string; label: string; description: string };
type Definition = {
  id: string; version: string; title: string; purpose: string;
  scenario: { title: string; policy: string; expectedActions: string[] };
  cohorts: Cohort[]; metrics: string[]; seedPolicy: string;
};
type Stats = { mean: number; stdDev: number; p50: number; confidenceInterval95: [number, number] };
type Report = { agents: Array<{ overallStats: Stats; metricStats: Record<string, Stats>; personaSensitivity: Array<{ cohortName: string; averageScore: number; failureRate?: number }> }>; validityReport?: { discriminativePower?: { agentSeparationIndex?: number } } };
type Failure = {
  id: string; patternType: string; description: string; severity: string; frequency: number; rate: number;
  affectedCohorts: string[]; observedBehavioralDivergence: string; causalHypothesis: string; evidenceRunIds: string[];
};
type ValidationRun = {
  id: string; requestId: string; agent: Agent; status: string; startedAt: string; completedAt: string;
  sampleSizePerCohort: number; repetitions: number; interactionCount: number;
  baseline: Report; stress: Report; calibrationStatus: string; failureExplorer: Failure[];
  evidencePackageId: string; correlation: { requestId: string; runIds: string[]; evaluationIds: string[] };
  contractCheck: { passedChecksCount: number; totalChecksCount: number };
};
type Comparison = { deploymentDecision: "APPROVED" | "BLOCKED" | "WARNING"; report: { status: string; recommendations: string[] } };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || "요청을 처리하지 못했습니다.");
  return body as T;
}

function score(report: Report | undefined) {
  return report?.agents?.[0]?.overallStats?.mean ?? 0;
}

function scoreTone(value: number) {
  if (value >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function effectSize(baseline: Report, stress: Report) {
  const base = baseline.agents?.[0]?.overallStats;
  const next = stress.agents?.[0]?.overallStats;
  if (!base || !next) return 0;
  const pooledStd = Math.sqrt((base.stdDev ** 2 + next.stdDev ** 2) / 2) || 1;
  return (next.mean - base.mean) / pooledStd;
}

function DecisionBadge({ decision }: { decision: string }) {
  const styles = decision === "APPROVED"
    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
    : decision === "BLOCKED"
      ? "bg-rose-500/10 text-rose-700 border-rose-500/30"
      : "bg-amber-500/10 text-amber-700 border-amber-500/30";
  return <Badge variant="outline" className={styles}>{decision}</Badge>;
}

export default function CommercialValidationPage() {
  const { toast } = useToast();
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<ValidationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<ValidationRun | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [form, setForm] = useState({ id: "reference_sdk_agent", name: "Reference SDK Agent", version: "1.0.0", protocol: "sdk", endpointUrl: "" });
  const [runForm, setRunForm] = useState({ agentId: "", sampleSizePerCohort: "2", repetitions: "1" });

  const load = async () => {
    try {
      const [benchmark, registered, existing] = await Promise.all([
        api<Definition>("/api/v1/reference-benchmark"),
        api<Agent[]>("/api/v1/external-agents"),
        api<ValidationRun[]>("/api/v1/commercial-validation/runs"),
      ]);
      setDefinition(benchmark);
      setAgents(registered);
      setRuns(existing);
      if (!runForm.agentId && registered[0]) setRunForm((prev) => ({ ...prev, agentId: registered[0]!.id }));
    } catch (error) {
      toast({ title: "검증 화면을 불러오지 못했습니다", description: error instanceof Error ? error.message : "API 서버를 확인하세요.", variant: "destructive" });
    }
  };
  useEffect(() => { void load(); }, []);

  const register = async (event: FormEvent) => {
    event.preventDefault();
    setRegistering(true);
    try {
      const agent = await api<Agent>("/api/v1/external-agents/register", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          endpointUrl: form.endpointUrl || undefined,
          tenantId: "contentx_workspace",
          authConfig: { type: "none" },
          capabilities: { supportsToolCalling: true, supportsMultiTurn: true, supportsStreaming: false, maxContextTokens: 8192, supportedProtocols: [form.protocol] },
        }),
      });
      setAgents((prev) => [agent, ...prev.filter((item) => item.id !== agent.id)]);
      setRunForm((prev) => ({ ...prev, agentId: agent.id }));
      toast({ title: "Agent 등록 완료", description: "인증 정보는 응답·로그·화면에 노출하지 않습니다." });
    } catch (error) {
      toast({ title: "등록 실패", description: error instanceof Error ? error.message : "등록에 실패했습니다.", variant: "destructive" });
    } finally { setRegistering(false); }
  };

  const checkContract = async (agentId: string) => {
    setChecking(agentId);
    try {
      const result = await api<{ isReadyForBenchmarking: boolean; passedChecksCount: number; totalChecksCount: number }>(`/api/v1/external-agents/${agentId}/contract-check`, { method: "POST" });
      toast({ title: result.isReadyForBenchmarking ? "계약검사 통과" : "계약검사 확인 필요", description: `${result.passedChecksCount}/${result.totalChecksCount} checks passed` });
    } catch (error) {
      toast({ title: "계약검사 실패", description: error instanceof Error ? error.message : "검사에 실패했습니다.", variant: "destructive" });
    } finally { setChecking(null); }
  };

  const runBenchmark = async (event: FormEvent) => {
    event.preventDefault();
    if (!runForm.agentId) return;
    setLoading(true); setComparison(null);
    try {
      const run = await api<ValidationRun>("/api/v1/commercial-validation/runs", {
        method: "POST",
        body: JSON.stringify({
          agentId: runForm.agentId,
          sampleSizePerCohort: Number(runForm.sampleSizePerCohort),
          repetitions: Number(runForm.repetitions),
        }),
      });
      setRuns((prev) => [run, ...prev]);
      setSelectedRun(run);
      toast({ title: "Reference Benchmark 완료", description: `${run.interactionCount.toLocaleString()} interactions · evidence package가 고정됐습니다.` });
    } catch (error) {
      toast({ title: "벤치마크 실패", description: error instanceof Error ? error.message : "실행에 실패했습니다.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const compare = async (baselineRunId: string, candidateRunId: string) => {
    try {
      setComparison(await api<Comparison>("/api/v1/commercial-validation/compare", { method: "POST", body: JSON.stringify({ baselineRunId, candidateRunId }) }));
    } catch (error) {
      toast({ title: "비교 실패", description: error instanceof Error ? error.message : "비교할 수 없습니다.", variant: "destructive" });
    }
  };

  const verifyEvidence = async (packageId: string) => {
    try {
      const result = await api<{ valid: boolean; calculatedChecksum: string }>("/api/v1/commercial-validation/packages/" + packageId + "/verify", { method: "POST" });
      toast({ title: result.valid ? "Evidence checksum verified" : "Evidence checksum mismatch", description: result.valid ? result.calculatedChecksum : "패키지가 변경됐을 수 있습니다.", variant: result.valid ? "default" : "destructive" });
    } catch (error) {
      toast({ title: "검증 실패", description: error instanceof Error ? error.message : "checksum을 검증할 수 없습니다.", variant: "destructive" });
    }
  };

  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === runForm.agentId), [agents, runForm.agentId]);

  return (
    <Layout breadcrumbs={[{ label: "고급 도구" }, { label: "상용 검증" }]} title={<div className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /><span>상용 검증</span></div>}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">P7 / REFERENCE BENCHMARK V1</Badge><Badge variant="secondary"><LockKeyhole className="mr-1 h-3 w-3" /> immutable evidence</Badge></div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{definition?.title || "Reference Benchmark"}</h1>
              <p className="text-sm leading-6 text-muted-foreground">{definition?.purpose || "외부 Agent의 정책 준수, 공감, 목표 달성, escalation 실패를 실제 실행으로 검증합니다."}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border bg-background/70 px-3 py-2"><Users className="mx-auto h-4 w-4 text-primary" /><p className="mt-1 text-lg font-semibold">{definition?.cohorts.length || 5}</p><p className="text-[11px] text-muted-foreground">cohorts</p></div>
              <div className="rounded-xl border bg-background/70 px-3 py-2"><Gauge className="mx-auto h-4 w-4 text-primary" /><p className="mt-1 text-lg font-semibold">1K+</p><p className="text-[11px] text-muted-foreground">scale ready</p></div>
              <div className="rounded-xl border bg-background/70 px-3 py-2"><ShieldCheck className="mx-auto h-4 w-4 text-primary" /><p className="mt-1 text-lg font-semibold">8</p><p className="text-[11px] text-muted-foreground">contract checks</p></div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.35fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" /> 외부 Agent 연결</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={register} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="agent-id">Agent ID</Label><Input id="agent-id" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="agent-name">표시 이름</Label><Input id="agent-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label>Protocol</Label><Select value={form.protocol} onValueChange={(protocol) => setForm({ ...form, protocol })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["sdk", "http", "mcp", "webhook"].map((value) => <SelectItem key={value} value={value}>{value.toUpperCase()}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label htmlFor="endpoint">Endpoint (HTTP/MCP)</Label><Input id="endpoint" value={form.endpointUrl} onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })} placeholder={form.protocol === "sdk" ? "in-process SDK" : "https://agent.example/respond"} /></div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mr-1 inline h-3 w-3" /> 이 화면은 credential을 수집하지 않습니다. bearer/API key/HMAC는 workspace integration/secrets로 별도 주입하고, 현재 등록은 인증 없는 endpoint 또는 SDK smoke test에 사용하세요.</div>
                <Button type="submit" disabled={registering} className="w-full">{registering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}Agent 등록</Button>
              </form>
              <div className="space-y-2 border-t pt-4">
                <p className="tech-label text-muted-foreground">등록된 Agent</p>
                {agents.length === 0 ? <p className="text-sm text-muted-foreground">아직 등록된 Agent가 없습니다.</p> : agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{agent.name}</p><p className="truncate text-xs text-muted-foreground">{agent.id} · {agent.protocol.toUpperCase()} · v{agent.version}</p></div>
                    <Button variant="outline" size="sm" onClick={() => void checkContract(agent.id)} disabled={checking === agent.id}>{checking === agent.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1 h-3.5 w-3.5" />}검사</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Play className="h-4 w-4 text-primary" /> Reference Benchmark 실행</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={runBenchmark} className="space-y-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-medium">{definition?.scenario.title || "환불·취소·에스컬레이션 대표 시나리오"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{definition?.scenario.policy}</p><div className="mt-3 flex flex-wrap gap-1.5">{definition?.scenario.expectedActions.map((action) => <Badge key={action} variant="secondary" className="font-mono text-[10px]">{action}</Badge>)}</div></div>
                <div className="space-y-1.5"><Label>대상 Agent</Label><Select value={runForm.agentId} onValueChange={(agentId) => setRunForm({ ...runForm, agentId })}><SelectTrigger><SelectValue placeholder="Agent를 선택하세요" /></SelectTrigger><SelectContent>{agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name} · {agent.protocol.toUpperCase()}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="sample">cohort별 sample</Label><Input id="sample" type="number" min="1" max="250" value={runForm.sampleSizePerCohort} onChange={(e) => setRunForm({ ...runForm, sampleSizePerCohort: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="repetitions">repetitions</Label><Input id="repetitions" type="number" min="1" max="250" value={runForm.repetitions} onChange={(e) => setRunForm({ ...runForm, repetitions: e.target.value })} /></div>
                </div>
                <p className="text-xs text-muted-foreground">현재 설정: {((Number(runForm.sampleSizePerCohort) || 0) * (Number(runForm.repetitions) || 0) * 5 * 2).toLocaleString()} interactions (baseline + stress)</p>
                <Button type="submit" disabled={loading || !selectedAgent} className="w-full">{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />실행 중 — 외부 Agent 호출</> : <><Play className="mr-2 h-4 w-4" />실행하고 실패 증거 찾기</>}</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {definition && <Card><CardHeader><CardTitle className="text-base">행동 코호트 설계</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{definition.cohorts.map((cohort) => <div key={cohort.id} className="rounded-xl border p-3"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{cohort.label}</span><span className="font-mono text-[10px] text-muted-foreground">{cohort.id}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{cohort.description}</p></div>)}</div></CardContent></Card>}

        {runs.length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><GitCompare className="h-4 w-4 text-primary" /> 실행 기록과 version gate</CardTitle></CardHeader><CardContent><div className="space-y-2">{runs.map((run, index) => <div key={run.id} className={`flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between ${selectedRun?.id === run.id ? "border-primary bg-primary/5" : ""}`}><button className="min-w-0 text-left" onClick={() => setSelectedRun(run)}><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{run.agent.name}</span><Badge variant="outline">{run.agent.protocol.toUpperCase()}</Badge><Badge variant="secondary">{run.calibrationStatus}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{new Date(run.startedAt).toLocaleString()} · {run.interactionCount.toLocaleString()} interactions · {run.failureExplorer.length} failure patterns</p></button><div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => window.open(`/api/v1/commercial-validation/packages/${run.evidencePackageId}`, "_blank")}><ArrowDownToLine className="mr-1 h-3.5 w-3.5" />Evidence</Button><Button variant="outline" size="sm" onClick={() => void verifyEvidence(run.evidencePackageId)}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Verify</Button>{index > 0 && <Button variant="outline" size="sm" onClick={() => void compare(runs[index - 1]!.id, run.id)}><GitCompare className="mr-1 h-3.5 w-3.5" />Compare</Button>}</div></div>)}</div></CardContent></Card>}

        {selectedRun && <div className="space-y-6">
          <Card><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base"><span>결과 요약 · {selectedRun.agent.name}</span><div className="flex gap-2"><Badge variant="outline">{selectedRun.contractCheck.passedChecksCount}/{selectedRun.contractCheck.totalChecksCount} contract</Badge><Badge variant="outline" className="border-primary/30 text-primary">{selectedRun.correlation.runIds.length} traces</Badge></div></CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Baseline mean</p><p className={`mt-1 text-2xl font-semibold ${scoreTone(score(selectedRun.baseline))}`}>{score(selectedRun.baseline).toFixed(1)}</p><p className="text-[11px] text-muted-foreground">95% CI {selectedRun.baseline.agents[0]?.overallStats.confidenceInterval95.join(" – ")}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Stress mean</p><p className={`mt-1 text-2xl font-semibold ${scoreTone(score(selectedRun.stress))}`}>{score(selectedRun.stress).toFixed(1)}</p><p className="text-[11px] text-muted-foreground">σ {selectedRun.stress.agents[0]?.overallStats.stdDev}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Effect size</p><p className="mt-1 text-2xl font-semibold">d {effectSize(selectedRun.baseline, selectedRun.stress).toFixed(2)}</p><p className="text-[11px] text-muted-foreground">Cohen's d · stress − baseline</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Failure rate</p><p className="mt-1 text-2xl font-semibold text-rose-600">{selectedRun.failureExplorer.length ? `${Math.round(Math.max(...selectedRun.failureExplorer.map((failure) => failure.rate)) * 100)}%` : "0%"}</p><p className="text-[11px] text-muted-foreground">prioritized patterns</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Interactions</p><p className="mt-1 text-2xl font-semibold">{selectedRun.interactionCount.toLocaleString()}</p><p className="text-[11px] text-muted-foreground">seed 고정 · 재실행 가능</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Evidence</p><p className="mt-1 flex items-center gap-1 text-lg font-semibold"><LockKeyhole className="h-4 w-4 text-primary" /> immutable</p><p className="text-[11px] text-muted-foreground">SHA-256 package</p></div></div></CardContent></Card>
          <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
            <Card><CardHeader><CardTitle className="text-base">실패 탐색기</CardTitle></CardHeader><CardContent>{selectedRun.failureExplorer.length === 0 ? <div className="flex items-center gap-2 py-6 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />발견된 hidden failure 없음</div> : <div className="space-y-3">{selectedRun.failureExplorer.map((failure) => <div key={failure.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-rose-500" /><p className="text-sm font-semibold">{failure.patternType}</p></div><Badge variant="outline" className={failure.severity === "critical" ? "border-rose-500/40 text-rose-600" : "border-amber-500/40 text-amber-700"}>{failure.severity} · {Math.round(failure.rate * 100)}%</Badge></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{failure.description}</p><div className="mt-3 space-y-2 border-t pt-3 text-xs"><p><strong>Observed divergence</strong><br /><span className="text-muted-foreground">{failure.observedBehavioralDivergence}</span></p><p><strong>Causal hypothesis</strong><br /><span className="text-muted-foreground">{failure.causalHypothesis}</span></p><p className="font-mono text-[10px] text-muted-foreground">{failure.evidenceRunIds.length} evidence traces · {failure.affectedCohorts.join(", ")}</p></div></div>)}</div>}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Cohort sensitivity · stress</CardTitle></CardHeader><CardContent><div className="space-y-3">{(selectedRun.stress.agents[0]?.personaSensitivity || []).map((cohort) => <div key={cohort.cohortName} className="flex items-center gap-3"><span className="w-36 truncate text-xs">{cohort.cohortName}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.min(100, cohort.averageScore))}%` }} /></div><span className={`w-10 text-right text-xs font-semibold ${scoreTone(cohort.averageScore)}`}>{cohort.averageScore.toFixed(1)}</span><span className="w-10 text-right text-[10px] text-muted-foreground">{Math.round((cohort.failureRate || 0) * 100)}% fail</span></div>)}</div><div className="mt-6 rounded-xl border border-dashed p-4 text-xs leading-5 text-muted-foreground"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-500" />이 분석은 평균만 보지 않고, 행동 코호트별로 regression을 분리합니다. 같은 seed/spec/rubric/evaluator 버전으로 비교할 수 있습니다.</div></CardContent></Card>
          </div>
        </div>}

        {comparison && <Card className="border-primary/30"><CardHeader><CardTitle className="flex items-center gap-3 text-base">배포 gate <DecisionBadge decision={comparison.deploymentDecision} /></CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">baseline과 candidate의 metric/cohort/failure/trajectory 비교 결과입니다.</p>{comparison.report.recommendations?.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{comparison.report.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>}</CardContent></Card>}

        <div className="flex items-center gap-2 text-xs text-muted-foreground"><ChevronRight className="h-3.5 w-3.5" />Seed policy: <span className="font-mono">{definition?.seedPolicy || "reference-benchmark-v1"}</span></div>
      </div>
    </Layout>
  );
}