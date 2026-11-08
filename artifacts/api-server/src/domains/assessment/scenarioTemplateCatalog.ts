/**
 * ContentX Core Assessment Scenario Template Catalog
 * 
 * Provides verified Assessment Center roleplay scenario templates for HR practitioners.
 * Each template maps to RoleplayX-compatible competency dimensions, dramatic structure,
 * evaluation criteria (weights sum to 1.0), and simulation guardrails.
 */

export interface ScenarioTemplateCharacter {
  name: string;
  role: string;
  motivation: string;
  traits: string[];
  initialDialogue: string;
  behaviorGuidelines: string[];
}

export interface ScenarioTemplateAct {
  name: string;
  summary: string;
  beats: string[];
}

export interface ScenarioTemplateCompetency {
  key: string;
  name: string;
  description: string;
}

export interface ScenarioTemplateEvaluationDimension {
  key: string;
  label: string;
  weight: number;
  criteria: string[];
  description?: string;
}

export interface AssessmentScenarioTemplate {
  id: string;
  title: string;
  subtitle: string;
  category:
    | "leadership"
    | "conflict_resolution"
    | "communication"
    | "insurance"
    | "sales"
    | "customer_success"
    | "customer_service"
    | "negotiation";
  categoryLabel: string;
  targetRole: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime: number; // minutes
  description: string;
  learningObjectives: string[];

  // Dramatic blueprint
  dramatic: {
    logline: string;
    synopsis: string;
    theme: string;
    stakes: string;
    twist: string;
    acts: ScenarioTemplateAct[];
    characters: ScenarioTemplateCharacter[];
  };

  // Assessment & RoleplayX config blueprint
  competencies: ScenarioTemplateCompetency[];
  evaluation: {
    dimensions: ScenarioTemplateEvaluationDimension[];
    defaultPassingScore: number;
  };
  simulation: {
    mode: string;
    defaultInitialPrompt: string;
    rules: string[];
  };
  termination: {
    conditions: string[];
    maxTurns: number;
    targetTurns: number;
    minValidTurns: number;
  };
}

type BusinessTemplateCategory =
  | "insurance"
  | "sales"
  | "customer_success"
  | "customer_service"
  | "negotiation";

interface BusinessTemplateInput {
  id: string;
  title: string;
  subtitle: string;
  category: BusinessTemplateCategory;
  categoryLabel: string;
  targetRole: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  description: string;
  learningObjectives: string[];
  logline: string;
  synopsis: string;
  theme: string;
  stakes: string;
  twist: string;
  acts: ScenarioTemplateAct[];
  character: ScenarioTemplateCharacter;
  competencies: Array<ScenarioTemplateCompetency & { criteria: string[] }>;
  initialPrompt: string;
  rules: string[];
  terminationConditions: string[];
}

function createBusinessTemplate(input: BusinessTemplateInput): AssessmentScenarioTemplate {
  return {
    id: input.id,
    title: input.title,
    subtitle: input.subtitle,
    category: input.category,
    categoryLabel: input.categoryLabel,
    targetRole: input.targetRole,
    difficulty: input.difficulty,
    estimatedTime: 15,
    description: input.description,
    learningObjectives: input.learningObjectives,
    dramatic: {
      logline: input.logline,
      synopsis: input.synopsis,
      theme: input.theme,
      stakes: input.stakes,
      twist: input.twist,
      acts: input.acts,
      characters: [input.character],
    },
    competencies: input.competencies.map(({ key, name, description }) => ({ key, name, description })),
    evaluation: {
      dimensions: input.competencies.map(({ key, name, criteria }) => ({
        key,
        label: name,
        weight: 1 / input.competencies.length,
        criteria,
      })),
      defaultPassingScore: 70,
    },
    simulation: {
      mode: "roleplay",
      defaultInitialPrompt: input.initialPrompt,
      rules: input.rules,
    },
    termination: {
      conditions: [...input.terminationConditions, "최대 대화 턴 수 도달"],
      maxTurns: 14,
      targetTurns: 9,
      minValidTurns: 4,
    },
  };
}

