import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { 
  useGetWorkflow, 
  useUpdateWorkflow, 
  useRunWorkflowStep, 
  getGetWorkflowQueryKey,
  WorkflowStep,
  WorkflowRecord,
  useGetSimulation,
  useListEvaluations
} from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Play, FastForward, Plus, Check, Loader2, AlertCircle, X,
  Settings, Trash2, FileText, BarChart, Sparkles, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { getNarrativeResult } from "./result-model";
import { ReuseSection } from "@/components/reuse-section";
import { WorkflowGenerationProgress } from "@/components/workflow-generation-progress";

// Catalog of executable step types the engine supports. Mirrors the server's
// STEP_ACTIONS; adding one of these creates a runnable step with a binding.
const STEP_CATALOG: {
  action: string;
  api: string;
  type: WorkflowStep["type"];
  title: string;
  desc: string;
  input: string[];
  output: string[];
  defaultParams?: Record<string, unknown>;
}[] = [
  { action: "benchmark_reference", api: "POST /v1/scenarios/benchmark", type: "analyze", title: "참고 작품 패턴 분석", desc: "여러 참고 시나리오의 공통 특성을 집계해 그룹 프로파일을 만듭니다. 이후 이야기 초안 단계에 자동으로 제약으로 전달됩니다.", input: ["scenarioIds"], output: ["benchmarkConstraints"], defaultParams: { scenarioIds: [] } },
  { action: "draft_story", api: "POST /v1/scenarios/draft", type: "generate", title: "이야기 초안 만들기", desc: "아이디어를 구체적인 이야기 초안으로 발전시킵니다.", input: ["idea"], output: ["scenarioId"] },
  { action: "classify_story", api: "POST /v1/scenarios/:id/classify", type: "analyze", title: "장르·분위기 정리", desc: "이야기의 장르와 분위기를 자동으로 정리합니다.", input: ["scenarioId"], output: ["classification"] },
  { action: "build_world", api: "POST /v1/content", type: "compose", title: "이야기 구조 만들기", desc: "등장인물·장소·사건을 연결한 이야기 구조를 만듭니다.", input: ["scenarioId"], output: ["contentId"] },
  { action: "validate_world", api: "POST /v1/content/:id/validate", type: "validate", title: "이야기 점검하기", desc: "구조에 빠진 부분이 없는지 점검합니다.", input: ["contentId"], output: ["validationReport"] },
  { action: "project_novel", api: "POST /v1/projections (novel)", type: "project", title: "소설로 만들기", desc: "이야기 구조를 소설 형태로 바꿉니다.", input: ["contentId"], output: ["novelProjection"] },
  { action: "project_roleplay", api: "POST /v1/projections (roleplayx)", type: "project", title: "롤플레이로 바꾸기", desc: "이야기를 롤플레이 시나리오로 바꿉니다.", input: ["contentId"], output: ["roleplayProjection"] },
  { action: "define_audience", api: "POST /v1/populations", type: "generate", title: "타겟 고객 정의하기", desc: "제품에 맞는 가상 고객 집단의 특성을 정의합니다.", input: ["productBrief"], output: ["populationId"] },
  { action: "generate_personas", api: "POST /v1/sampling", type: "generate", title: "가상 고객 만들기", desc: "정의한 특성에 따라 가상 고객을 뽑아냅니다.", input: ["populationId"], output: ["samplingRunId"], defaultParams: { sampleSize: 4 } },
  { action: "prepare_actors", api: "POST /v1/snapshots → /v1/agents", type: "transform", title: "시뮬레이션 준비하기", desc: "가상 고객이 대화에 참여할 수 있게 준비합니다.", input: ["samplingRunId"], output: ["agentIds"] },
  { action: "run_simulation", api: "POST /v1/simulations", type: "simulate", title: "반응 시뮬레이션 돌리기", desc: "가상 고객들이 주제에 대해 이야기하게 합니다.", input: ["agentIds"], output: ["simulationId"], defaultParams: { maxTurns: 12 } },
  { action: "analyze_results", api: "POST /v1/evaluations", type: "analyze", title: "결과 분석 보기", desc: "시뮬레이션 결과를 분석해 반응 리포트를 만듭니다.", input: ["simulationId"], output: ["evaluationIds"] },
];

function newStepId(): string {
  return `step_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-6)}`;
}

// badges — help text explains the importance levels inline (P2 inline help)
const BADGE_MAP = {
  required: { label: "✓ 필수", color: "border-primary/50 text-primary bg-primary/5", help: "결과물을 만들기 위해 꼭 필요한 단계예요. 건너뛰거나 삭제할 수 없어요." },
  recommended: { label: "● 추천", color: "border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-500/5", help: "결과 품질을 높여주는 단계예요. 원하면 건너뛰어도 돼요." },
  optional: { label: "○ 선택", color: "border-muted-foreground/30 text-muted-foreground bg-muted/10", help: "자유롭게 추가·삭제할 수 있는 단계예요." }
};

