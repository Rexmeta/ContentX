import { Layout } from "@/components/layout";
import { useListAssessments } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Clock, PlusCircle, CheckCircle2, 
  Send, Sparkles, User, Users, ClipboardCheck, ArrowUpRight, ShieldCheck
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

const CORE_TEMPLATES = [
  {
    id: "tmpl-ldr-01",
    title: "성과 부진 팀원 면담",
    category: "리더십 / 피플 매니지먼트",
    targetRole: "신임 팀장 / 파트장",
    time: "15분",
    summary: "과거 우수했으나 번아웃과 개인 사정으로 성과가 급락한 핵심 팀원과의 1:1 동기부여 및 원인 탐색 면담.",
    competencies: ["경청 및 공감", "근본 원인 탐색", "건설적 피드백", "코칭 및 액션플랜"],
  },
  {
    id: "tmpl-ldr-02",
    title: "부서 간 갈등 해결",
    category: "갈등 관리 / 협상",
    targetRole: "프로젝트 리더 / 팀장",
    time: "15분",
    summary: "서비스 론칭을 앞두고 배포 일정과 품질 리스크로 충돌하는 타 부서 팀장과의 상호 윈윈 협상 및 조율.",
    competencies: ["갈등 관리", "협력적 협상", "전사 관점 소통", "실행력 있는 결단"],
  },
  {
    id: "tmpl-com-01",
    title: "어려운 피드백 전달",
    category: "소통 / 피드백",
    targetRole: "중간관리자 / 팀장",
    time: "15분",
    summary: "성과는 탁월하나 회의 중 독선적 언행으로 동료들의 반발을 사는 핵심 실무자에게 단호하고 따뜻한 행동 개선 피드백.",
    competencies: ["SBI 피드백", "저항 및 반발 관리", "단호한 기준 제시", "변화 합의"],
  },
];

export default function Home() {
  const assessmentsQuery = useListAssessments();
  const assessments = assessmentsQuery.data || [];

  return (
    <Layout breadcrumbs={[{ label: "스튜디오 홈" }]}>
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-10">
        {/* Studio Hero */}
        <div className="rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8 relative overflow-hidden shadow-sm">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" /> AI Assessment Scenario Studio
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              실전 역량 평가를 위한 <br />
              <span className="text-primary">RoleplayX 시나리오 제작 스튜디오</span>
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              검증된 Assessment Center 템플릿을 선택하고 우리 회사 상황을 입력하세요.
              AI 상대역 페르소나와 정밀한 행동 평가 루브릭이 담긴 불변 패키지가 생성되어 RoleplayX로 즉시 발행됩니다.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link href="/assessments/new">
                <Button size="lg" className="font-semibold shadow-sm">
                  <PlusCircle className="mr-2 h-4 w-4" /> 새 시나리오 만들기 (마법사)
                </Button>
              </Link>
              <Link href="/assessments">
                <Button variant="outline" size="lg">
                  <ClipboardCheck className="mr-2 h-4 w-4" /> 시나리오 관리 ({assessments.length})
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* 3 Core MVP Templates Quick Start */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> 검증된 Assessment 템플릿으로 빠른 시작
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                기업 리더십 및 커뮤니케이션 진단에 최적화된 3대 표준 시나리오입니다.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {CORE_TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                className="rounded-xl border bg-card p-5 hover:border-primary/50 transition-all flex flex-col justify-between group shadow-sm hover:shadow"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline" className="text-[11px]">
                      {tmpl.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" /> {tmpl.time}
                    </span>
                  </div>
                  <h3 className="font-bold text-base group-hover:text-primary transition-colors">
                    {tmpl.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {tmpl.summary}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-border/60 space-y-3">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span>대상: {tmpl.targetRole}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tmpl.competencies.map((comp) => (
                      <span
                        key={comp}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                      >
                        {comp}
                      </span>
                    ))}
                  </div>
                  <Link href={`/assessments/new?templateId=${tmpl.id}`}>
                    <Button variant="secondary" size="sm" className="w-full mt-2 text-xs font-semibold">
                      이 템플릿으로 만들기 <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Scenarios */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" /> 최근 시나리오 현황
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                제작된 평가 패키지 상태를 확인하고 RoleplayX로 발행하세요.
              </p>
            </div>
            {assessments.length > 0 && (
              <Link href="/assessments" className="text-xs text-primary hover:underline flex items-center gap-1">
                전체 관리 ({assessments.length}) <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {assessmentsQuery.isLoading ? (
            <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
              시나리오 목록을 불러오는 중...
            </div>
          ) : assessments.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
              <ClipboardCheck className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">아직 생성된 시나리오가 없습니다.</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                위 템플릿 중 하나를 선택해 우리 회사에 맞는 첫 번째 Assessment 시나리오를 만들어보세요.
              </p>
              <Link href="/assessments/new">
                <Button size="sm" className="mt-2">
                  <PlusCircle className="mr-2 h-3.5 w-3.5" /> 첫 시나리오 만들기
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {assessments.slice(0, 4).map((item) => {
                const isPublished = item.latestTarget?.status === "succeeded";
                return (
                  <Link
                    key={item.id}
                    href={`/assessments/${item.id}?version=${item.currentVersion}`}
                    className="rounded-xl border bg-card p-4 hover:border-primary/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{item.title}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          v{item.currentVersion}
                        </Badge>
                        {isPublished ? (
                          <Badge variant="default" className="text-[10px] bg-primary/90">
                            RoleplayX 발행됨
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            {item.status || "draft"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {item.description}
                      </p>
                      <div className="text-[11px] text-muted-foreground/80 flex items-center gap-2 pt-1 font-mono">
                        <span>{item.scenarioCount} scenarios</span>
                        <span>·</span>
                        <span>{item.competencyCount} competencies</span>
                        <span>·</span>
                        <span>
                          {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true, locale: ko })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" className="text-xs">
                        상세 및 발행 <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Integration Architecture Footer Banner */}
        <div className="rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span>
              ContentX 시나리오는 <b>AssessmentScenarioPackageV1</b> 불변 스펙으로 패키징되어 RoleplayX Assessment Center로 직접 전송됩니다.
            </span>
          </div>
          <Link href="/assessments">
            <span className="text-primary hover:underline font-medium whitespace-nowrap cursor-pointer">
              발행 이력 및 규격 확인 &rarr;
            </span>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