const BUSINESS_SCENARIO_TEMPLATES: AssessmentScenarioTemplate[] = [
  createBusinessTemplate({
    id: "tmpl-ins-01",
    title: "보험 갱신 보험료 인상 상담",
    subtitle: "보장 이해와 고객 예산을 함께 고려하는 갱신 상담",
    category: "insurance",
    categoryLabel: "보험 / 고객 상담",
    targetRole: "보험 설계사 / 고객 담당자",
    difficulty: "intermediate",
    description:
      "장기 고객이 갱신 안내를 받고 보험료 인상에 항의하며 타사 전환을 고민합니다. 상담자는 고객의 실제 보장 우선순위와 예산을 파악하고, 확인되지 않은 보장이나 할인은 약속하지 않으면서 비교 가능한 선택지를 함께 정리해야 합니다.",
    learningObjectives: [
      "보험료 인상에 대한 고객의 우려를 방어적으로 대응하지 않고 경청한다.",
      "가격뿐 아니라 고객이 중요하게 생각하는 보장과 변경된 생활 상황을 확인한다.",
      "확인된 정보와 추가 확인이 필요한 내용을 구분하고 다음 조치를 합의한다.",
    ],
    logline:
      "보험료 인상에 불만을 느낀 장기 고객이 전환을 통보한 상황에서 상담자는 신뢰를 지키며 고객에게 맞는 검토 과정을 제안해야 한다.",
    synopsis:
      "고객은 갱신 안내를 받은 직후 상담을 요청해, 납득하기 어려운 인상이라며 즉시 해지와 타사 이동을 요구합니다. 안내문만 읽어주는 응대는 고객의 불신을 키울 수 있고, 성급한 할인 약속은 실제 계약 조건과 어긋날 위험이 있습니다.",
    theme: "투명한 설명과 고객 중심의 선택",
    stakes: "상담이 실패하면 고객 이탈과 민원이 발생하고, 부정확한 안내는 추가적인 신뢰 손상을 부를 수 있습니다.",
    twist:
      "고객은 보험료 자체만 낮추려는 것이 아닙니다. 최근 가족 구성과 돌봄 책임이 바뀌어 어떤 보장을 유지해야 할지 불안하지만, 처음부터 그 사정을 말하고 싶어 하지는 않습니다.",
    acts: [
      { name: "불만 경청과 신뢰 회복", summary: "고객의 놀람과 이탈 의사를 인정하고 상담 목적을 맞춥니다.", beats: ["인상 안내를 받은 고객의 감정 확인", "변명이나 즉시 설득을 삼가고 우려를 요약", "고객이 원하는 상담 결과 확인"] },
      { name: "필요와 선택 기준 파악", summary: "고객의 예산, 현재 보장 우선순위, 최근 바뀐 상황을 질문합니다.", beats: ["월 예산과 가격 민감도 확인", "유지하고 싶은 보장과 불필요하다고 느끼는 항목 확인", "타사 제안과 비교할 때 같은 조건인지 점검"] },
      { name: "검증 가능한 대안과 후속 합의", summary: "확인된 사실과 추가 확인 사항을 나누고 실행 가능한 다음 단계를 정합니다.", beats: ["약관·갱신 안내에서 확인된 내용만 설명", "담당 부서 확인 또는 조건별 비교 견적 제안", "회신 기한과 고객의 의사결정 시점 합의"] },
    ],
    character: {
      name: "김서연",
      role: "장기 계약 고객",
      motivation: "고정 지출을 줄이고 싶지만 가족에게 필요한 보호를 놓칠까 걱정합니다.",
      traits: ["가격에 민감함", "충성 고객", "불신과 불안이 섞임", "직설적"],
      initialDialogue: "이번 갱신 보험료가 이렇게 오른 이유가 뭔가요? 설명이 안 되면 다른 회사로 옮길게요.",
      behaviorGuidelines: [
        "초반에는 인상률과 장기 고객 대우를 따지며 해지를 언급한다.",
        "상담자가 먼저 고객의 부담을 인정하고 열린 질문을 하면 실제 예산과 최근 가족 상황을 조금씩 밝힌다.",
        "상담자가 보장 내용을 단정하거나 할인·지급을 보장하면 그 근거를 요구하며 불신을 키운다.",
        "가격만 낮추라고 반복하지 말고, 고객이 중요하게 여기는 보장과 감당 가능한 지출을 확인한다.",
      ],
    },
    competencies: [
      { key: "insurance_empathy", name: "공감과 신뢰 형성", description: "가격 인상에 대한 불만을 인정하고 고객의 우려를 정확히 요약한다.", criteria: ["고객의 부담과 장기 이용 경험을 먼저 인정했는가?", "반박이나 압박 대신 고객이 원하는 상담 결과를 확인했는가?"] },
      { key: "insurance_needs", name: "보장 니즈 탐색", description: "가격 외에 고객의 생활 변화와 보장 우선순위를 질문한다.", criteria: ["예산과 유지하고 싶은 보장 항목을 구체적으로 물었는가?", "고객이 아직 말하지 않은 상황도 존중하는 질문으로 확인했는가?"] },
      { key: "insurance_accuracy", name: "정확하고 투명한 설명", description: "확인된 계약 정보와 추후 확인해야 할 조건을 구분한다.", criteria: ["약관이나 갱신 조건을 확인하지 않은 채 보장·할인을 단정하지 않았는가?", "타사 비교 시 보장 범위와 조건을 동일 기준으로 비교하도록 안내했는가?"] },
      { key: "insurance_followup", name: "선택지와 후속 조치", description: "고객의 결정권을 보장하면서 확인 가능한 다음 단계를 합의한다.", criteria: ["고객에게 적합한 검토 경로를 한 가지 이상 제시했는가?", "담당자, 회신 시점, 의사결정 일정 등 구체적인 후속 조치를 정했는가?"] },
    ],
    initialPrompt:
      "당신은 보험 갱신 보험료 인상에 항의하는 장기 고객 김서연입니다. 안내문만으로는 인상 이유를 이해하지 못했고 타사 전환도 고려 중입니다. 처음에는 가격 인상과 장기 고객 대우를 따지십시오. 상담자가 공감하고 예산과 보장 우선순위를 묻기 전에는 가족 상황을 먼저 공개하지 마십시오. 실제 약관에 없는 보장이나 할인 약속을 하면 강하게 근거를 요구하십시오.",
    rules: [
      "보험 약관에 없는 보장·보험금·할인이나 심사 결과를 사실처럼 약속하지 마십시오.",
      "한국어 구어체로 고객의 감정과 현실적인 질문을 자연스럽게 표현하십시오.",
      "정확한 조건을 확인하겠다는 책임 있는 안내와 무성의한 회피를 구분해 반응하십시오.",
    ],
    terminationConditions: ["고객의 우선순위에 맞는 확인 항목과 후속 상담 일정 합의"],
  }),
  createBusinessTemplate({
    id: "tmpl-sales-01",
    title: "B2B 솔루션 첫 영업 미팅",
    subtitle: "가격 이견을 고객 문제와 도입 기준으로 전환하는 발견형 영업",
    category: "sales",
    categoryLabel: "영업 / 니즈 발굴",
    targetRole: "B2B 영업 담당자 / 솔루션 컨설턴트",
    difficulty: "intermediate",
    description:
      "운영 효율화 솔루션을 검토하는 잠재 고객이 높은 가격과 과거 도입 실패를 이유로 회의적인 반응을 보입니다. 담당자는 기능 소개를 서두르지 말고 실제 업무 문제, 성공 기준, 의사결정 구조를 찾아 검증 가능한 후속 미팅을 제안해야 합니다.",
    learningObjectives: [
      "제품 설명 전에 고객의 현재 업무 흐름과 비용이 드는 문제를 파악한다.",
      "가격 반대의 배경과 고객이 감수할 수 있는 도입 리스크를 확인한다.",
      "근거 없는 ROI 약속을 피하고 고객의 성공 기준에 맞는 검증 단계를 합의한다.",
    ],
    logline:
      "가격과 실패 경험을 앞세워 대화를 닫으려는 운영 책임자에게 영업 담당자는 기능이 아닌 고객의 실제 문제를 함께 진단해야 한다.",
    synopsis:
      "잠재 고객사는 반복적인 수작업을 줄이려 솔루션 미팅을 수락했지만, 과거 도입 프로젝트가 현장 정착에 실패한 경험이 있습니다. 운영 책임자는 바쁜 현장에 또 다른 도구를 얹을 이유가 없다며 가격 할인부터 요구합니다.",
    theme: "제품 중심 설명에서 고객 가치 검증으로",
    stakes: "문제와 성공 기준을 확인하지 못하면 기회가 종료되고, 무리한 약속은 향후 신뢰와 계약 이행을 해칠 수 있습니다.",
    twist:
      "고객이 가장 걱정하는 것은 구독료보다 현장 직원의 추가 업무와 데이터 이전입니다. IT 보안 담당자와 현장 관리자의 동의를 얻지 못하면 구매 책임자도 진행할 수 없습니다.",
    acts: [
      { name: "회의 목적과 현재 상황 확인", summary: "고객이 미팅을 수락한 이유와 원하는 결과를 확인합니다.", beats: ["미팅 시간과 의제 확인", "고객이 해결하고 싶은 업무 문제 질문", "현재 프로세스와 사용 중인 대안 파악"] },
      { name: "문제 영향과 도입 장벽 탐색", summary: "문제의 빈도, 영향, 도입 실패 원인과 참여자를 확인합니다.", beats: ["수작업이 발생하는 구간과 영향 확인", "이전 도입에서 어려웠던 점 경청", "현장·IT·구매 의사결정자와 성공 기준 확인"] },
      { name: "가치 가설과 검증 계획 합의", summary: "고객이 정한 지표로 작은 검증을 설계합니다.", beats: ["기능이 아닌 확인할 업무 지표 제안", "보안·데이터·교육 리스크를 검증 항목으로 반영", "참석자와 일정이 포함된 후속 워크숍 합의"] },
    ],
    character: {
      name: "박정호",
      role: "제조기업 운영혁신팀장",
      motivation: "반복 업무를 줄이고 싶지만 과거 시스템 도입 실패를 다시 책임지고 싶지는 않습니다.",
      traits: ["시간이 부족함", "현실적", "가격에 민감함", "현장 중심"],
      initialDialogue: "솔루션 설명은 전에 많이 들었습니다. 가격도 예산보다 높고, 현장은 새 시스템을 또 배워야 한다고 싫어할 겁니다.",
      behaviorGuidelines: [
        "초반에는 가격 할인과 도입 기간을 묻고 제품 설명을 짧게 끊는다.",
        "담당자가 현재 업무와 실패 원인을 구체적으로 질문하면 반복 입력과 교육 부담을 언급한다.",
        "IT 보안 담당자와 현장 리더의 동의가 필요하다는 점은 적절한 탐색 이후에 공개한다.",
        "검증 지표와 범위가 명확한 작은 테스트에는 관심을 보이지만, 과장된 절감률 약속에는 반발한다.",
      ],
    },
    competencies: [
      { key: "sales_discovery", name: "문제 발견 질문", description: "고객의 업무 흐름과 미팅을 요청한 배경을 구체적으로 탐색한다.", criteria: ["제품 소개 전에 고객이 해결하려는 문제를 질문했는가?", "문제의 빈도, 영향, 기존 대응 방식을 확인했는가?"] },
      { key: "sales_objection", name: "반대 의견 탐색", description: "가격·도입 부담 뒤에 있는 실제 우려를 확인하고 공감한다.", criteria: ["가격 반대의 기준과 예산 맥락을 물었는가?", "과거 실패와 현장 정착 리스크를 방어하지 않고 경청했는가?"] },
      { key: "sales_value", name: "가치 제안의 신뢰성", description: "고객의 문제와 연결된 가설을 제시하고 사실과 추정을 구분한다.", criteria: ["모든 기능을 나열하지 않고 확인된 문제에 관련된 가치만 제시했는가?", "근거가 없는 절감액·성과·구축 기간을 보장하지 않았는가?"] },
      { key: "sales_next_step", name: "의사결정과 다음 단계", description: "고객의 성공 기준과 주요 의사결정자를 포함해 다음 단계를 설계한다.", criteria: ["현장·IT·구매 등 필요한 참여자를 확인했는가?", "측정 기준, 범위, 책임자, 일정이 포함된 다음 행동에 합의했는가?"] },
    ],
    initialPrompt:
      "당신은 제조기업 운영혁신팀장 박정호입니다. 반복 업무는 줄이고 싶지만, 과거 시스템 도입이 현장에 정착하지 않아 추가 업무만 늘었던 경험 때문에 회의적입니다. 처음에는 가격 할인과 도입 부담을 앞세우십시오. 담당자가 현재 업무 흐름을 구체적으로 질문하면 반복 입력 문제를 이야기하고, 이후 적절히 질문하면 현장 직원의 교육 부담과 IT 보안 검토 필요성을 밝히십시오. 근거 없는 ROI나 구현 기간 약속에는 반발하십시오.",
    rules: [
      "현실적인 잠재 고객으로서 구체적인 질문과 반대 의견을 제시하십시오.",
      "고객이 밝히지 않은 정보를 미리 알려주지 말고 대화에 따라 단계적으로 공개하십시오.",
      "검증되지 않은 수치, 성과 보장, 고객 사례를 임의로 만들어내지 마십시오.",
    ],
    terminationConditions: ["고객 성공 기준을 반영한 검증 또는 후속 미팅 합의"],
  }),
  createBusinessTemplate({
    id: "tmpl-cs-01",
    title: "이탈 위험 고객의 갱신 회의",
    subtitle: "성과 부족과 가격 인상 우려를 다루는 고객 성공 대화",
    category: "customer_success",
    categoryLabel: "고객 성공 / 갱신",
    targetRole: "고객 성공 매니저 / 어카운트 매니저",
    difficulty: "advanced",
    description:
      "제품 사용률이 낮고 핵심 담당자도 바뀐 고객이 계약 갱신을 보류합니다. 고객 성공 담당자는 할인부터 제시하기보다 기대 성과와 실제 사용의 차이를 진단하고, 고객 조직이 실행할 수 있는 회복 계획과 책임 분담을 합의해야 합니다.",
    learningObjectives: [
      "고객이 기대했던 성과와 실제 경험 사이의 간극을 구체적으로 파악한다.",
      "제품 사용 저하와 조직 내 담당자 변경의 영향을 확인한다.",
      "측정 가능한 단기 회복 계획과 갱신 판단 시점을 함께 정한다.",
    ],
    logline:
      "갱신을 보류한 핵심 고객에게 고객 성공 매니저는 방어적 해명이나 성급한 할인 대신 성과 회복의 현실적인 경로를 제시해야 한다.",
    synopsis:
      "고객사는 계약 갱신 시점이 다가왔지만 주요 기능 사용률이 낮고 내부 보고에서 기대한 효율 개선도 확인하지 못했습니다. 새 담당 임원은 기존 도입 배경을 충분히 전달받지 못해 계약을 연장할 이유가 없다고 말합니다.",
    theme: "고객 성과에 대한 공동 책임과 투명한 회복",
    stakes: "문제를 해결하지 못하면 계약이 종료되고, 무리한 약속을 하면 남은 기간의 신뢰까지 잃을 수 있습니다.",
    twist:
      "실무 팀은 제품을 거부한 것이 아니라 담당자 퇴사 후 교육과 설정을 이어받지 못했습니다. 새 임원은 조직 변경 후 60일 내 가시적인 개선 지표를 요구받고 있습니다.",
    acts: [
      { name: "고객 평가와 기대 확인", summary: "갱신 보류의 이유와 고객이 기대한 결과를 듣습니다.", beats: ["갱신 보류 결정을 존중하고 목적 확인", "도입 당시 목표와 지금의 평가 차이 질문", "고객의 우선순위와 내부 압박 파악"] },
      { name: "사용 현황과 장애 요인 진단", summary: "데이터와 고객의 설명을 함께 보며 사용 저하 원인을 찾습니다.", beats: ["핵심 기능과 실제 활용 흐름 확인", "담당자 변경·교육·연동·프로세스 장애 탐색", "고객이 감당할 수 있는 변화 범위 확인"] },
      { name: "짧은 회복 계획과 갱신 기준 합의", summary: "양측의 역할과 성공 지표를 담은 실행 계획을 만듭니다.", beats: ["60일 안에 확인할 성과 지표 선택", "고객과 공급자 각각의 담당 업무 지정", "체크인 일정과 갱신 판단 시점 확정"] },
    ],
    character: {
      name: "최민지",
      role: "고객사 디지털전환 본부장",
      motivation: "성과가 보이지 않는 서비스를 정리하고, 짧은 시간 안에 조직에 설명할 수 있는 개선 근거를 원합니다.",
      traits: ["시간 압박이 큼", "성과 중심", "신중함", "이전 공급사 약속에 회의적"],
      initialDialogue: "사용률도 낮고 성과 보고도 없었습니다. 지금 상태라면 갱신할 이유가 없어요.",
      behaviorGuidelines: [
        "초반에는 갱신 논의를 미루거나 중단할 수 있다고 분명히 말한다.",
        "담당자가 도입 당시 기대와 현재의 불만을 비교해 들으면 구체적인 성과 압박을 설명한다.",
        "할인만 제안하면 가격보다 성과가 문제라고 지적한다.",
        "고객 역할과 측정 기준이 분명하고 현실적인 회복 계획이 제시되면 제한된 기간의 점검에는 동의할 수 있다.",
      ],
    },
    competencies: [
      { key: "cs_outcome", name: "기대 성과 진단", description: "도입 당시 목표와 고객이 현재 체감하는 결과를 연결해 확인한다.", criteria: ["고객이 갱신을 보류한 이유를 구체적으로 들었는가?", "기대했던 성과와 실제 결과의 차이를 고객의 관점에서 요약했는가?"] },
      { key: "cs_adoption", name: "사용 장애 탐색", description: "낮은 사용률의 원인을 데이터와 조직 맥락을 함께 살펴 진단한다.", criteria: ["사용률만 지적하지 않고 실제 업무 흐름과 장애 요인을 질문했는가?", "담당자 변경, 교육, 설정 등 필요한 원인을 열린 질문으로 탐색했는가?"] },
      { key: "cs_recovery", name: "실행 가능한 회복 계획", description: "측정 가능한 단기 목표와 양측의 역할을 현실적으로 제안한다.", criteria: ["기간 내 측정할 수 있는 고객 가치 지표를 합의했는가?", "고객과 공급자 양쪽의 책임과 자원을 명확히 했는가?"] },
      { key: "cs_trust", name: "신뢰와 갱신 판단", description: "성과를 과장하지 않고 점검 주기와 갱신 결정을 투명하게 정한다.", criteria: ["회복을 보장하거나 불필요한 할인을 앞세우지 않았는가?", "점검 일정과 갱신 판단 기준을 고객과 함께 확정했는가?"] },
    ],
    initialPrompt:
      "당신은 고객사 디지털전환 본부장 최민지입니다. 서비스 사용률이 낮고 기대한 성과가 없어서 갱신을 보류하려 합니다. 초반에는 지금 상황으로 갱신할 이유가 없다고 단호하게 말하십시오. 담당자가 목표와 실제 경험을 경청하면 성과 압박을 설명하십시오. 질문이 적절해지면 실무 담당자가 바뀌면서 교육과 설정 인수인계가 끊긴 사실, 60일 안에 개선 근거가 필요한 상황을 공개하십시오. 무조건 성과 보장이나 할인만 제시하면 거부하십시오.",
    rules: [
      "고객의 계약 결정 권한과 성과 우려를 현실적으로 표현하십시오.",
      "고객이 제공하지 않은 제품 사용 데이터나 성과 수치를 지어내지 마십시오.",
      "성공을 보장하지 말고, 고객과 공급자가 통제할 수 있는 실행 항목에 반응하십시오.",
    ],
    terminationConditions: ["60일 내 성과 지표, 양측 책임, 점검 일정과 갱신 판단 기준 합의"],
  }),
  createBusinessTemplate({
    id: "tmpl-svc-01",
    title: "서비스 지연 고객 불만 해결",
    subtitle: "감정이 격해진 고객에게 복구 선택지를 제시하는 응대",
    category: "customer_service",
    categoryLabel: "고객 서비스 / 불만 해결",
    targetRole: "고객 상담원 / 서비스 운영 담당자",
    difficulty: "intermediate",
    description:
      "중요한 일정에 필요한 서비스 제공이 지연되어 고객이 환불과 추가 보상을 요구합니다. 담당자는 먼저 불편과 영향을 인정하고 확인된 사실을 설명한 뒤, 권한 범위 안의 대안과 업데이트 시점을 제시해야 합니다.",
    learningObjectives: [
      "고객의 감정과 지연으로 발생한 업무 영향을 인정한다.",
      "확인된 사실과 아직 조사 중인 사항을 분리해 안내한다.",
      "권한 밖의 보상을 약속하지 않고 고객이 선택할 수 있는 복구 방안을 제안한다.",
    ],
    logline:
      "서비스 지연으로 중요한 일정을 위협받은 고객이 강한 보상 요구를 하는 상황에서 담당자는 공감과 책임 있는 해결책을 함께 보여야 한다.",
    synopsis:
      "고객사의 신규 지점 운영에 필요한 장비와 초기 설정이 예정된 날짜에 완료되지 않았습니다. 고객은 여러 차례 문의했지만 답변이 달라졌다고 느끼며 환불과 추가 보상을 요구합니다.",
    theme: "책임 있는 서비스 복구와 명확한 소통",
    stakes: "응대가 실패하면 고객 일정 차질이 커지고 민원이나 거래 중단으로 이어질 수 있습니다.",
    twist:
      "고객에게 가장 급한 문제는 전체 주문의 환불보다 이틀 뒤 예정된 지점 오픈입니다. 일부 장비를 먼저 받거나 임시 대체 서비스를 쓰는 대안이 가능하지만, 고객은 먼저 믿을 수 있는 일정과 책임자를 원합니다.",
    acts: [
      { name: "불만과 사업 영향 인정", summary: "고객이 겪은 반복 문의와 일정 차질을 인정합니다.", beats: ["고객의 감정을 방어적으로 받아치지 않음", "지연이 고객 업무에 준 영향을 확인", "지금 통화에서 해결할 우선순위 확인"] },
      { name: "사실 확인과 선택지 제시", summary: "현재 상태를 확인하고 가능한 복구 경로를 설명합니다.", beats: ["주문·배송·설정 상태를 아는 범위에서 정리", "확인되지 않은 완료 시간을 단정하지 않음", "분할 제공·대체 수단·취소 등 가능한 옵션 확인"] },
      { name: "실행 책임과 업데이트 합의", summary: "담당자와 업데이트 시점, 고객의 선호 옵션을 확정합니다.", beats: ["고객이 가장 중요한 일정과 최소 필요 범위 결정", "내부 확인 담당자와 회신 기한 지정", "약속한 시점에 업데이트할 채널과 다음 조치 합의"] },
    ],
    character: {
      name: "윤태식",
      role: "기업 고객 운영팀장",
      motivation: "예정된 지점 오픈 차질을 막고, 반복되는 불확실한 안내에 대한 책임 있는 답변을 원합니다.",
      traits: ["화가 나 있음", "시간에 쫓김", "꼼꼼함", "보상에 단호함"],
      initialDialogue: "약속한 날짜가 지났는데 아무것도 안 왔습니다. 벌써 세 번째 전화예요. 전액 환불하고 보상도 해주세요.",
      behaviorGuidelines: [
        "초반에는 이전 문의 기록과 서로 다른 안내 내용을 지적한다.",
        "상담자가 불편을 인정하지 않고 절차만 설명하면 목소리를 높이고 책임자를 요구한다.",
        "고객의 일정과 필수 필요 범위를 물으면 오픈 날짜와 최소 장비 범위를 공개한다.",
        "확인된 정보, 책임자, 구체적 업데이트 시점이 제시되면 대안을 비교하지만 보장할 수 없는 보상 약속에는 근거를 요구한다.",
      ],
    },
    competencies: [
      { key: "service_empathy", name: "공감과 긴장 완화", description: "고객의 감정과 업무상 피해를 인정해 대화를 해결 중심으로 전환한다.", criteria: ["고객이 겪은 불편과 반복 문의를 구체적으로 인정했는가?", "고객을 탓하거나 불만을 축소하지 않고 차분한 어조를 유지했는가?"] },
      { key: "service_factfinding", name: "사실 확인과 명료성", description: "확인된 상태, 미확인 사항, 다음 확인 절차를 구분한다.", criteria: ["현재 진행 상태와 해결에 필요한 정보를 확인했는가?", "확인되지 않은 배송·복구 일정이나 보상을 확정적으로 말하지 않았는가?"] },
      { key: "service_options", name: "복구 대안 설계", description: "고객이 중요하게 여기는 결과에 맞춰 권한 범위 내 대안을 제시한다.", criteria: ["환불 요구의 배경과 가장 시급한 업무 우선순위를 확인했는가?", "가능한 대안을 고객이 선택할 수 있도록 명료하게 설명했는가?"] },
      { key: "service_ownership", name: "책임과 후속 안내", description: "문제 해결 담당자와 고객에게 돌아갈 업데이트 시점을 약속한다.", criteria: ["내부 담당자와 다음 조치를 구체적으로 정했는가?", "고객이 다시 문의하지 않아도 되는 업데이트 시점과 채널을 합의했는가?"] },
    ],
    initialPrompt:
      "당신은 기업 고객 운영팀장 윤태식입니다. 신규 지점에 필요한 서비스와 장비가 약속된 날에 오지 않았고, 이전 문의마다 다른 답을 들었습니다. 처음에는 환불과 보상을 요구하고 세 번째 문의라고 강조하십시오. 상담자가 지연의 영향을 공감하고 오픈 일정이나 최소 필요 범위를 물으면 이틀 뒤 오픈 예정이고 일부 장비가 먼저 오면 운영을 시작할 수 있다고 밝히십시오. 확인되지 않은 완료 일정을 보장하면 강하게 근거를 요구하십시오.",
    rules: [
      "화가 난 고객이지만 대화 목적은 실제 업무 문제 해결과 책임 있는 안내입니다.",
      "환불·보상 권한이나 회사 정책을 임의로 만들어내지 마십시오.",
      "고객이 선택할 수 있는 대안과 구체적인 업데이트 약속에 현실적으로 반응하십시오.",
    ],
    terminationConditions: ["고객의 우선순위에 맞는 복구 옵션과 책임자·업데이트 시점 합의"],
  }),
  createBusinessTemplate({
    id: "tmpl-neg-01",
    title: "공급업체 단가 인상 협상",
    subtitle: "비용 압박과 공급 안정성을 함께 고려하는 거래 협상",
    category: "negotiation",
    categoryLabel: "구매 / 공급업체 협상",
    targetRole: "구매 담당자 / 사업 운영 책임자",
    difficulty: "advanced",
    description:
      "핵심 공급업체가 단가 인상과 납기 조건 변경을 통보해 사업 원가와 공급 안정성에 부담이 생겼습니다. 구매 담당자는 단순한 가격 인하 요구에 머물지 않고 인상 배경, 대체 가능성, 물량과 계약 조건을 함께 검토해 양측이 실행할 수 있는 합의를 찾아야 합니다.",
    learningObjectives: [
      "상대의 가격 인상 근거와 우리 조직의 비용·공급 리스크를 분리해 파악한다.",
      "단가 외에 물량, 발주 예측, 납기, 재고 등 교환 가능한 조건을 탐색한다.",
      "조건부 양보와 합의 내용을 수치·책임·시점으로 명확히 정리한다.",
    ],
    logline:
      "핵심 공급업체의 가격 인상 통보를 받은 구매 담당자는 관계를 해치지 않으면서 공급 연속성과 원가 목표를 함께 지켜야 한다.",
    synopsis:
      "주요 부품 공급업체가 다음 분기부터 단가를 인상하고 최소 발주 조건도 조정하겠다고 알렸습니다. 대체 공급처로 전환하려면 검증과 일정이 필요해 구매 담당자는 단기간에 결론을 내기 어렵습니다.",
    theme: "입장 대결에서 조건 교환을 통한 공동 해결로",
    stakes: "합의 실패는 원가 상승이나 생산 일정 차질을 낳고, 일방적인 압박은 중요한 공급 관계를 악화시킬 수 있습니다.",
    twist:
      "공급업체는 인상 폭을 무조건 고수하려는 것이 아니라 불규칙한 긴급 발주와 짧은 예측 기간 때문에 운영 비용이 커졌습니다. 고객사가 분기별 수요 예측과 유연한 납기 계획을 제공하면 일부 조건을 재검토할 여지가 있습니다.",
    acts: [
      { name: "인상 요구와 제약 조건 확인", summary: "공급업체의 변경 요구와 양측의 우선순위를 확인합니다.", beats: ["인상 폭·적용 시점·최소 발주 변경 확인", "가격 조정의 배경과 산정 근거 요청", "우리 조직의 원가 목표와 공급 연속성 우선순위 공유"] },
      { name: "교환 가능한 조건 탐색", summary: "가격 외에 물량 예측, 납기, 재고 등 협상 변수를 찾습니다.", beats: ["대체 공급처와 전환 소요 리스크 검토", "공급업체의 운영 부담과 고객의 수요 변동 확인", "서로 양보 가능한 조건과 양보 한계 탐색"] },
      { name: "조건부 합의와 실행 관리", summary: "검증 가능한 조건부 제안을 만들고 이행 점검을 정합니다.", beats: ["예측 물량·발주 주기와 단가 조정의 교환안 제안", "합의 적용 범위와 기간 명확화", "미합의 시 재검토 기준과 담당자·일정 합의"] },
    ],
    character: {
      name: "한도윤",
      role: "핵심 부품 공급업체 영업이사",
      motivation: "원가 상승과 들쭉날쭉한 발주로 인한 운영 부담을 줄이면서 장기 거래를 유지하고 싶습니다.",
      traits: ["협상에 능숙함", "관계 지향적", "원칙이 있음", "조건을 중시함"],
      initialDialogue: "다음 분기부터 단가 조정이 필요합니다. 최소 발주량도 변경됩니다. 기존 조건으로는 더 이상 공급하기 어렵습니다.",
      behaviorGuidelines: [
        "초반에는 인상 통보가 불가피하다고 설명하며 즉시 양보하지 않는다.",
        "구매 담당자가 인상 근거와 변경 조건을 구체적으로 물으면 긴급 발주와 수요 변동 문제를 설명한다.",
        "일방적인 가격 인하나 공급 중단 위협에는 다른 고객과의 거래 조건을 언급하며 방어한다.",
        "예측 가능한 발주 계획 등 실질적인 교환 조건이 나오면 단가 인상 폭이나 적용 시점을 조정할 가능성을 검토한다.",
      ],
    },
    competencies: [
      { key: "negotiation_interests", name: "이해관계 파악", description: "요구 조건의 배경과 양측의 핵심 제약을 질문해 확인한다.", criteria: ["상대의 가격 조정 근거와 운영상 문제를 확인했는가?", "우리 조직의 원가·품질·공급 안정 우선순위를 명확히 했는가?"] },
      { key: "negotiation_levers", name: "협상 변수 발굴", description: "가격 외에 물량·예측·납기·재고 등 교환 가능한 조건을 찾는다.", criteria: ["단가만 반복 요구하지 않고 대안 조건을 탐색했는가?", "대체 공급처 전환이나 합의 실패의 현실적 리스크를 검토했는가?"] },
      { key: "negotiation_tradeoffs", name: "조건부 제안과 양보", description: "가치 있는 조건을 교환하는 구체적이고 균형 잡힌 제안을 한다.", criteria: ["양보를 요청할 때 상대가 제공할 반대급부를 함께 제시했는가?", "양측이 이행할 수 있는 범위와 한계를 구분했는가?"] },
      { key: "negotiation_commitment", name: "합의 명료화", description: "합의 범위, 책임자, 일정과 재검토 기준을 분명히 한다.", criteria: ["단가·적용 시점·물량 또는 납기 조건을 구체화했는가?", "담당자, 실행 일정, 이행이 어려울 때의 재검토 절차를 합의했는가?"] },
    ],
    initialPrompt:
      "당신은 핵심 부품 공급업체 영업이사 한도윤입니다. 원가와 긴급 발주 변동으로 다음 분기부터 단가와 최소 발주 조건을 조정하겠다고 통보했습니다. 처음에는 기존 조건으로는 공급을 유지하기 어렵다고 말하십시오. 구매 담당자가 근거와 운영 상황을 물으면 고객사의 잦은 긴급 발주와 짧은 수요 예측 기간을 설명하십시오. 단순한 인하 압박에는 양보하지 않지만, 예측 가능한 발주 계획이나 유연한 납기 등 구체적인 교환 조건에는 일부 조건 조정을 검토하십시오.",
    rules: [
      "특정 산업의 실제 원가나 법적 의무를 사실처럼 만들어내지 마십시오.",
      "상대방의 조건과 대안에 따라 협상 태도를 일관되게 조정하십시오.",
      "최종 합의는 적용 범위와 일정이 구체적일 때만 수용하십시오.",
    ],
    terminationConditions: ["단가·발주·납기 중 교환 조건과 적용 시점이 명확한 잠정 합의"],
  }),
];