// Plain-language help per executable action (P2 inline help): what happens
// when the step runs, without internal API vocabulary.
const ACTION_HELP: Record<string, string> = {
  provide_input: "여기에 적은 내용이 다음 단계들의 재료가 돼요. 언제든 다시 수정할 수 있어요.",
  benchmark_reference: "선택한 여러 시나리오에서 공통 배경·갈등·분위기 패턴을 뽑아내요. 결과는 이야기 초안 단계에 자동으로 전달돼요.",
  draft_story: "AI가 아이디어를 읽고 제목·로그라인·줄거리가 있는 초안을 만들어요.",
  classify_story: "초안의 장르와 분위기를 자동으로 태그해서 나중에 찾기 쉽게 해줘요.",
  build_world: "등장인물·장소·사건과 그 관계를 정리한 '이야기 구조'를 만들어요. 고급 도구에서 그래프로 볼 수 있어요.",
  validate_world: "이야기 구조에 빠진 정보나 어긋난 연결이 없는지 자동으로 점검해요.",
  project_novel: "완성된 이야기 구조를 장면과 문장이 있는 소설 형태로 바꿔요.",
  project_roleplay: "이야기를 배경·역할·목표가 있는 롤플레이 시나리오로 바꿔요.",
  define_audience: "제품 설명을 바탕으로 어떤 특성의 고객 집단을 만들지 정의해요.",
  generate_personas: "정의한 특성에 따라 서로 다른 가상 고객 여러 명을 만들어요.",
  prepare_actors: "가상 고객들이 대화 시뮬레이션에 참여할 수 있도록 자동으로 준비해요.",
  run_simulation: "가상 고객들이 제품(또는 주제)에 대해 여러 차례 대화를 나눠요.",
  analyze_results: "대화 내용을 분석해 긍정/부정 반응과 주요 이유를 리포트로 정리해요.",
};

