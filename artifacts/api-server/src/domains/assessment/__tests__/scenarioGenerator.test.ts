import { describe, expect, it, vi } from "vitest";

vi.mock("../../ai/llmClient", () => ({
  completeJSON: vi.fn(),
  LLMRequestError: class LLMRequestError extends Error {},
}));

import { completeJSON } from "../../ai/llmClient";
import { generateAssessmentScenario, AssessmentScenarioGenerationError } from "../scenarioGenerator";
import { instantiateAssessmentTemplate } from "../templateInstantiator";
import { compileAssessmentScenarioPackage } from "../compiler";

describe("assessment scenario generator", () => {
  it("rejects shallow AI output before it can reach persistence", async () => {
    vi.mocked(completeJSON).mockResolvedValueOnce({
      title: "짧은 제목", logline: "짧은 로그라인", synopsis: "짧은 설명", theme: "짧은 주제", stakes: "짧은 위험", twist: "짧은 반전",
      acts: [], characters: [], timeline: "짧음", playerRole: "리드", objectives: [], successCriteria: [],
      constraints: [], difficultyRationale: "짧음", simulationInitialPrompt: "짧음", simulationRules: [],
      terminationConditions: [], competencyKeys: ["active_listening"], evaluation: [],
    });
    await expect(generateAssessmentScenario(instantiateAssessmentTemplate({
      templateId: "tmpl-ldr-01", companyContext: "SaaS 장애 대응 조직",
    }))).rejects.toMatchObject({
      kind: "validation",
      message: "AI output did not meet the required assessment quality contract.",
    });
  });

  it("rejects competency or evaluation definitions that drift from the selected template", async () => {
    const rich = {
      title: "골든타임 장애 대응 리더십 평가", logline: "오후 세 시 고객 데드라인을 앞두고 핫픽스와 롤백 사이에서 두 조직의 충돌을 중재해야 한다.", synopsis: "A".repeat(500), theme: "위기 상황의 데이터 기반 합의와 신뢰 회복", stakes: "B".repeat(150), twist: "C".repeat(80),
      acts: ["상황 정렬", "리스크 검증", "실행 합의"].map((name) => ({ name, summary: "D".repeat(100), beats: ["E".repeat(20), "F".repeat(20), "G".repeat(20)] })),
      characters: ["박지훈", "이선영"].map((name) => ({ name, role: "장애 대응 팀 리더", motivation: "H".repeat(100), traits: ["논리적", "긴장함", "책임감"], initialDialogue: "I".repeat(20), behaviorGuidelines: ["J".repeat(20), "K".repeat(20), "L".repeat(20)] })),
      timeline: "M".repeat(50), playerRole: "Incident Lead", objectives: ["N".repeat(35), "O".repeat(35), "P".repeat(35), "Q".repeat(35)],
      successCriteria: ["R".repeat(35), "S".repeat(35), "T".repeat(35), "U".repeat(35)], constraints: ["V".repeat(20), "W".repeat(20), "X".repeat(20)],
      difficultyRationale: "Y".repeat(35), simulationInitialPrompt: "Z".repeat(150), simulationRules: ["a".repeat(20), "b".repeat(20), "c".repeat(20)],
      terminationConditions: ["d".repeat(20), "e".repeat(20)], competencyKeys: ["wrong"], evaluation: [{ key: "wrong", weight: 1, criteria: ["f".repeat(10)] }],
    };
    vi.mocked(completeJSON).mockResolvedValueOnce(rich);
    await expect(generateAssessmentScenario(instantiateAssessmentTemplate({
      templateId: "tmpl-ldr-01", companyContext: "SaaS 장애 대응 조직",
    }))).rejects.toMatchObject({ kind: "validation" });
  });

  it("rebinds the primary persona when AI generates different character names", async () => {
    const instantiated = instantiateAssessmentTemplate({
      templateId: "tmpl-ldr-01",
      companyContext: "SaaS 장애 대응 조직",
      counterpartName: "Original Counterpart",
    });
    const dimensions = instantiated.configuration.evaluation!.dimensions;
    vi.mocked(completeJSON).mockResolvedValueOnce({
      title: "골든타임 장애 대응 리더십 평가",
      logline: "오후 세 시 고객 데드라인을 앞두고 핫픽스와 롤백 사이에서 두 조직의 충돌을 중재해야 한다.",
      synopsis: "장애 발생 경과와 고객 영향, 조직 간 대립, 오후 세 시 데드라인 및 의사결정 책임을 구체적으로 설명한다. ".repeat(20),
      theme: "위기 상황의 데이터 기반 합의와 신뢰 회복",
      stakes: "핵심 고객 계약과 손해배상, 서비스 신뢰, 조직 번아웃 및 추가 장애 위험이 동시에 걸려 있다. ".repeat(5),
      twist: "양 팀 모두 과거 실패 경험과 경영진 압박 때문에 자신의 대안을 쉽게 포기할 수 없는 상황이다. ".repeat(3),
      acts: ["상황 정렬", "리스크 검증", "실행 합의"].map((name) => ({
        name,
        summary: "상충하는 사실과 이해관계를 확인하고 제한 시간 안에 검증 가능한 단일 실행안을 합의하도록 진행한다. ".repeat(3),
        beats: [
          "객관적인 장애 지표와 고객 데드라인을 확인해 공동의 문제를 정의한다.",
          "각 대안의 실패 조건과 고객 및 운영 리스크를 수치와 증거로 비교한다.",
          "담당자와 완료 시각, 중단 기준이 포함된 후속 조치를 문서로 확정한다.",
        ],
      })),
      characters: ["새로운 개발 리드", "새로운 운영 리드"].map((name) => ({
        name,
        role: "장애 대응 부서 책임자",
        motivation: "자신의 전문적 입장과 팀의 안전을 지키면서도 검증 가능한 조건이 충족되면 상대 대안을 수용하려 한다. ".repeat(3),
        traits: ["논리적", "긴장함", "책임감"],
        initialDialogue: "현재 상태에서 근거 없이 결정을 서두르면 고객 피해가 더 커질 수 있습니다.",
        behaviorGuidelines: [
          "초반에는 자신의 대안과 그 근거를 단호하게 주장하며 쉬운 양보를 피한다.",
          "응시자가 객관적인 중단 기준과 책임 분담을 제안하면 조건부 협상에 응한다.",
          "책임 공방이나 근거 없는 낙관론이 나오면 구체적인 데이터와 계획을 요구한다.",
        ],
      })),
      timeline: "현재 오전 열한 시이며 고객 정상화 계획 제출 시각인 오후 세 시까지 남은 시간은 네 시간이다.",
      playerRole: "임시 장애 대응 총괄 리더",
      objectives: [
        "오후 두 시까지 복구 대안 하나를 선택하고 양 팀의 역할과 책임을 문서로 확정한다.",
        "고객 제출용 정상화 계획에 조치 내용과 완료 예상 시각 및 재발 방지 방향을 포함한다.",
        "책임 공방을 중단시키고 검증 가능한 데이터와 공동 목표 중심으로 논의를 전환한다.",
        "선택한 방안의 중단 조건과 대체 계획, 사후 분석 일정을 명시적으로 합의한다.",
      ],
      successCriteria: [
        "최적 수준은 오후 세 시 전 안정화와 고객 신뢰 회복 및 양 팀의 자발적 합의를 모두 달성한다.",
        "우수 수준은 명확한 근거의 리더 결정을 양 팀이 수용하고 정해진 역할대로 복구한다.",
        "수용 수준은 안전한 복구로 데드라인을 맞추지만 근본 원인과 일부 갈등이 남는다.",
        "실패 수준은 결정 지연 또는 추가 장애로 데드라인과 핵심 고객 계약을 모두 잃는다.",
      ],
      constraints: [
        "검증되지 않은 기술적 가정을 확정 사실처럼 고객에게 전달하지 않는다.",
        "모든 실행안에는 담당자와 완료 시각 및 중단 기준을 반드시 포함한다.",
        "인신공격과 책임 공방 대신 현재 장애 안정화와 고객 영향 축소에 집중한다.",
      ],
      difficultyRationale: "불완전한 기술 정보와 상충하는 조직 이해관계 속에서 제한 시간 내 결단과 합의를 동시에 요구한다.",
      simulationInitialPrompt: "당신은 장애 대응 부서 책임자로서 자신의 팀과 고객을 보호해야 한다. 초반에는 기존 입장을 단호히 유지하되 응시자가 데이터, 중단 기준, 책임 분담과 실행 가능한 고객 계획을 제시하면 조건부로 합의하라. ".repeat(3),
      simulationRules: [
        "캐릭터의 입장과 감정, 전문 용어를 유지하며 한국어 구어체로 응답한다.",
        "응시자의 질문이 모호하면 구체적인 수치와 담당자 및 완료 시각을 되묻는다.",
        "검증 가능한 조건 없는 쉬운 양보를 피하되 합리적 대안에는 협상 가능성을 연다.",
      ],
      terminationConditions: [
        "단일 복구 방안과 담당자, 완료 시각, 중단 기준 및 고객 소통 계획이 합의된다.",
        "최대 대화 턴 수에 도달하거나 고객 제출 데드라인을 지킬 수 없는 상태가 된다.",
      ],
      competencyKeys: [...instantiated.configuration.competencyKeys],
      evaluation: dimensions.map(({ key, weight, criteria }) => ({ key, weight, criteria: [...criteria] })),
    });

    const generated = await generateAssessmentScenario(instantiated);
    const compiled = compileAssessmentScenarioPackage({
      ...instantiated.compilationInput,
      scenarios: [{ dramaticScenario: generated.dramaticScenario, configuration: generated.configuration }],
    });

    expect(generated.configuration.primaryPersonaKey).not.toBe(instantiated.configuration.primaryPersonaKey);
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.package?.scenarios[0]?.personas.filter((persona) => persona.isPrimary)).toHaveLength(1);
    expect(compiled.package?.scenarios[0]?.personas[0]?.name).toBe("새로운 개발 리드");
  });
});