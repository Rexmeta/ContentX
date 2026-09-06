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
  category: "leadership" | "conflict_resolution" | "communication";
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
];

export function getScenarioTemplate(id: string): AssessmentScenarioTemplate | undefined {
  return SCENARIO_TEMPLATES.find((template) => template.id === id);
}

export function listScenarioTemplates(): AssessmentScenarioTemplate[] {
  return SCENARIO_TEMPLATES;
}

