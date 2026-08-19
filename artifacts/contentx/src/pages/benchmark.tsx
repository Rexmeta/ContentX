import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListScenarios,
  useBenchmarkScenarios,
  type BenchmarkReport,
  type CategoryFrequency,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FreqBar({
  items,
  label,
  colorClass,
}: {
  items: CategoryFrequency[];
  label: string;
  colorClass: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 5);
  const max = items[0]?.count ?? 1;

  if (items.length === 0)
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          {label}
        </p>
        <p className="text-xs text-muted-foreground">데이터 없음</p>
      </div>
    );

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {label}
      </p>
      <div className="space-y-1.5">
        {shown.map((f) => (
          <div key={f.value} className="flex items-center gap-2">
            <span className="w-28 text-xs text-foreground truncate shrink-0">
              {f.value}
            </span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", colorClass)}
                style={{ width: `${(f.count / max) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right text-xs text-muted-foreground shrink-0">
              {Math.round(f.ratio * 100)}%
            </span>
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <button
          className="text-xs text-primary hover:underline flex items-center gap-1"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> 접기
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> {items.length - 5}개 더 보기
            </>
          )}
        </button>
      )}
    </div>
  );
}

function ReportView({ report }: { report: BenchmarkReport }) {
  const [showConstraints, setShowConstraints] = useState(false);

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="flex flex-wrap gap-4 border border-border rounded-sm p-4 bg-muted/30">
        <div className="text-center">
          <p className="text-2xl font-bold">{report.scenarioCount}</p>
          <p className="text-xs text-muted-foreground">선택된 작품</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{report.classifiedCount}</p>
          <p className="text-xs text-muted-foreground">분류 완료</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">
            {report.profile.tags.length}
          </p>
          <p className="text-xs text-muted-foreground">고유 태그</p>
        </div>
        {report.warning && (
          <div className="flex-1 flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-sm p-3 text-xs text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            {report.warning}
          </div>
        )}
      </div>

      {/* Profile bars */}
      {report.classifiedCount > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FreqBar
            items={report.profile.domain}
            label="배경 영역"
            colorClass="bg-blue-500"
          />
          <FreqBar
            items={report.profile.conflictType}
            label="갈등 유형"
            colorClass="bg-rose-500"
          />
          <FreqBar
            items={report.profile.tone}
            label="분위기"
            colorClass="bg-violet-500"
          />
          <FreqBar
            items={report.profile.tags}
            label="태그"
            colorClass="bg-emerald-500"
          />
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          분류된 시나리오가 없어 프로파일을 표시할 수 없습니다.
        </div>
      )}

      {/* Draft constraints */}
      {report.draftConstraints && (
        <div className="border border-primary/30 rounded-sm p-4 bg-primary/5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              초안 생성 제약 (draft_story에 자동 전달)
            </div>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setShowConstraints((v) => !v)}
            >
              {showConstraints ? "숨기기" : "내용 보기"}
            </button>
          </div>
          {showConstraints && (
            <pre className="text-xs text-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-3">
              {report.draftConstraints}
            </pre>
          )}
          <p className="text-xs text-muted-foreground">
            워크플로에서 <strong>참고 작품 패턴 분석</strong> 단계를 이야기
            초안 단계 앞에 추가하면 이 제약이 자동으로 적용됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BenchmarkPage() {
  const { data: scenarios, isLoading: loadingScenarios } = useListScenarios();
  const benchmark = useBenchmarkScenarios();
  const { toast } = useToast();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<BenchmarkReport | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    // Reset report when selection changes
    setReport(null);
  };

  const handleRun = async () => {
    const ids = [...selected];
    if (ids.length < 2) {
      toast({
        title: "최소 2개를 선택해주세요",
        description:
          "벤치마크는 그룹 특성을 분석합니다. 단일 원본 재현이 아니므로 최소 2개의 참고 작품이 필요합니다.",
        variant: "destructive",
      });
      return;
    }
    try {
      const result = await benchmark.mutateAsync({ data: { scenarioIds: ids } });
      setReport(result);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "패턴 분석에 실패했습니다.";
      toast({ title: "분석 실패", description: msg, variant: "destructive" });
    }
  };

  const classifiedCount = scenarios?.filter((s) => s.classification !== null).length ?? 0;

  return (
    <Layout
      breadcrumbs={[{ label: "벤치마크", href: "/benchmark" }]}
      contextHeader={
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              그룹 패턴 리포트
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              여러 참고 작품의 공통 특성(배경·갈등·분위기·태그)을 집계해
              그룹 프로파일을 만듭니다. 이 프로파일은 이야기 초안 생성의
              제약으로 자동 전달됩니다.
            </p>
          </div>
          <Button
            onClick={handleRun}
            disabled={selected.size < 2 || benchmark.isPending}
            data-testid="button-run-benchmark"
          >
            {benchmark.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <BarChart2 className="h-4 w-4 mr-2" />
            )}
            패턴 분석 ({selected.size}개 선택)
          </Button>
        </div>
      }
    >
      <div className="p-6 max-w-5xl mx-auto space-y-8 pb-32">
        {/* Scenario selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              참고 작품 선택{" "}
              <span className="text-muted-foreground font-normal">
                (분류된 작품: {classifiedCount}/{scenarios?.length ?? 0})
              </span>
            </h2>
            {selected.size > 0 && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSelected(new Set());
                  setReport(null);
                }}
              >
                선택 초기화
              </button>
            )}
          </div>

          {loadingScenarios ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !scenarios || scenarios.length === 0 ? (
            <div className="border border-dashed border-border rounded-sm p-8 text-center text-sm text-muted-foreground">
              저장된 시나리오가 없습니다. 워크플로에서 이야기 초안을 먼저
              만들고 저장해주세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {scenarios.map((s) => {
                const isSelected = selected.has(s.id);
                const c = s.classification;
                return (
                  <label
                    key={s.id}
                    htmlFor={`sc-${s.id}`}
                    className={cn(
                      "flex items-start gap-3 border rounded-sm p-3 cursor-pointer transition-colors",
                      isSelected
                        ? "border-primary/60 bg-primary/5"
                        : "border-border hover:border-border/80 bg-card",
                    )}
                    data-testid={`scenario-select-${s.id}`}
                  >
                    <Checkbox
                      id={`sc-${s.id}`}
                      checked={isSelected}
                      onCheckedChange={() => toggle(s.id)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium leading-tight truncate">
                        {s.title}
                      </p>
                      {c ? (
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {c.domain}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {c.conflictType}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {c.tone}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">
                          미분류
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Single-source warning */}
        {selected.size === 1 && (
          <div className="flex items-start gap-2 border border-yellow-500/40 bg-yellow-500/10 rounded-sm p-3 text-xs text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            단일 작품은 그룹 특성 분석이 아닌 원본 재현이 될 수 있습니다.
            최소 2개 이상 선택해주세요.
          </div>
        )}

        {/* Report */}
        {report && (
          <div className="space-y-4">
            <div className="border-t border-border pt-6">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                그룹 패턴 리포트
              </h2>
              <ReportView report={report} />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