export default function WorkflowDetail() {
  const [, params] = useRoute("/workflows/:id");
  const id = params?.id || "";

  // Keep server-owned progress fresh while the page is open. This also
  // restores the latest generation phase after a reload or in another tab.
  const { data: workflow, isLoading } = useGetWorkflow(id, {
    query: {
      queryKey: getGetWorkflowQueryKey(id),
      refetchInterval: 1500,
    },
  });
  const updateWorkflow = useUpdateWorkflow();
  const runStep = useRunWorkflowStep();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [runningToTheEnd, setRunningToTheEnd] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  // Which step's run request is currently in flight (the server only flips the
  // stored status while it processes, so the client tracks it explicitly) and
  // when it started, to show a live elapsed timer instead of a frozen screen.
  const [activeStep, setActiveStep] = useState<{ id: string; startedAt: number } | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const serverRunningStep = workflow?.steps.find((step) => step.status === "running");
  const activeStartedAt = serverRunningStep?.progress?.startedAt
    ? new Date(serverRunningStep.progress.startedAt).getTime()
    : activeStep?.startedAt;
  useEffect(() => {
    if (!activeStep && !serverRunningStep) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeStep, serverRunningStep?.id]);
  const activeElapsedSec = activeStartedAt
    ? Math.max(0, Math.round((nowTick - activeStartedAt) / 1000))
    : 0;

  // Deletion Dialog State
  const [deleteContext, setDeleteContext] = useState<{ stepId: string; dependentCount: number } | null>(null);

  // Add Step Dialog State
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"catalog" | "manual">("catalog");
  const [addAction, setAddAction] = useState(STEP_CATALOG[0].action);
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addAfterLast, setAddAfterLast] = useState(true);

  const handleAddStep = () => {
    if (!workflow) return;
    const lastStep = workflow.steps[workflow.steps.length - 1];
    const dependencies = addAfterLast && lastStep ? [lastStep.id] : [];
    const depsMet = dependencies.every((depId) => {
      const dep = workflow.steps.find((s) => s.id === depId);
      return dep && (dep.status === "complete" || dep.status === "skipped");
    });
    let newStep: WorkflowStep;
    if (addMode === "catalog") {
      const entry = STEP_CATALOG.find((c) => c.action === addAction);
      if (!entry) return;
      newStep = {
        id: newStepId(),
        type: entry.type,
        title: addTitle.trim() || entry.title,
        description: entry.desc,
        importance: "optional",
        status: dependencies.length === 0 || depsMet ? "ready" : "pending",
        input: entry.input,
        output: entry.output,
        dependencies,
        binding: {
          action: entry.action,
          api: entry.api,
          ...(entry.defaultParams ? { params: entry.defaultParams } : {}),
        },
      };
    } else {
      if (!addTitle.trim()) {
        toast({ title: "제목을 입력해주세요.", variant: "destructive" });
        return;
      }
      newStep = {
        id: newStepId(),
        type: "input",
        title: addTitle.trim(),
        description: addDesc.trim() || null,
        importance: "optional",
        status: dependencies.length === 0 || depsMet ? "ready" : "pending",
        input: [],
        output: [],
        dependencies,
        binding: null,
      };
    }
    updateWorkflow.mutate(
      { id: workflow.id, data: { steps: [...workflow.steps, newStep] } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetWorkflowQueryKey(workflow.id), data);
          setAddOpen(false);
          setAddTitle("");
          setAddDesc("");
          toast({ title: "단계가 추가되었습니다." });
        },
        onError: (err: any) => {
          toast({ title: "추가 실패", description: err?.message || "단계를 추가하지 못했습니다.", variant: "destructive" });
        },
      },
    );
  };

  const handleRunStep = async (step: WorkflowStep, params?: Record<string, unknown>) => {
    setActiveStep({ id: step.id, startedAt: Date.now() });
    try {
      await runStep.mutateAsync({ id, stepId: step.id, data: params ? { params } : {} });
      queryClient.invalidateQueries({ queryKey: getGetWorkflowQueryKey(id) });
    } catch (e: any) {
      toast({ title: "실행 실패", description: e?.message || "단계를 실행하는 중 오류가 발생했습니다.", variant: "destructive" });
      setRunningToTheEnd(false);
    } finally {
      setActiveStep(null);
    }
  };

  const inputStepNeedsContent = (step: WorkflowStep) =>
    step.binding?.action === "provide_input" &&
    step.output.length > 0 &&
    !Object.values(step.binding?.params ?? {}).some(
      (v) => typeof v === "string" && v.trim(),
    );

  const handleRunToEnd = async () => {
    if (!workflow) return;
    setRunningToTheEnd(true);
    let currentWorkflow = workflow;

    try {
      while (true) {
        const nextReady = currentWorkflow.steps.find(s => s.status === 'ready');
        if (!nextReady) break; // done or blocked
        if (inputStepNeedsContent(nextReady)) {
          toast({ title: "입력이 필요해요", description: `"${nextReady.title}" 단계의 내용을 먼저 채워주세요.` });
          break;
        }

        setActiveStep({ id: nextReady.id, startedAt: Date.now() });
        const updated = await runStep.mutateAsync({ id, stepId: nextReady.id, data: {} });
        setActiveStep(null);
        currentWorkflow = updated as WorkflowRecord;
        queryClient.setQueryData(getGetWorkflowQueryKey(id), updated);
        
        // Brief pause for visual feedback
        await new Promise(r => setTimeout(r, 500));
        
        if (updated.status === 'failed') break;
      }
    } catch (e) {
      toast({ title: "실행 중단", description: "오류로 인해 자동 실행이 중단되었습니다.", variant: "destructive" });
    } finally {
      setActiveStep(null);
      setRunningToTheEnd(false);
    }
  };

  const attemptDeleteStep = (stepId: string) => {
    if (!workflow) return;
    const step = workflow.steps.find(s => s.id === stepId);
    if (step?.importance === 'required') {
      toast({ title: "삭제 불가", description: "필수 단계는 삭제할 수 없습니다.", variant: "destructive" });
      return;
    }
    
    const dependents = workflow.steps.filter(s => s.dependencies.includes(stepId));
    if (dependents.length > 0) {
      setDeleteContext({ stepId, dependentCount: dependents.length });
    } else {
      executeDelete(stepId);
    }
  };

  const executeDelete = (stepId: string) => {
    if (!workflow) return;
    const updatedSteps = workflow.steps
      .filter(s => s.id !== stepId)
      .map(s => ({
        ...s,
        dependencies: s.dependencies.filter(d => d !== stepId)
      }));

    updateWorkflow.mutate({ id, data: { steps: updatedSteps } }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetWorkflowQueryKey(id), data);
        toast({ title: "단계 삭제됨" });
      }
    });
  };

  const handleSkipStep = (stepId: string) => {
    if (!workflow) return;
    const updatedSteps = workflow.steps.map(s => 
      s.id === stepId ? { ...s, status: 'skipped' as const } : s
    );
    updateWorkflow.mutate({ id, data: { steps: updatedSteps } }, {
      onSuccess: (data) => queryClient.setQueryData(getGetWorkflowQueryKey(id), data)
    });
  };

  if (isLoading) {
    return <Layout><div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div></Layout>;
  }

  if (!workflow) {
    return <Layout><div className="p-8 text-center text-muted-foreground">워크플로를 찾을 수 없습니다.</div></Layout>;
  }

  const isComplete = workflow.status === 'complete';
  const hasReadySteps = workflow.steps.some(s => s.status === 'ready');
  const isSupportedType = ["novel", "roleplay", "product-reaction"].includes(workflow.intent.outputType);
  // Workflow status remains "running" between completed steps. Only an
  // actually-running step (or the local run-to-end loop) should lock the UI.
  const isRunning = workflow.steps.some(s => s.status === 'running') || runningToTheEnd || !!activeStep;

  // Progress figures for the live banner: counts only steps that participate
  // in execution (skipped ones are excluded from the denominator).
  const countableSteps = workflow.steps.filter(s => s.status !== 'skipped');
  const doneCount = countableSteps.filter(s => s.status === 'complete').length;
  const activeStepRecord = activeStep
    ? workflow.steps.find(s => s.id === activeStep.id) ?? serverRunningStep
    : serverRunningStep;
  const activeStepNumber = activeStepRecord ? workflow.steps.indexOf(activeStepRecord) + 1 : null;

  return (
    <Layout 
      breadcrumbs={[
        { label: "내 작업", href: "/workflows" },
        { label: workflow.title || "새 워크플로" }
      ]}
      contextHeader={
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="headline-lg mb-1">{workflow.title}</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">{workflow.intent.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isComplete && isSupportedType && (
              <>
                <Button 
                  variant="outline" 
                  disabled={isRunning || !hasReadySteps}
                  onClick={() => {
                    const next = workflow.steps.find(s => s.status === 'ready');
                    if (!next) return;
                    if (inputStepNeedsContent(next)) {
                      toast({ title: "입력이 필요해요", description: `"${next.title}" 단계의 내용을 먼저 채워주세요.` });
                      return;
                    }
                    handleRunStep(next);
                  }}
                >
                  <Play className="h-4 w-4 mr-2" /> 다음 단계 실행
                </Button>
                <Button 
                  disabled={isRunning || !hasReadySteps}
                  onClick={handleRunToEnd}
                >
                  {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FastForward className="h-4 w-4 mr-2" />}
                  {isRunning ? `실행 중 (${doneCount}/${countableSteps.length})` : "끝까지 실행"}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-8 pb-32">
        
        {!isSupportedType && (
          <div className="border border-dashed border-border bg-muted/20 p-6 rounded-xl" data-testid="banner-coming-soon">
            <h2 className="font-bold mb-1">이 결과물은 아직 준비 중이에요</h2>
            <p className="text-sm text-muted-foreground">
              곧 지원될 예정이에요. 지금은 소설, 롤플레이, 제품 반응 시뮬레이션을 만들어볼 수 있어요.
            </p>
          </div>
        )}

        {isRunning && activeStepRecord && (
          <div className="border border-primary/40 bg-primary/5 p-4 rounded-sm" data-testid="banner-run-progress">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>
                  {activeStepNumber != null && `${activeStepNumber}단계 `}
                  "{activeStepRecord.title}" 진행 중…
                </span>
              </div>
              <div className="text-xs font-mono text-muted-foreground" data-testid="text-run-elapsed">
                {activeElapsedSec}초 경과
              </div>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${countableSteps.length ? Math.round((doneCount / countableSteps.length) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              전체 {countableSteps.length}단계 중 {doneCount}단계 완료 — AI가 실제로 내용을 생성하는 단계는 수십 초가 걸릴 수 있어요. 각 단계가 끝나면 아래 목록에 결과가 바로 표시됩니다.
            </p>
            <WorkflowGenerationProgress
              progress={activeStepRecord.progress}
              testId="list-generation-progress"
            />
          </div>
        )}

        {isComplete && <WorkflowResultSection workflow={workflow} />}

        <div className="relative">
          <div className="absolute left-6 top-6 bottom-6 w-px bg-border z-0"></div>

          <div className="space-y-6 relative z-10">
            {workflow.steps.map((step, index) => (
              <StepCard 
                key={step.id} 
                step={step} 
                index={index}
                workflow={workflow}
                isEditing={editingStepId === step.id}
                onEdit={() => setEditingStepId(step.id)}
                onCancelEdit={() => setEditingStepId(null)}
                onRun={(params?: Record<string, unknown>) => handleRunStep(step, params)}
                onDelete={() => attemptDeleteStep(step.id)}
                onSkip={() => handleSkipStep(step.id)}
                isRunning={isRunning}
                isActive={activeStep?.id === step.id}
                activeElapsedSec={activeStep?.id === step.id ? activeElapsedSec : 0}
              />
            ))}
            
            <div className="flex pl-[52px]">
              <Button variant="outline" size="sm" className="border-dashed" onClick={() => setAddOpen(true)} data-testid="button-add-step">
                <Plus className="h-4 w-4 mr-2" /> 단계 추가
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>단계 추가</DialogTitle>
            <DialogDescription>
              자동 실행되는 단계를 카탈로그에서 고르거나, 직접 할 일을 추가할 수 있어요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={addMode === "catalog" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("catalog")}
                data-testid="button-add-mode-catalog"
              >
                자동 실행 단계
              </Button>
              <Button
                variant={addMode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setAddMode("manual")}
                data-testid="button-add-mode-manual"
              >
                직접 할 일
              </Button>
            </div>
            {addMode === "catalog" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>단계 종류</Label>
                  <Select value={addAction} onValueChange={setAddAction}>
                    <SelectTrigger data-testid="select-add-action">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STEP_CATALOG.map((c) => (
                        <SelectItem key={c.action} value={c.action}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {STEP_CATALOG.find((c) => c.action === addAction)?.desc}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>제목 (선택)</Label>
                  <Input
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    placeholder={STEP_CATALOG.find((c) => c.action === addAction)?.title}
                    data-testid="input-add-title"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>제목</Label>
                  <Input
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    placeholder="예: 결과 검토하고 팀에 공유하기"
                    data-testid="input-add-title-manual"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>설명 (선택)</Label>
                  <Textarea
                    value={addDesc}
                    onChange={(e) => setAddDesc(e.target.value)}
                    rows={2}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  직접 할 일은 자동 실행 없이 체크 용도로 사용됩니다.
                </p>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={addAfterLast}
                onChange={(e) => setAddAfterLast(e.target.checked)}
                data-testid="checkbox-add-after-last"
              />
              마지막 단계가 끝난 뒤에 실행
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>취소</Button>
            <Button onClick={handleAddStep} disabled={updateWorkflow.isPending} data-testid="button-confirm-add-step">
              {updateWorkflow.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteContext} onOpenChange={(open) => !open && setDeleteContext(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>단계 삭제 경고</AlertDialogTitle>
            <AlertDialogDescription>
              이 단계를 의존하는 다른 단계가 {deleteContext?.dependentCount}개 있습니다. 삭제하면 해당 단계들의 의존성이 제거되어 예상치 못한 동작이 발생할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel>취소</AlertDialogCancel>
            <Button 
              variant="secondary" 
              onClick={() => {
                if (deleteContext) handleSkipStep(deleteContext.stepId);
                setDeleteContext(null);
              }}
            >
              건너뛰기로 대체
            </Button>
            <AlertDialogAction 
              onClick={() => {
                if (deleteContext) executeDelete(deleteContext.stepId);
              }} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              계속 진행 (삭제)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function WorkflowResultSection({ workflow }: { workflow: WorkflowRecord }) {
  const simEnabled = !!workflow.artifacts.simulationId && workflow.intent.outputType === 'product-reaction';
  const { data: simulation } = useGetSimulation(workflow.artifacts.simulationId || "", {
    query: { enabled: simEnabled } as any
  });
  const { data: evals } = useListEvaluations({ simulationId: workflow.artifacts.simulationId || "" }, {
    query: { enabled: simEnabled } as any
  });

  const isProductReaction = workflow.intent.outputType === 'product-reaction';
  const isNarrative = workflow.intent.outputType === 'novel' || workflow.intent.outputType === 'roleplay';

  // Find projection result payload
  const projectionStep = workflow.steps.find(s => s.type === 'project');
  const payload: any = projectionStep?.result?.payload;
  const narrative = getNarrativeResult(payload);

  // Carry the original intent material into reuse suggestions.
  const reuseDescription =
    workflow.intent.description ||
    workflow.intent.extractedInputs?.idea ||
    workflow.intent.extractedInputs?.product ||
    workflow.title;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 md:p-6 flex flex-col gap-6">
      <h2 className="headline-lg flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" /> 결과가 완성되었습니다
      </h2>

      {isProductReaction && simulation && (
        <div className="space-y-4">
          {(() => {
            const positions = simulation.outcome?.finalPositions ?? {};
            const values = Object.values(positions);
            const positive = values.filter((v) => v > 0.05).length;
            const negative = values.filter((v) => v < -0.05).length;
            const neutral = values.length - positive - negative;
            const pct = (n: number) => (values.length ? Math.round((n / values.length) * 100) : 0);
            const nameOf = (agentId: string) =>
              simulation.participants.find((p) => p.agentId === agentId)?.name || agentId;
            const roleOf = (agentId: string) =>
              simulation.participants.find((p) => p.agentId === agentId)?.role || "";
            const agentEvals = (evals ?? []).filter((e) => e.subjectType === 'agent');
            const avgScore = (key: string) => {
              const vals = agentEvals.map((e) => e.scores[key]).filter((v): v is number => typeof v === 'number');
              return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            };
            const coop = avgScore('cooperativeness');
            const activity = avgScore('activityScore');
            const volatility = avgScore('stateVolatility');
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="tech-label text-muted-foreground mb-1">긍정적 반응</div>
                    <div className="text-xl font-bold text-emerald-500">{pct(positive)}%</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="tech-label text-muted-foreground mb-1">부정적 반응</div>
                    <div className="text-xl font-bold text-red-500">{pct(negative)}%</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="tech-label text-muted-foreground mb-1">중립</div>
                    <div className="text-xl font-bold">{pct(neutral)}%</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="tech-label text-muted-foreground mb-1">최종 합의</div>
                    <div className="text-xl font-bold">{simulation.outcome?.agreementReached ? "합의 도출" : "결렬"}</div>
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-sm leading-relaxed">
                  {simulation.outcome?.summary}
                </div>
                {(coop !== null || activity !== null || volatility !== null) && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="tech-label text-muted-foreground mb-3">주요 동인과 우려</div>
                    <ul className="text-sm space-y-1.5">
                      {coop !== null && (
                        <li>
                          협조적 태도 평균 {(coop * 100).toFixed(0)}점 — {coop >= 0.6 ? "대체로 우호적으로 논의에 참여했습니다." : coop >= 0.4 ? "찬반이 갈리는 중립적 분위기였습니다." : "설득에 저항하는 흐름이 우세했습니다."}
                        </li>
                      )}
                      {activity !== null && (
                        <li>
                          참여도 평균 {(activity * 100).toFixed(0)}점 — {activity >= 0.6 ? "관심이 높아 활발히 의견을 냈습니다." : "관심이 제한적이어서 발언이 적었습니다."}
                        </li>
                      )}
                      {volatility !== null && (
                        <li>
                          입장 변동성 {(volatility * 100).toFixed(0)}점 — {volatility >= 0.3 ? "설득에 따라 태도가 크게 흔들렸습니다. 메시지에 따라 반응이 달라질 여지가 큽니다." : "초기 입장을 대체로 유지했습니다. 첫인상이 중요합니다."}
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                {values.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="tech-label text-muted-foreground mb-3">가상 고객별 반응 비교</div>
                    <div className="space-y-2">
                      {Object.entries(positions).map(([agentId, v]) => (
                        <div key={agentId} className="flex items-center gap-3 text-sm">
                          <span className="w-40 truncate shrink-0">{nameOf(agentId)}</span>
                          <span className="w-24 truncate shrink-0 text-xs text-muted-foreground">{roleOf(agentId)}</span>
                          <div className="flex-1 h-2 bg-muted/50 relative overflow-hidden">
                            <div
                              className={`absolute top-0 h-full ${v >= 0 ? "bg-emerald-500 left-1/2" : "bg-red-500 right-1/2"}`}
                              style={{ width: `${Math.min(Math.abs(v), 1) * 50}%` }}
                            />
                            <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                          </div>
                          <span className={`w-14 text-right font-mono text-xs ${v > 0.05 ? "text-emerald-500" : v < -0.05 ? "text-red-500" : "text-muted-foreground"}`}>
                            {v > 0.05 ? "긍정" : v < -0.05 ? "부정" : "중립"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          <Button asChild>
            <Link href={`/simulations/${workflow.artifacts.simulationId}`}>
              <BarChart className="h-4 w-4 mr-2" /> 전체 시뮬레이션 리포트 보기
            </Link>
          </Button>
        </div>
      )}

      {isNarrative && narrative && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 md:p-6">
            <h3 className="headline-lg mb-2" data-testid="text-result-title">{narrative.title}</h3>
            {narrative.kind === 'novel' && (
              <>
                {narrative.subtitle && (
                  <p className="text-muted-foreground italic mb-6">{narrative.subtitle}</p>
                )}
                {narrative.characters.length > 0 && (
                  <div className="mb-6">
                    <div className="tech-label text-muted-foreground mb-2">등장인물</div>
                    <div className="flex flex-wrap gap-2">
                      {narrative.characters.map((c, i) => (
                        <div key={i} className="border border-border rounded-full bg-muted/20 px-3 py-1.5 text-sm">
                          <span className="font-semibold">{c.name}</span>
                          {c.arc && <span className="text-muted-foreground"> — {c.arc}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-5" data-testid="section-result-scenes">
                  {narrative.scenes.map((scene, i) => (
                    <div key={i} className="border-l-2 border-primary/30 pl-4 py-1">
                      <h4 className="font-semibold text-sm mb-1.5">{scene.heading}</h4>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{scene.prose}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
            {narrative.kind === 'roleplay' && (
              <div className="space-y-5" data-testid="section-result-roleplay">
                <div>
                  <div className="tech-label text-muted-foreground mb-1.5">배경 상황</div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{narrative.context}</p>
                </div>
                {narrative.playerRole && (
                  <div>
                    <div className="tech-label text-muted-foreground mb-1.5">당신의 역할</div>
                    <p className="text-sm">{narrative.playerRole}</p>
                  </div>
                )}
                {narrative.objectives.length > 0 && (
                  <div>
                    <div className="tech-label text-muted-foreground mb-1.5">목표</div>
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      {narrative.objectives.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                )}
                {narrative.personas.length > 0 && (
                  <div>
                    <div className="tech-label text-muted-foreground mb-2">함께 등장하는 인물</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {narrative.personas.map((p, i) => (
                        <div key={i} className="border border-border rounded-lg bg-muted/20 p-3 text-sm">
                          <div className="font-semibold">{p.name} <span className="font-normal text-muted-foreground">· {p.role}</span></div>
                          {p.background && <p className="text-xs text-muted-foreground mt-1">{p.background}</p>}
                          {p.traits.length > 0 && (
                            <p className="text-xs mt-1">{p.traits.join(" · ")}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {narrative.recommendedFlow.length > 0 && (
                  <div>
                    <div className="tech-label text-muted-foreground mb-1.5">추천 진행 흐름</div>
                    <ol className="text-sm list-decimal pl-5 space-y-1">
                      {narrative.recommendedFlow.map((f, i) => <li key={i}>{f}</li>)}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
          {workflow.artifacts.contentId && (
            <Button asChild>
              <Link href={`/content/${workflow.artifacts.contentId}`}>
                <FileText className="h-4 w-4 mr-2" /> 이야기 구조 상세보기
              </Link>
            </Button>
          )}
        </div>
      )}

      {!isProductReaction && !isNarrative && (
        <div>
          <p className="text-muted-foreground mb-4">워크플로 실행이 완료되었습니다.</p>
          <div className="flex flex-wrap gap-4">
            {workflow.artifacts.simulationId && (
              <Button asChild variant="outline">
                <Link href={`/simulations/${workflow.artifacts.simulationId}`}>
                  <BarChart className="h-4 w-4 mr-2" /> 시뮬레이션 보기
                </Link>
              </Button>
            )}
            {workflow.artifacts.contentId && (
              <Button asChild variant="outline">
                <Link href={`/content/${workflow.artifacts.contentId}`}>
                  <FileText className="h-4 w-4 mr-2" /> 내용 보기
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-primary/20">
        <ReuseSection
          sourceDescription={reuseDescription}
          excludeOutputType={workflow.intent.outputType}
          existingArtifacts={workflow.artifacts}
        />
      </div>
    </div>
  );
}

function StepCard({ 
  step, index, workflow, isEditing, onEdit, onCancelEdit, onRun, onDelete, onSkip, isRunning, isActive, activeElapsedSec
}: { 
  step: WorkflowStep; 
  index: number; 
  workflow: WorkflowRecord;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onRun: (params?: Record<string, unknown>) => void;
  onDelete: () => void;
  onSkip: () => void;
  isRunning: boolean;
  isActive: boolean;
  activeElapsedSec: number;
}) {
  const badge = BADGE_MAP[step.importance as keyof typeof BADGE_MAP] || BADGE_MAP.optional;
  const isComplete = step.status === 'complete';
  const isFailed = step.status === 'failed';
  const isSkipped = step.status === 'skipped';
  // While a run request is in flight the client-side record still says
  // 'ready', so treat the actively executing step as running too.
  const isStepRunning = step.status === 'running' || isActive;
  const isReady = step.status === 'ready' && !isActive;
  const isProvideInput = step.binding?.action === 'provide_input' && step.output.length > 0;

  // Form values for input steps (idea / product+audience), prefilled from the
  // planner-extracted params so users can review and adjust before running.
  const initialParams = (step.binding?.params ?? {}) as Record<string, unknown>;
  const [ideaValue, setIdeaValue] = useState(typeof initialParams.idea === 'string' ? initialParams.idea : '');
  const [productValue, setProductValue] = useState(typeof initialParams.product === 'string' ? initialParams.product : '');
  const [audienceValue, setAudienceValue] = useState(typeof initialParams.audience === 'string' ? initialParams.audience : '');
  const isStoryInput = step.output.includes('idea');

  const submitInput = () => {
    if (isStoryInput) {
      if (!ideaValue.trim()) return;
      onRun({ idea: ideaValue.trim() });
    } else {
      if (!productValue.trim()) return;
      onRun({
        product: productValue.trim(),
        ...(audienceValue.trim() ? { audience: audienceValue.trim() } : {}),
      });
    }
  };
  const inputFilled = isStoryInput ? !!ideaValue.trim() : !!productValue.trim();

  const updateWorkflow = useUpdateWorkflow();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState(step.title);
  const [importance, setImportance] = useState(step.importance);
  const [params, setParams] = useState(step.binding?.params ? JSON.stringify(step.binding.params, null, 2) : "{}");

  const handleSave = () => {
    try {
      const parsed = params.trim() ? JSON.parse(params) : undefined;
      const updatedSteps = workflow.steps.map(s => {
        if (s.id === step.id) {
          return {
            ...s,
            title,
            importance: importance as any,
            binding: s.binding ? { ...s.binding, params: parsed } : null
          };
        }
        return s;
      });
      updateWorkflow.mutate({ id: workflow.id, data: { steps: updatedSteps } }, {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetWorkflowQueryKey(workflow.id), data);
          onCancelEdit();
          toast({ title: "저장되었습니다." });
        }
      });
    } catch (e) {
      toast({ title: "오류", description: "올바른 JSON 형식이 아닙니다.", variant: "destructive" });
    }
  };

  return (
    <div className={cn(
      "flex gap-4",
      isSkipped && "opacity-50 grayscale transition-all hover:grayscale-0 hover:opacity-100"
    )}>
      {/* Node icon */}
      <div className="shrink-0 w-12 flex justify-center mt-4">
        <div className={cn(
          "w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background z-10",
          isComplete ? "border-emerald-500 text-emerald-500" :
          isStepRunning ? "border-primary text-primary" :
          isFailed ? "border-destructive text-destructive" :
          isReady ? "border-primary text-primary" :
          "border-muted-foreground/30 text-muted-foreground"
        )}>
          {isComplete ? <Check className="h-4 w-4" /> :
           isStepRunning ? <Loader2 className="h-4 w-4 animate-spin" /> :
           isFailed ? <AlertCircle className="h-4 w-4" /> :
           <span className="text-xs font-mono font-bold">{index + 1}</span>}
        </div>
      </div>

      {/* Card */}
      <div className={cn(
        "flex-1 border rounded-xl bg-card relative shadow-sm transition-all overflow-hidden",
        isReady ? "border-primary/50 shadow-primary/5" : "border-border",
        isStepRunning && "border-primary ring-1 ring-primary/30"
      )}>
        {!isEditing ? (
          <div className="p-4 flex flex-wrap items-start justify-between gap-2 border-b border-border/50">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider cursor-help", badge.color)}>
                      {badge.label}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{badge.help}</TooltipContent>
                </Tooltip>
                <h3 className="font-bold">{step.title}</h3>
                {step.binding?.action && ACTION_HELP[step.binding.action] && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground" data-testid={`button-step-help-${step.id}`}>
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{ACTION_HELP[step.binding.action]}</TooltipContent>
                  </Tooltip>
                )}
              </div>
              {step.description && <p className="text-sm text-muted-foreground">{step.description}</p>}
              {isStepRunning && (
                <div className="mt-2 inline-flex items-center gap-2 text-xs font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-1" data-testid={`text-step-elapsed-${step.id}`}>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  AI 작업 진행 중{activeElapsedSec > 0 ? ` — ${activeElapsedSec}초 경과` : "…"}
                </div>
              )}
              {!!step.progress?.events.length && (
                <WorkflowGenerationProgress
                  progress={step.progress}
                  testId={`list-step-progress-${step.id}`}
                />
              )}
              {!step.binding && (
                <div className="mt-2 text-xs font-mono text-muted-foreground inline-flex items-center bg-muted px-2 py-0.5 rounded-full">
                  자동 실행 없음
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isComplete && !isStepRunning && (
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Settings className="h-4 w-4 mr-2" /> 편집
                </Button>
              )}
              {isReady && !isRunning && !isProvideInput && (
                <Button size="sm" onClick={() => onRun()}>
                  <Play className="h-4 w-4 mr-2" /> 실행
                </Button>
              )}
              {isFailed && !isRunning && !isProvideInput && (
                <Button size="sm" variant="destructive" onClick={() => onRun()}>
                  <Play className="h-4 w-4 mr-2" /> 재시도
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-border/50 bg-muted/10 space-y-4">
            <div className="grid grid-cols-[1fr_120px] gap-4">
              <div className="space-y-1">
                <label className="tech-label text-muted-foreground">단계 제목</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-1">
                <label className="tech-label text-muted-foreground">중요도</label>
                <Select value={importance} onValueChange={(v) => setImportance(v as any)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">필수</SelectItem>
                    <SelectItem value="recommended">추천</SelectItem>
                    <SelectItem value="optional">선택</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {step.binding && (
              <div className="space-y-1">
                <label className="tech-label text-muted-foreground">파라미터 (JSON)</label>
                <Textarea 
                  value={params} 
                  onChange={(e) => setParams(e.target.value)}
                  className="font-mono text-sm min-h-[120px] bg-background"
                />
              </div>
            )}
            
            <div className="flex justify-between items-center pt-2">
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20" 
                  onClick={onDelete}
                  disabled={step.importance === 'required'}
                  title={step.importance === 'required' ? "필수 단계는 삭제할 수 없습니다" : undefined}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> 삭제
                </Button>
                {step.importance !== 'required' && !isSkipped && (
                  <Button size="sm" variant="outline" onClick={onSkip}>건너뛰기</Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={onCancelEdit}>취소</Button>
                <Button size="sm" onClick={handleSave}>저장</Button>
              </div>
            </div>
          </div>
        )}

        {isProvideInput && (isReady || isFailed) && !isEditing && (
          <div className="p-4 border-b border-border/50 bg-muted/10 space-y-3" data-testid={`form-input-step-${step.id}`}>
            {isStoryInput ? (
              <div className="space-y-1.5">
                <Label>아이디어</Label>
                <Textarea
                  value={ideaValue}
                  onChange={(e) => setIdeaValue(e.target.value)}
                  placeholder="예: 우주 정거장에 고립된 두 연구원이 정체불명의 신호를 발견하는 이야기"
                  rows={3}
                  className="bg-background"
                  data-testid="input-step-idea"
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>제품/서비스 설명</Label>
                  <Textarea
                    value={productValue}
                    onChange={(e) => setProductValue(e.target.value)}
                    placeholder="예: 노이즈 캔슬링을 지원하는 무선 이어폰 신제품"
                    rows={3}
                    className="bg-background"
                    data-testid="input-step-product"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>타겟 고객 (선택)</Label>
                  <Input
                    value={audienceValue}
                    onChange={(e) => setAudienceValue(e.target.value)}
                    placeholder="예: 20-30대 직장인"
                    className="bg-background"
                    data-testid="input-step-audience"
                  />
                </div>
              </>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={submitInput} disabled={!inputFilled || isRunning} data-testid="button-submit-input-step">
                <Play className="h-4 w-4 mr-2" /> 이 내용으로 진행
              </Button>
            </div>
          </div>
        )}

        {isFailed && step.error && (
          <div className="px-4 py-3 bg-destructive/10 text-destructive text-sm font-mono border-b border-border/50 overflow-x-auto">
            Error: {step.error}
          </div>
        )}
      </div>
    </div>
  );
}
