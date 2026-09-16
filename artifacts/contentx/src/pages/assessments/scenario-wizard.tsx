import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAssessmentsQueryKey,
  useCreateAssessmentFromTemplate,
  useListAssessmentTemplates,
  type AssessmentScenarioTemplate,
  type AssessmentTemplateInstantiationResult,
} from "@workspace/api-client-react";
import { 
  ArrowRight, ArrowLeft, Check, CheckCircle2, Clock, 
  Loader2, Sparkles, User, Users, ShieldAlert, Target, BookOpen
} from "lucide-react";

type ScenarioTemplate = AssessmentScenarioTemplate;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isScenarioTemplate(value: unknown): value is ScenarioTemplate {
  if (!isRecord(value) || !isRecord(value.dramatic) || !isRecord(value.evaluation)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.subtitle === "string" &&
    typeof value.categoryLabel === "string" &&
    typeof value.targetRole === "string" &&
    typeof value.description === "string" &&
    typeof value.estimatedTime === "number" &&
    typeof value.dramatic.synopsis === "string" &&
    Array.isArray(value.dramatic.characters) &&
    value.dramatic.characters.every(
      (character) =>
        isRecord(character) &&
        typeof character.name === "string" &&
        typeof character.role === "string" &&
        typeof character.motivation === "string",
    ) &&
    Array.isArray(value.competencies) &&
    value.competencies.every(
      (competency) =>
        isRecord(competency) &&
        typeof competency.key === "string" &&
        typeof competency.name === "string",
    ) &&
    Array.isArray(value.evaluation.dimensions) &&
    value.evaluation.dimensions.every(
      (dimension) =>
        isRecord(dimension) &&
        typeof dimension.key === "string" &&
        typeof dimension.label === "string" &&
        typeof dimension.weight === "number" &&
        Array.isArray(dimension.criteria) &&
        dimension.criteria.every((criterion) => typeof criterion === "string"),
    )
  );
}

function isScenarioTemplateList(value: unknown): value is ScenarioTemplate[] {
  return Array.isArray(value) && value.every(isScenarioTemplate);
}

function isInstantiationResult(value: unknown): value is AssessmentTemplateInstantiationResult {
  return (
    isRecord(value) &&
    typeof value.assessmentId === "string" &&
    typeof value.version === "number" &&
    typeof value.title === "string"
  );
}

type GenerationError = {
  kind: "quality" | "provider" | "generic";
  message: string;
  diagnostics: string[];
};

function getGenerationError(error: unknown, fallback: string): GenerationError {
  const diagnostics = isRecord(error) && isRecord(error.data) && Array.isArray(error.data.diagnostics)
    ? error.data.diagnostics.filter((item): item is string => typeof item === "string")
    : [];
  if (isRecord(error)) {
    if (error.status === 422) {
      return {
        kind: "quality",
        message: "AI가 만든 초안이 평가 품질 기준을 충족하지 못했습니다. 입력은 그대로 보존되어 있으니 다시 생성하거나 상황을 더 구체적으로 보완해 주세요.",
        diagnostics,
      };
    }
    if (error.status === 502) {
      return {
        kind: "provider",
        message: "AI 생성 제공자가 일시적으로 응답하지 않았습니다. 저장된 내용은 없으며, 입력은 그대로 보존되어 있습니다. 잠시 후 다시 시도해 주세요.",
        diagnostics,
      };
    }
    if (error.status === 404) {
      return { kind: "generic", message: "시나리오 템플릿 서비스를 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.", diagnostics };
    }
    if (typeof error.status === "number" && error.status >= 500) {
      return { kind: "provider", message: "시나리오 서비스가 일시적으로 응답하지 않습니다. 입력은 그대로 보존되어 있습니다. 잠시 후 다시 시도해 주세요.", diagnostics };
    }
    if (isRecord(error.data) && typeof error.data.error === "string") {
      const message = error.data.error.trim();
      if (message) return { kind: "generic", message, diagnostics };
    }
    if (typeof error.message === "string" && error.message.trim()) {
      return { kind: "generic", message: error.message, diagnostics };
    }
  }
  return { kind: "generic", message: fallback, diagnostics };
}