export const SCENARIO_TEMPLATES: AssessmentScenarioTemplate[] = [
  {
    id: "tmpl-ldr-01",
    title: "성과 부진 팀원 면담",
    subtitle: "신임 리더의 동기부여 및 원인 탐색 면담",
    category: "leadership",
    categoryLabel: "리더십 / 피플 매니지먼트",
    targetRole: "신임 팀장 / 파트장",
    difficulty: "intermediate",
    estimatedTime: 15,
    description:
      "과거 우수 인재였으나 최근 3개월간 업무 몰입도와 납기 준수율이 급격히 떨어진 팀원과의 1:1 면담 시나리오입니다. 일방적 질책 대신 경청과 공감으로 근본 원인을 파악하고 재도약 계획을 합의해야 합니다.",
    learningObjectives: [
      "방어적 태도를 해소하고 심리적 안정감을 조성한다.",
      "표면적 핑계 이면의 업무적/개인적 장애 요인을 질문을 통해 규명한다.",
      "구체적이고 실현 가능한 개선 액션 플랜을 도출한다.",
    ],
    dramatic: {
      logline: "성과가 급락한 핵심 팀원과의 면담에서 리더는 질책의 유혹을 누르고 숨겨진 번아웃의 원인을 밝혀내야 한다.",
      synopsis:
        "팀의 핵심 프로젝트 납기가 임박했으나 담당 팀원의 잦은 지연과 무기력한 태도로 팀 전체에 불안감이 고조되었습니다. 팀장은 이번 면담에서 감정적 대립 없이 문제의 본질을 짚고 동기를 되살려야 합니다.",
      theme: "신뢰 회복과 진정성 있는 공감",
      stakes: "면담 실패 시 팀원의 퇴사 또는 프로젝트 전체 일정 파행",
      twist: "단순 태만이 아니라 최근 급증한 타 부서 지원 업무와 가족 간병으로 인한 심각한 번아웃 상태임",
      acts: [
        {
          name: "도입 및 라포 형성",
          summary: "면담 목적을 편안하게 공유하고 방어벽을 낮춘다.",
          beats: ["최근 고생에 대한 인정", "면담 목적(징벌이 아닌 지원) 설명", "팀원의 첫 반응 확인"],
        },
        {
          name: "원인 탐색 및 사실 확인",
          summary: "최근 프로젝트 지연 사례를 팩트 중심으로 짚고 원인을 묻는다.",
          beats: ["객관적 지표 제시", "팀원의 속사정 경청", "숨겨진 번아웃 요인 인지"],
        },
        {
          name: "해결책 도출 및 합의",
          summary: "업무 재조정 및 지원 방안을 논의하고 다음 주 목표를 약속한다.",
          beats: ["불필요한 잡무 조정 지원 약속", "팀원의 주도적 개선안 유도", "구체적 후속 미팅 일정 확정"],
        },
      ],
      characters: [
        {
          name: "이민혁",
          role: "시니어 실무 담당자 (3년차)",
          motivation: "최근 과도한 업무와 개인 사정으로 한계에 부딪혔으나 무능력해 보일까봐 침묵하고 방어벽을 침",
          traits: ["방어적", "위축됨", "책임감 있음", "지침"],
          initialDialogue: "팀장님, 부르셨습니까? 저번 주 보고서 지연 때문이라면 죄송합니다. 나름대로 최선을 다하고 있습니다만...",
          behaviorGuidelines: [
            "초반에는 팀장의 질문에 짧고 방어적으로 응답한다 ('별일 아닙니다', '그냥 좀 피곤해서요').",
            "팀장이 진정성 있게 공감하고 지원 의사를 보이면 서서히 진짜 원인(타 부서 요청 과중, 야근 피로)을 털어놓는다.",
            "팀장이 일방적으로 훈계하거나 닥달하면 침묵하거나 형식적으로 '네, 알겠습니다'라며 마음을 닫는다.",
          ],
        },
      ],
    },
    competencies: [
      { key: "active_listening", name: "경청 및 공감", description: "상대방의 감정과 상황을 편견 없이 경청하고 심리적 안정감을 제공하는 능력" },
      { key: "root_cause_exploration", name: "원인 탐색", description: "효과적인 개방형 질문으로 문제의 표면이 아닌 근본 원인을 밝혀내는 역량" },
      { key: "constructive_feedback", name: "건설적 피드백", description: "인신공격 없이 객관적 사실과 기대 수준을 명확히 전달하는 소통 능력" },
      { key: "action_coaching", name: "해결책 도출 및 코칭", description: "일방적 지시가 아닌 상대방의 주도성을 살려 현실적 실행 계획을 합의하는 역량" },
    ],
    evaluation: {
      dimensions: [
        {
          key: "active_listening",
          label: "경청 및 심리적 안정감",
          weight: 0.25,
          criteria: [
            "팀원의 말을 끊지 않고 끝까지 경청하였는가?",
            "면담 초반 평가나 비난 대신 열린 자세로 라포를 형성하였는가?",
          ],
        },
        {
          key: "root_cause_exploration",
          label: "근본 원인 탐색",
          weight: 0.25,
          criteria: [
            "단순 사실 확인을 넘어 '왜 그런 상황이 발생했는지' 심층 질문을 던졌는가?",
            "업무 외적/환경적 제약 사항을 파악하려 노력하였는가?",
          ],
        },
        {
          key: "constructive_feedback",
          label: "건설적 피드백",
          weight: 0.25,
          criteria: [
            "감정적 언어 대신 구체적인 사건과 업무 영향을 기반으로 피드백했는가?",
            "기대 수준과 조직의 목표를 명확하게 짚었는가?",
          ],
        },
        {
          key: "action_coaching",
          label: "실행 계획 및 후속 조치",
          weight: 0.25,
          criteria: [
            "팀원이 스스로 개선 아이디어를 제시하도록 유도하였는가?",
            "지원해 줄 구체적 자원(업무 분장, 일정 조정 등)을 약속하고 후속 점검일을 정했는가?",
          ],
        },
      ],
      defaultPassingScore: 70,
    },
    simulation: {
      mode: "roleplay",
      defaultInitialPrompt:
        "당신은 성과 부진 팀원 이민혁(3년차 실무자) 역할을 수행합니다. 최근 과도한 업무 부하와 개인 사정으로 번아웃 상태입니다. 팀장이 질문할 때 처음에는 방어적으로 임하되, 진심 어린 경청과 실질적 지원을 제안하면 마음을 열고 진솔하게 대화하세요.",
      rules: [
        "절대 AI로서의 정체성을 드러내지 말고 캐릭터에 몰입하십시오.",
        "응답은 한국어로 구어체 2~3문장 내외로 자연스럽게 대답하십시오.",
        "팀장의 코칭 역량을 테스트할 수 있도록 적절한 긴장감을 유지하십시오.",
      ],
    },
    termination: {
      conditions: ["면담 후속 조치 및 액션 플랜 합의 완료", "최대 대화 턴 수 도달"],
      maxTurns: 12,
      targetTurns: 8,
      minValidTurns: 3,
    },
  },
  {
    id: "tmpl-ldr-02",
    title: "부서 간 갈등 해결",
    subtitle: "프로젝트 리소스 및 일정 충돌 조율 면담",
    category: "conflict_resolution",
    categoryLabel: "갈등 관리 / 협상",
    targetRole: "프로젝트 리더 / 팀장",
    difficulty: "intermediate",
    estimatedTime: 15,
    description:
      "핵심 프로젝트 론칭을 앞두고 협업 부서 팀장과 일정 및 리소스 우선순위 충돌이 발생한 상황입니다. 감정적 승패 논리를 지양하고 공통의 비즈니스 가치를 기반으로 윈윈(Win-Win) 합의를 도출해야 합니다.",
    learningObjectives: [
      "각 부서의 이해관계와 입장의 차이를 명확히 구분한다.",
      "공동의 목표와 우선순위를 환기하여 협력 무드를 조성한다.",
      "상호 양보와 대안 설계를 통해 실행 가능한 타협점을 찾는다.",
    ],
    dramatic: {
      logline: "신규 서비스 배포일을 둘러싸고 QA/운영팀장과 극한 대립 중인 개발팀장은 마감일 준수와 안정성 사이의 균형점을 협상해야 한다.",
      synopsis:
        "전사 중점 사업의 출시 일정이 잡혀 있으나, 품질 검증 부서장은 시스템 안정성 미확보를 이유로 배포 승인을 거부하고 있습니다. 양측 모두 물러설 수 없는 명분을 쥔 채 긴급 조율 회의를 시작합니다.",
      theme: "상호 존중과 전략적 문제 해결",
      stakes: "합의 실패 시 서비스 장애 발생 위험 또는 시장 진입 기회 상실",
      twist: "상대 부서장 역시 본부장으로부터 무결점 배포를 강하게 압박받고 있어 방어적일 수밖에 없는 처지임",
      acts: [
        {
          name: "입장 확인 및 갈등 점화",
          summary: "배포 일정에 대한 상반된 입장을 확인하고 쟁점을 좁힌다.",
          beats: ["현안 브리핑", "상대방의 강경한 반대 청취", "감정 과열 방지"],
        },
        {
          name: "핵심 리스크 분석",
          summary: "전체 출시 거부 대신 핵심 필수 모듈과 부가 기능의 우선순위를 분리한다.",
          beats: ["치명적 결함과 마이너 이슈 분류", "상대 부서의 부담 경청", "대안적 접근 제안"],
        },
        {
          name: "단계적 배포(Staged Rollout) 합의",
          summary: "단계적 릴리즈 및 인력 추가 지원으로 상호 수용 가능한 로드맵을 확정한다.",
          beats: ["1차 필수 기능 배포 + 2차 추가 검증안 제시", "책임 분담 명문화", "합의안 도출"],
        },
      ],
      characters: [
        {
          name: "박준성",
          role: "품질운영팀 팀장",
          motivation: "서비스 장애 발생 시 모든 비난이 본인 부서로 쏠리는 것을 방지하기 위해 엄격한 기준을 고수함",
          traits: ["원칙주의", "신중함", "직설적", "방어적"],
          initialDialogue: "팀장님, 지금 상태로는 배포 승인 절대 못 냅니다. 지난번에도 개발팀 일정 맞추려다 운영 사고 났던 거 기억 안 나십니까?",
          behaviorGuidelines: [
            "초반에는 원칙과 과거 실패 사례를 들며 강경하게 반대한다.",
            "팀장이 품질팀의 고충을 인정하고 리스크를 분담하는 대안(단계적 배포, 인력 파견 등)을 내놓으면 양보하기 시작한다.",
            "단순히 '일정 때문에 무조건 해달라'고 조르면 회의를 중단하려 한다.",
          ],
        },
      ],
    },
    competencies: [
      { key: "conflict_management", name: "갈등 관리", description: "대립 상황에서 감정을 통제하고 건설적인 논의 분위기를 유지하는 역량" },
      { key: "collaborative_negotiation", name: "협력적 협상", description: "제로섬(Zero-sum)이 아닌 상호 이익을 창출하는 대안을 발굴하는 능력" },
      { key: "strategic_communication", name: "전략적 소통", description: "조직 전체의 사업 목표와 우선순위를 설득력 있게 전달하는 능력" },
      { key: "decision_making", name: "합의 도출 및 결단력", description: "현실적 타협안을 구체화하고 상호 책임을 명확히 매듭짓는 역량" },
    ],
    evaluation: {
      dimensions: [
        {
          key: "conflict_management",
          label: "갈등 관리 및 감정 조절",
          weight: 0.25,
          criteria: [
            "상대 부서장의 공격적인 발언에 감정적으로 맞대응하지 않았는가?",
            "상대방의 정당한 우려(품질 리스크)를 존중하고 경청하였는가?",
          ],
        },
        {
          key: "collaborative_negotiation",
          label: "대안 제시 및 협상력",
          weight: 0.25,
          criteria: [
            "일방적 요구 대신 절충안(단계적 배포, 인력 지원 등)을 선제적으로 제시하였는가?",
            "양 부서 모두에게 납득 가능한 해결책을 설계하였는가?",
          ],
        },
        {
          key: "strategic_communication",
          label: "전사 관점 조율",
          weight: 0.25,
          criteria: [
            "부서 이기주의를 넘어 전사 사업 목표와 고객 가치를 환기하였는가?",
            "리스크 발생 시 공동 대응 방안을 논의하였는가?",
          ],
        },
        {
          key: "decision_making",
          label: "실행 가능한 합의 도출",
          weight: 0.25,
          criteria: [
            "모호한 말장난이 아닌 명확한 일정과 책임 소재를 확정하였는가?",
            "양측이 동의하는 최종 의사결정을 이끌어냈는가?",
          ],
        },
      ],
      defaultPassingScore: 70,
    },
    simulation: {
      mode: "roleplay",
      defaultInitialPrompt:
        "당신은 품질운영팀 박준성 팀장 역할을 수행합니다. 시스템 안정성과 품질을 최우선으로 생각하며, 마감일에 쫓겨 부실한 서비스를 배포하는 것을 극도로 경계합니다. 상대 팀장이 합리적인 리스크 완화책을 제시할 때만 양보하십시오.",
      rules: [
        "타협할 수 없는 원칙주의자의 페르소나를 유지하십시오.",
        "한국어 구어체로 단호하면서도 논리적으로 반론을 제기하십시오.",
        "협상과 합의의 가능성을 완전히 닫지는 말되 쉬운 양보는 하지 마십시오.",
      ],
    },
    termination: {
      conditions: ["단계적 배포 또는 리소스 지원 합의 도출", "최대 대화 턴 수 도달"],
      maxTurns: 12,
      targetTurns: 8,
      minValidTurns: 3,
    },
  },
  {
    id: "tmpl-com-01",
    title: "어려운 피드백 전달",
    subtitle: "태도 및 협업 방식 개선을 위한 단호하고 따뜻한 피드백",
    category: "communication",
    categoryLabel: "소통 / 피드백",
    targetRole: "중간관리자 / 팀장",
    difficulty: "advanced",
    estimatedTime: 15,
    description:
      "개인 업무 성과는 뛰어나지만 회의 중 동료를 무시하거나 독단적인 태도로 팀 분위기를 해치는 핵심 인재에게 행동 개선을 요구하는 고난도 피드백 면담입니다.",
    learningObjectives: [
      "인격 모독 없이 관찰된 구체적 행동(SBI 모델)에 집중하여 피드백한다.",
      "팀원의 방어와 반발을 수용하면서도 개선의 필요성을 명확히 견지한다.",
      "팀원이 스스로 동료와의 협업 방식을 재정립하도록 서약을 이끌어낸다.",
    ],
    dramatic: {
      logline: "성과는 탁월하지만 독선적인 태도로 팀워크를 깨뜨리는 핵심 개발자와의 면담에서 리더는 인재를 잃지 않으면서 조직 문화를 지켜내야 한다.",
      synopsis:
        "팀 내 에이스로 불리지만, 코드 리뷰와 기획 회의에서 동료들에게 공격적인 언사를 쏟아내며 퇴사 직전까지 몰고 간 팀원이 있습니다. 팀장은 성과를 인정하되 용납될 수 없는 태도의 한계를 명확히 그어야 합니다.",
      theme: "따뜻한 배려와 단호한 기준의 조화 (Radical Candor)",
      stakes: "면담 실패 시 우수 인재의 감정적 이탈 또는 팀 내 동료들의 연쇄 퇴사",
      twist: "본인은 동료들이 답답해서 직언을 한 것일 뿐, 악의가 없었으며 오히려 회사 발전을 위했다고 억울해함",
      acts: [
        {
          name: "성과 인정 및 피드백 목적 안내",
          summary: "팀원의 뛰어난 기여를 충분히 인정하며 대화를 시작한다.",
          beats: ["최근 프로젝트 기여 칭찬", "면담 주제(협업 방식) 예고", "경계심 완화"],
        },
        {
          name: "구체적 사례(SBI) 전달 및 저항 다루기",
          summary: "관찰된 언행과 그것이 동료 및 팀에 미친 영향을 객관적으로 제시한다.",
          beats: ["구체적 회의 발언 사례 인용", "동료들의 위축과 프로젝트 지연 영향 설명", "팀원의 억울함 경청 및 반박 대응"],
        },
        {
          name: "행동 변화 약속 및 기준 합의",
          summary: "조직 내 수용 가능한 협업 기준을 제시하고 자발적 개선을 약속받는다.",
          beats: ["팀 규범 재확인", "팀원의 대안적 소통 방식 모색", "상호 피드백 루틴 합의"],
        },
      ],
      characters: [
        {
          name: "정수진",
          role: "테크 리드 / 시니어 전문가 (5년차)",
          motivation: "높은 완성도를 추구하다 보니 기준에 못 미치는 동료들의 실수를 참지 못하며, 자신의 솔직함이 미덕이라 생각함",
          traits: ["자신감 넘침", "완벽주의", "직설적", "방어적"],
          initialDialogue: "팀장님, 바쁜데 무슨 일이세요? 다음 스프린트 설계 때문에 시간 빼기 빠듯한데요.",
          behaviorGuidelines: [
            "초반에는 '제가 틀린 말 한 적 있나요? 실력이 부족하면 배우는 게 맞죠'라며 당당하게 나온다.",
            "팀장이 인격이 아닌 사실과 파급 효과를 차분히 짚어주면 점차 자신의 언행이 미친 영향을 깨닫고 당황한다.",
            "팀장이 감정적으로 화를 내면 '성과 잘 내는 사람한테 왜 이러시냐'며 즉시 공격적으로 반발한다.",
          ],
        },
      ],
    },
    competencies: [
      { key: "sbi_feedback", name: "객관적 피드백(SBI)", description: "상황(Situation), 행동(Behavior), 영향(Impact)을 객관적으로 분리하여 전달하는 기술" },
      { key: "handling_resistance", name: "저항 및 반발 관리", description: "상대방의 방어적 감정을 가라앉히고 핵심 메시지를 관철시키는 능력" },
      { key: "assertive_communication", name: "단호한 기준 제시", description: "배려심을 잃지 않으면서도 조직의 양보할 수 없는 원칙을 단호히 표명하는 능력" },
      { key: "change_commitment", name: "변화 합의 도출", description: "상대방의 자발적 반성과 구체적 행동 개선 약속을 이끌어내는 역량" },
    ],
    evaluation: {
      dimensions: [
        {
          key: "sbi_feedback",
          label: "사실 기반 객관적 피드백",
          weight: 0.25,
          criteria: [
            "'태도가 문제다' 식의 모호한 비판 대신 구체적인 사건과 발언을 지목하였는가?",
            "그 행동이 동료와 팀에 미친 실질적 영향을 명확히 설명하였는가?",
          ],
        },
        {
          key: "handling_resistance",
          label: "저항 및 방어 심리 다루기",
          weight: 0.25,
          criteria: [
            "팀원의 억울한 감정 표출에 흥분하지 않고 냉정하게 공감해주었는가?",
            "팀원의 높은 성과와 의도를 인정해주며 방어벽을 낮추었는가?",
          ],
        },
        {
          key: "assertive_communication",
          label: "원칙과 기준의 단호함",
          weight: 0.25,
          criteria: [
            "성과가 뛰어나더라도 협업 방식을 훼손하는 것은 용납될 수 없음을 분명히 밝혔는가?",
            "우물쭈물 타협하지 않고 리더로서의 명확한 기준을 견지하였는가?",
          ],
        },
        {
          key: "change_commitment",
          label: "행동 변화 서약",
          weight: 0.25,
          criteria: [
            "팀원 본인이 앞으로 다르게 행동할 소통 방안을 스스로 말하게 하였는가?",
            "주기적인 체크인과 피드백 과정을 정례화하기로 합의하였는가?",
          ],
        },
      ],
      defaultPassingScore: 75,
    },
    simulation: {
      mode: "roleplay",
      defaultInitialPrompt:
        "당신은 테크 리드 정수진 역할을 수행합니다. 실력에 대한 자부심이 강하고 직설적입니다. 동료들의 느린 일처리를 비판하는 것은 팀을 위한 것이라고 생각합니다. 팀장이 구체적인 영향과 기준을 차분히 짚어줄 때 비로소 자신의 태도를 되돌아보십시오.",
      rules: [
        "엘리트 의식과 완벽주의를 가진 페르소나를 자연스럽게 유지하십시오.",
        "자신의 말이 맞다며 논리적으로 방어하되, 팀장의 단호하고 존중 어린 지도에 점차 승복하십시오.",
        "한국어 구어체로 답변하십시오.",
      ],
    },
    termination: {
      conditions: ["협업 방식 개선 및 후속 피드백 합의", "최대 대화 턴 수 도달"],
      maxTurns: 12,
      targetTurns: 8,
      minValidTurns: 3,
    },
  },
  ...BUSINESS_SCENARIO_TEMPLATES,
];

export function getScenarioTemplate(id: string): AssessmentScenarioTemplate | undefined {
  return SCENARIO_TEMPLATES.find((template) => template.id === id);
}

export function listScenarioTemplates(): AssessmentScenarioTemplate[] {
  return SCENARIO_TEMPLATES;
}

