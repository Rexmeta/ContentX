import type { DiagnosticAuthoring } from "@workspace/api-zod";
import { compileAssessmentScenarioPackage } from "./compiler";

export function diagnosticSample(packageId: string, author: string) {
  const dimensions = [
    { key: "cause-exploration", label: "원인 탐색", weight: 0.34, criteria: ["실적 수치 외에 업무 조건의 변화나 장애물을 질문하고 확인한다."] },
    { key: "objection-response", label: "이의 제기 대응", weight: 0.33, criteria: ["상대의 우려를 확인한 뒤 구체적 사실을 바탕으로 성과 기준을 설명한다."] },
    { key: "action-agreement", label: "실행 합의", weight: 0.33, criteria: ["다음 행동, 담당자, 점검 시점을 구체화한다."] },
  ];
  const compiled = compileAssessmentScenarioPackage({
    packageKey: packageId, version: "1", publishedAt: new Date().toISOString(), sourcePackageId: packageId, author,
    metadata: { title: "김 대리의 두 달 연속 실적 미달 면담", description: "영업팀장과 김 대리의 성과 면담 · 훈련용 예시", locale: "ko-KR", tags: ["diagnostic", "training-example"] },
    competencies: dimensions.map((d) => ({ key: d.key, name: d.label })),
    scenarios: [{
      dramaticScenario: {
        title: "김 대리와의 성과 면담", logline: "영업팀장이 두 달 연속 목표 미달인 김 대리와 실행계획을 합의한다.",
        synopsis: "영업팀장인 당신은 김 대리의 두 달 연속 목표 미달을 확인하고 면담을 진행한다.",
        theme: "성과와 업무 조건", stakes: "다음 달 실행계획과 지원 범위를 합의해야 한다.", twist: "질문을 통해 업무 조건을 확인한다.",
        characters: [{ name: "김 대리", role: "영업팀 대리", motivation: "공정하게 업무 조건을 검토하는 면담을 원한다." }],
        acts: [{ name: "실적 확인", summary: "자료의 수치와 업무 조건을 확인한다.", beats: ["최근 두 달 실적을 논의한다."] }, { name: "우려 확인", summary: "상대의 우려를 듣는다.", beats: ["우려와 기준을 확인한다."] }, { name: "실행 합의", summary: "다음 행동과 점검 일정을 합의한다.", beats: ["담당자와 점검 시점을 구체화한다."] }],
      },
      configuration: {
        scenarioKey: "sales-performance-interview", locale: "ko-KR", categoryKey: "leadership", competencyKeys: dimensions.map((d) => d.key),
        difficulty: "intermediate", estimatedTime: 10, objectiveType: "roleplay", timeline: "이번 달 말 면담",
        playerRole: "영업팀장", objectives: ["원인을 파악하고 다음 달 실행계획을 합의한다."], successCriteria: ["다음 행동, 담당자, 점검 시점이 구체화된다."],
        primaryPersonaKey: "item-1", personaSwitchMode: "disabled", difficultyProfile: { level: "intermediate" },
        evaluation: { dimensions, passingScore: 70 }, termination: { maxTurns: 12, conditions: ["실행계획 합의 또는 최대 턴 도달"] },
        simulation: { mode: "roleplay", rules: ["상대역을 유지하고 비공격적으로 반응한다."] }, analytics: { eventTypes: ["cue_presented"], trackPersonaSwitches: false },
        targetDurationMinutes: 10, targetTurns: 8, minValidTurns: 3,
      },
    }],
  });
  if (!compiled.package) throw new Error(JSON.stringify(compiled.diagnostics));
  const source: DiagnosticAuthoring = {
    schemaVersion: "contentx.diagnostic.v1", scenarios: [{
      scenarioKey: "sales-performance-interview",
      briefing: {
        roleAndAuthority: "당신은 영업팀장입니다. 팀원의 영업 활동과 우선순위를 조율하고, 업무 지원 및 점검 일정을 합의할 권한이 있습니다. 인사 처분이나 목표 변경을 단독으로 확정할 권한은 없습니다.",
        relationship: "김 대리는 당신이 직접 관리하는 영업팀원입니다. 정기적으로 실적을 공유하며 필요한 지원을 함께 검토하는 관계입니다. 오늘은 일대일 면담으로 진행합니다.",
        reason: "김 대리의 최근 두 달 실적이 목표에 미달했습니다. 준비된 목표·실적표를 확인하고 지금 대화를 통해 현재 업무 상황을 파악할 필요가 있습니다.",
        goals: "면담에서 실적 미달 원인을 확인하고 다음 달 실행계획을 합의하세요. 필요한 지원과 담당자, 점검 일정을 함께 정하세요.",
        preparationSeconds: 90,
      },
      materials: [{
        id: "material-sales-two-months", title: "최근 2개월 목표·실적표 — 훈련용 예시 수치", type: "table", displayAt: "both", reopenDuringConversation: true,
        text: "훈련용 예시 수치이며 실제 인사 데이터가 아닙니다. 9월 목표 1억원·실적 8천만원(80%), 10월 목표 1억원·실적 7천5백만원(75%).",
        table: { columns: ["월", "목표", "실적", "달성률"], rows: [["9월", "1억원", "8천만원", "80%"], ["10월", "1억원", "7천5백만원", "75%"]] },
      }],
      private: { hiddenCauses: "지난달부터 주요 고객 두 곳을 추가로 담당하여 기존 고객 관리 시간이 줄었다.", internalIntent: "업무 변화가 성과 논의에서 인정되길 원한다.", modelAnswer: "업무 변화와 장애물을 탐색하고, 우려를 확인한 후 지원·행동·담당자·점검 일정을 합의한다.", instructions: "발견 단서는 의미상 업무 변화 또는 장애물을 질문한 경우에만 공개한다." },
      cues: [
        { id: "cue-added-accounts", type: "discovery", intent: "업무 조건의 변화, 추가 담당 업무 또는 성과를 가로막는 장애물을 탐색하는 질문", fact: "지난달부터 주요 고객 두 곳을 새로 맡았습니다.", criterionIds: ["criterion-cause"] },
        { id: "cue-defensive-objection", type: "common", condition: "최근 두 달 실적 문제를 논의한 직후", fallbackCondition: "실적 논의 구간 미도달 시 전체 대화의 중간 지점(6번째 참가자 발화 직후)", fact: "결과만 보고 판단하시는 것 같아요", tone: "방어적이지만 공격적이지 않음", intensity: "낮음~중간", criterionIds: ["criterion-objection"] },
      ],
      criteria: dimensions.map((d, i) => ({ id: ["criterion-cause", "criterion-objection", "criterion-agreement"][i]!, dimensionKey: d.key, competencyName: d.label, observableBehavior: d.criteria[0]! })),
    }],
  };
  return { package: compiled.package, diagnostic: source };
}