function getTemplateLoadError(error: unknown): string {
  if (isRecord(error) && error.status === 502) {
    return "시나리오 API 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }
  return getGenerationError(error, "템플릿 목록을 불러오지 못했습니다.").message;
}

export default function ScenarioWizard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const templateQuery = useListAssessmentTemplates();
  const createFromTemplate = useCreateAssessmentFromTemplate();
  const initializedTemplateDefaults = useRef(false);
  const submitLock = useRef(false);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [companyContext, setCompanyContext] = useState("");
  const [participantRole, setParticipantRole] = useState("");
  const [situation, setSituation] = useState("");
  const [counterpartName, setCounterpartName] = useState("");
  const [counterpartRole, setCounterpartRole] = useState("");
  const [counterpartOrganization, setCounterpartOrganization] = useState("");
  const [counterpartStance, setCounterpartStance] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generationState, setGenerationState] = useState<"idle" | "generating" | "failed">("idle");
  const [generationError, setGenerationError] = useState<GenerationError | null>(null);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);

  const templatePayload = templateQuery.data as unknown;
  const templates = isScenarioTemplateList(templatePayload) ? templatePayload : [];
  const loadingTemplates = templateQuery.isLoading || templateQuery.isFetching;
  const templateLoadError = templateQuery.isError
    ? getTemplateLoadError(templateQuery.error)
    : templateQuery.isSuccess && !isScenarioTemplateList(templatePayload)
      ? "템플릿 응답 형식이 올바르지 않습니다. 다시 시도해 주세요."
      : templateQuery.isSuccess && templates.length === 0
        ? "현재 사용할 수 있는 시나리오 템플릿이 없습니다."
        : null;

  useEffect(() => {
    if (initializedTemplateDefaults.current || templates.length === 0) return;

    const urlParams = new URLSearchParams(window.location.search);
    const requestedTemplate = urlParams.get("templateId");
    const initial = templates.find((template) => template.id === requestedTemplate) || templates[0];
    initializedTemplateDefaults.current = true;
    setSelectedTemplateId(initial.id);
    setParticipantRole(initial.targetRole);
    if (initial.dramatic.characters[0]) {
      setCounterpartName(initial.dramatic.characters[0].name);
      setCounterpartRole(initial.dramatic.characters[0].role);
      setCounterpartStance(initial.dramatic.characters[0].motivation);
    }
  }, [templates]);

  useEffect(() => {
    if (generationState !== "generating" || !generationStartedAt) return;
    const updateElapsed = () => setGenerationElapsedSeconds(Math.floor((Date.now() - generationStartedAt) / 1000));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(timer);
  }, [generationState, generationStartedAt]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  const handleTemplateSelect = (template: ScenarioTemplate) => {
    setSelectedTemplateId(template.id);
    if (!participantRole || templates.some((t) => t.targetRole === participantRole)) {
      setParticipantRole(template.targetRole);
    }
    if (template.dramatic.characters[0]) {
      setCounterpartName(template.dramatic.characters[0].name);
      setCounterpartRole(template.dramatic.characters[0].role);
      setCounterpartStance(template.dramatic.characters[0].motivation);
    }
  };

  const handleCreateScenario = async () => {
    if (submitLock.current || isSubmitting) return;
    if (!companyContext.trim()) {
      toast({
        variant: "destructive",
        title: "회사/조직명을 입력하세요",
        description: "시나리오의 현실적인 맥락을 위해 회사 또는 부서명을 필수로 입력해야 합니다.",
      });
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);
    setGenerationState("generating");
    setGenerationError(null);
    setGenerationStartedAt(Date.now());
    setGenerationElapsedSeconds(0);
    try {
      const result = await createFromTemplate.mutateAsync({
        data: {
          templateId: selectedTemplateId,
          companyContext: companyContext.trim(),
          participantRole: participantRole.trim() || undefined,
          situation: situation.trim() || undefined,
          counterpartName: counterpartName.trim() || undefined,
          counterpartRole: counterpartRole.trim() || undefined,
          counterpartOrganization: counterpartOrganization.trim() || undefined,
          counterpartStance: counterpartStance.trim() || undefined,
        },
      });
      if (!isInstantiationResult(result)) {
        throw new Error("생성 결과 형식이 올바르지 않습니다. 저장된 평가 목록을 확인해 주세요.");
      }

      queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() });

      toast({
        title: "시나리오 초안이 생성되었습니다!",
        description: `v${result.version} (${result.title}) 검토 및 미리보기 페이지로 이동합니다.`,
      });

      // Redirect to assessment details page
      setLocation(`/assessments/${result.assessmentId}?version=${result.version}`);
    } catch (error: unknown) {
      const resolvedError = getGenerationError(error, "시나리오를 생성하는 중 오류가 발생했습니다.");
      setGenerationState("failed");
      setGenerationError(resolvedError);
      toast({
        variant: "destructive",
        title: "생성 실패",
        description: resolvedError.message,
      });
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Layout
      breadcrumbs={[
        { label: "ContentX", href: "/" },
        { label: "새 시나리오 마법사" },
      ]}
    >
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        {/* Wizard Progress Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Assessment 시나리오 마법사</h1>
              <p className="text-sm text-muted-foreground mt-1">
                템플릿과 회사 맥락을 바탕으로 AI가 시간선, 이해관계, 인물별 대화 전략, 3막 흐름과 운영 규칙까지 깊이 설계합니다.
              </p>
            </div>
            <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
              STEP {step} / 3
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div
              className={`h-2 rounded-full transition-colors ${
                step >= 1 ? "bg-primary" : "bg-muted"
              }`}
            />
            <div
              className={`h-2 rounded-full transition-colors ${
                step >= 2 ? "bg-primary" : "bg-muted"
              }`}
            />
            <div
              className={`h-2 rounded-full transition-colors ${
                step >= 3 ? "bg-primary" : "bg-muted"
              }`}
            />
          </div>
        </div>

        {/* STEP 1: 템플릿 선택 */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" /> 어떤 상황을 평가하시겠습니까?
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                기업 현장에서 가장 검증된 3가지 핵심 롤플레이 템플릿 중 하나를 선택하세요.
              </p>
            </div>

            {loadingTemplates ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templateLoadError ? (
              <div
                role="alert"
                data-testid="scenario-template-error"
                className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
              >
                <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
                <h3 className="mt-3 font-semibold">템플릿을 불러오지 못했습니다</h3>
                <p className="mt-1 text-sm text-muted-foreground">{templateLoadError}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => void templateQuery.refetch()}
                  disabled={templateQuery.isFetching}
                >
                  {templateQuery.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  다시 시도
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                {templates.map((template) => {
                  const isSelected = template.id === selectedTemplateId;
                  return (
                    <div
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                          : "bg-card hover:border-primary/50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant={isSelected ? "default" : "secondary"} className="text-xs">
                            {template.categoryLabel}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {template.estimatedTime}분
                          </div>
                        </div>

                        <h3 className="font-bold text-base mb-1">{template.title}</h3>
                        <p className="text-xs text-muted-foreground mb-3 font-medium">
                          {template.subtitle}
                        </p>
                        <p className="text-xs text-muted-foreground/90 line-clamp-3 leading-relaxed mb-4">
                          {template.description}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-border/50">
                        <div className="text-[11px] text-muted-foreground font-medium mb-1 flex items-center gap-1">
                          <User className="h-3 w-3 text-primary" /> 대상: {template.targetRole}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.competencies.slice(0, 2).map((comp) => (
                            <span
                              key={comp.key}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                            >
                              {comp.name}
                            </span>
                          ))}
                          {template.competencies.length > 2 && (
                            <span className="text-[10px] px-1 py-0.5 text-muted-foreground">
                              +{template.competencies.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setStep(2)}
                disabled={loadingTemplates || Boolean(templateLoadError) || !selectedTemplate}
                className="px-6"
              >
                다음: 회사 상황 입력 <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: 우리 회사 상황 입력 */}
        {step === 2 && selectedTemplate && (
          <div className="space-y-6">
            <div className="border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" /> 우리 회사 상황에 맞게 수정하세요
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    선택한 템플릿 [<b>{selectedTemplate.title}</b>]에 실제 부서와 응시자 역할을 부여합니다.
                  </p>
                </div>
                <Badge variant="outline">{selectedTemplate.categoryLabel}</Badge>
              </div>
            </div>

            <div className="bg-card rounded-xl border p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="input-company-context" className="text-sm font-semibold">
                    회사 / 조직명 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="input-company-context"
                    placeholder="예: 반도체 패키징 생산기술팀, 커머스 마케팅실"
                    value={companyContext}
                    onChange={(e) => setCompanyContext(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    시나리오와 AI 캐릭터가 인지할 소속 조직명입니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="input-participant-role" className="text-sm font-semibold">
                    응시자 역할 (평가 대상자)
                  </Label>
                  <Input
                    id="input-participant-role"
                    placeholder={selectedTemplate.targetRole}
                    value={participantRole}
                    onChange={(e) => setParticipantRole(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    응시자가 몰입하여 수행할 직책 (예: 신임 팀장, PM, 부서장)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="input-situation" className="text-sm font-semibold">
                  현재 직면한 구체적 상황 (선택)
                </Label>
                <Textarea
                  id="input-situation"
                  rows={3}
                  placeholder={`예: 신규 라인 가동으로 야근이 잦아진 가운데, 핵심 담당자의 납기 지연이 발생해 팀 전체 일정에 차질이 빚어지고 있습니다.`}
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  비워두면 템플릿의 표준 시나리오 상황이 자동으로 적용됩니다.
                </p>
              </div>

              {/* AI 상대역 설정 */}
              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">AI 상대역 설정</span>
                  </div>
                  <span className="text-xs text-muted-foreground">기본값으로 자동 추천됨</span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="input-counterpart-name" className="text-xs text-muted-foreground">
                      캐릭터 이름
                    </Label>
                    <Input
                      id="input-counterpart-name"
                      value={counterpartName}
                      onChange={(e) => setCounterpartName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="input-counterpart-role" className="text-xs text-muted-foreground">
                      캐릭터 직책 / 역할
                    </Label>
                    <Input
                      id="input-counterpart-role"
                      value={counterpartRole}
                      onChange={(e) => setCounterpartRole(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="input-counterpart-organization" className="text-xs text-muted-foreground">
                      상대역 회사 / 조직명
                    </Label>
                    <Input
                      id="input-counterpart-organization"
                      placeholder={companyContext || "응시자와 동일 조직"}
                      value={counterpartOrganization}
                      onChange={(e) => setCounterpartOrganization(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      비워두면 응시자의 회사 / 조직명과 동일하게 적용됩니다.
                    </p>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="input-counterpart-stance" className="text-xs text-muted-foreground">
                      상대역의 입장
                    </Label>
                    <Textarea
                      id="input-counterpart-stance"
                      rows={3}
                      placeholder="예: 일정 준수보다 품질 검증과 재발 방지 대책이 먼저 확정되어야 한다고 생각합니다."
                      value={counterpartStance}
                      onChange={(e) => setCounterpartStance(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      AI 상대역이 대화에서 유지할 이해관계와 주장입니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> 이전 (템플릿 선택)
              </Button>
              <Button
                onClick={() => {
                  if (!companyContext.trim()) {
                    toast({
                      variant: "destructive",
                      title: "회사/조직명을 입력하세요",
                      description: "회사 또는 부서명을 입력해야 다음 단계로 진행할 수 있습니다.",
                    });
                    return;
                  }
                  setStep(3);
                }}
                className="px-6"
              >
                다음: 시나리오 확인 <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: 확인 및 생성 */}
        {step === 3 && selectedTemplate && (
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> 시나리오 확인 및 Draft 생성
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                생성에는 최대 1~2분이 걸릴 수 있습니다. AI가 고밀도 상황·페르소나·대화 흐름·시뮬레이션 규칙을 만들고 품질 계약을 통과한 결과만 저장합니다.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Main Summary */}
              <div className="md:col-span-2 space-y-4">
                <div className="bg-card rounded-xl border p-5 space-y-4">
                  <div>
                    <span className="text-xs text-primary font-semibold uppercase tracking-wider">
                      시나리오 제목
                    </span>
                    <h3 className="text-lg font-bold mt-0.5">
                      {selectedTemplate.title} [{companyContext}]
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
                    <div>
                      <span className="text-xs text-muted-foreground">소속 조직</span>
                      <p className="font-medium">{companyContext}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">응시자 직책</span>
                      <p className="font-medium">{participantRole || selectedTemplate.targetRole}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">AI 상대역</span>
                      <p className="font-medium">
                        {counterpartName} ({counterpartRole})
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">상대역 소속</span>
                      <p className="font-medium">{counterpartOrganization || companyContext}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">예상 소요 시간</span>
                      <p className="font-medium">{selectedTemplate.estimatedTime}분 (최대 12턴)</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">상대역의 입장</span>
                    <p className="text-sm mt-1 text-muted-foreground/90 whitespace-pre-line leading-relaxed">
                      {counterpartStance}
                    </p>
                  </div>

                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">배경 상황</span>
                    <p className="text-sm mt-1 text-muted-foreground/90 whitespace-pre-line leading-relaxed">
                      {situation.trim() || selectedTemplate.dramatic.synopsis}
                    </p>
                  </div>
                </div>

                {/* Evaluation Rubrics */}
                <div className="bg-card rounded-xl border p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-primary font-semibold uppercase tracking-wider">
                      평가 역량 및 루브릭 (4개 차원)
                    </span>
                    <span className="text-xs text-muted-foreground">가중치 합 100% 검증완료</span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    {selectedTemplate.evaluation.dimensions.map((dim) => (
                      <div key={dim.key} className="rounded-lg border p-3 bg-muted/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{dim.label}</span>
                          <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {Math.round(dim.weight * 100)}%
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {dim.criteria[0]}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Side Info Box */}
              <div className="space-y-4">
                <div className="rounded-xl border bg-primary/5 border-primary/20 p-5 space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-primary font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> RoleplayX 호환성 100%
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    생성되는 시나리오는 <b>AssessmentScenarioPackageV1</b> 표준 규격과 일치하며,
                    암호학적 SHA-256 해시가 부여되어 RoleplayX Assessment Center로 손실 없이 발행됩니다.
                  </p>
                  <ul className="text-xs space-y-1.5 text-muted-foreground pt-2 border-t border-primary/20">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-primary" /> 상대방 AI 페르소나 자동 주입
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-primary" /> 4단계 행동 평가 루브릭 내장
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-primary" /> 단일 턴 이탈 방지 가드레일
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={handleCreateScenario}
                  disabled={isSubmitting}
                  className="w-full h-12 text-base font-semibold shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 시나리오 초안 생성 중...
                    </>
                  ) : (
                    <>
                      시나리오 만들기 (Draft 저장) <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
                {(generationState === "generating" || generationState === "failed") && (
                  <div
                    data-testid="scenario-generation-state"
                    role={generationState === "failed" ? "alert" : "status"}
                    className={`rounded-xl border p-4 text-sm space-y-2 ${
                      generationState === "failed"
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-primary/30 bg-primary/5"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      {generationState === "generating"
                        ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        : <ShieldAlert className="h-4 w-4 text-destructive" />}
                      {generationState === "generating"
                        ? `깊이 있는 AI 시나리오 생성 중 · ${generationElapsedSeconds}초`
                        : generationError?.kind === "quality"
                          ? "품질 검토에서 초안이 보류되었습니다 (422)"
                          : generationError?.kind === "provider"
                            ? "AI 제공자 연결에 실패했습니다 (502)"
                            : "시나리오 생성에 실패했습니다"}
                    </div>
                    {generationState === "generating" ? (
                      <ol className="space-y-1 text-xs text-muted-foreground">
                        <li>1. 회사 맥락과 평가 템플릿을 결합하고 있습니다.</li>
                        <li>2. 시간선·stakes·목표·성공/실패 기준을 설계하고 있습니다.</li>
                        <li>3. 페르소나, 3막 대화 비트, 운영 규칙을 품질 검토 중입니다.</li>
                      </ol>
                    ) : (
                      <>
                        <p className="text-xs leading-relaxed text-muted-foreground">{generationError?.message}</p>
                        {generationError?.diagnostics.length ? (
                          <ul className="list-disc pl-4 text-xs text-muted-foreground">
                            {generationError.diagnostics.slice(0, 3).map((diagnostic, index) => <li key={index}>{diagnostic}</li>)}
                          </ul>
                        ) : null}
                        <p className="text-xs text-muted-foreground">입력한 회사 상황과 상대역 설정은 유지됩니다. 수정 후 또는 그대로 재시도할 수 있습니다.</p>
                        <Button data-testid="button-retry-scenario-generation" size="sm" variant="outline" onClick={handleCreateScenario} disabled={isSubmitting}>
                          다시 생성
                        </Button>
                      </>
                    )}
                  </div>
                )}
                <p className="text-center text-[11px] text-muted-foreground">
                  생성 즉시 미리보기 및 RoleplayX 발행이 가능합니다.
                </p>
              </div>
            </div>

            <div className="flex justify-start pt-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 h-4 w-4" /> 이전 (상황 수정)
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

