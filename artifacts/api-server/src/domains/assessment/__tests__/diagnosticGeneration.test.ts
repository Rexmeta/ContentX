import { describe, expect, it, vi } from "vitest";
vi.mock("../../ai/llmClient", () => ({ completeJSON: vi.fn(), LLMRequestError: class extends Error {} }));
import { completeJSON } from "../../ai/llmClient";
import { generateAssessmentScenario } from "../scenarioGenerator";
import { instantiateAssessmentTemplate } from "../templateInstantiator";
import { diagnosticSample } from "../diagnosticSample";
import { compileAssessmentScenarioPackage } from "../compiler";
import { parseDiagnostic, projectParticipant } from "../diagnostic";

function fixture() {
  const input = instantiateAssessmentTemplate({ templateId: "tmpl-ldr-01", companyContext: "훈련 조직" });
  const raw = {
    title: "영업 조직의 갈등과 성과 면담", logline: "팀장이 성과와 업무 상황을 확인하고 다음 달 구체적인 실행계획을 합의하는 면담이다.",
    synopsis: "시작 시점에 확인된 상황을 공유한다. ".repeat(40), theme: "공정한 업무 조건 탐색과 실행계획 합의",
    stakes: "다음 달 실적과 지원 범위를 구체적으로 정해야 한다. ".repeat(10), twist: "질문으로 확인해야 하는 추가 업무가 있다. ".repeat(8),
    acts: ["실적 사실 확인", "업무 변화 탐색", "실행 계획 합의"].map((name) => ({ name, summary: "상황과 이해관계를 충분히 확인한다. ".repeat(10), beats: ["확인된 사실을 토대로 서로의 주장을 논의한다.", "업무 변화와 장애물을 탐색하고 근거를 확인한다.", "실행계획의 담당자와 점검 시점을 함께 정한다."] })),
    characters: ["김 대리", "박 과장"].map((name) => ({
      name, role: "영업팀 담당자", stance: "업무 상황을 공정하게 검토해주기를 원한다. ".repeat(10), goal: "다음 달 실행 가능한 성과 계획을 합의한다. ".repeat(8),
      tradeoff: "업무 우선순위를 조정해주면 성과 개선을 위한 구체적인 활동 계획을 합의할 수 있다. ".repeat(5),
      traits: ["신중함", "책임감", "긴장함"], initialDialogue: "오늘은 최근 두 달의 업무 상황에 대해 함께 논의하고 싶습니다.",
      behaviorGuidelines: ["담당 역할의 입장과 감정을 일관되게 유지한다.", "구체적인 질문에만 비공개 업무 변화 사실을 공개한다.", "명확한 지원 방안과 기준이 제시되면 실행 계획을 합의한다."],
    })),
    timeline: "이번 달 마지막 주에 다음 달 실행계획을 수립하는 정기 성과 면담이며 현재 오후 두 시에 시작한다. ".repeat(2),
    playerRole: { position: "영업팀의 팀장", department: "영업팀", experience: "10년", responsibility: "팀원의 실적과 업무 조건을 확인하고 필요한 지원과 실행계획, 담당자와 점검 일정을 합의한다. ".repeat(4) },
    objectives: ["현재 확인된 실적과 업무 정보를 공유하고 추가 확인이 필요한 사항을 구체적으로 질문한다.".repeat(2), "업무 변화와 장애물에 대한 상대방의 설명을 확인하고 우선순위를 함께 검토한다.".repeat(2), "상대방의 우려를 확인하고 구체적인 사실을 바탕으로 성과 기준을 설명한다.".repeat(2), "다음 달 실행계획의 행동과 담당자, 점검 시점을 합의해 문서로 정리한다.".repeat(2)],
    successCriteria: { optimal: "실행계획과 담당자, 점검 일정을 모두 구체적으로 합의한다. ".repeat(8), good: "명확한 계획에 합의하나 일부 확인이 필요하다. ".repeat(8), acceptable: "일부 계획만 합의되어 추가 조정이 필요하다. ".repeat(8), failure: "업무 조건을 확인하지 않고 일방적으로 지시한다. ".repeat(8) },
    constraints: ["공개 전 단서의 사실을 브리핑에서 제공하지 않는다.", "근거 없는 인사 처분이나 권한 밖의 약속을 하지 않는다.", "인신공격과 위협적인 발화 없이 면담을 진행해야 한다."],
    difficultyRationale: "실적 부진과 업무 변화, 방어적 반응이 함께 존재하므로 탐색과 이의 대응을 동시에 요구한다.",
    simulationInitialPrompt: "당신은 영업팀 담당자다. 질문이 있을 때만 업무 변화를 공개하고 정해진 구간에 비공격적인 방어 반응을 제시한다. ".repeat(5),
    simulationRules: ["역할과 감정을 유지하며 일관되게 한국어로 응답한다.", "정확한 질문 문장이 아닌 질문 의도에 따라 단서를 공개한다.", "합의가 가능한 구체적인 지원과 실행계획이 나오면 반응한다."],
    terminationConditions: ["실행계획과 담당자 및 점검 시점의 합의가 완료된다.", "최대 대화 턴에 도달하여 더 이상 대화를 이어가지 않는다."],
    competencyKeys: input.configuration.competencyKeys,
    evaluation: input.configuration.evaluation!.dimensions.map(({ key, weight, criteria }) => ({ key, weight, criteria })),
    diagnostic: diagnosticSample("sample", "author").diagnostic,
  };
  raw.diagnostic.scenarios[0]!.scenarioKey = input.configuration.scenarioKey;
  raw.diagnostic.scenarios[0]!.criteria.forEach((c) => { c.dimensionKey = input.configuration.evaluation!.dimensions[0]!.key; });
  return { input, raw };
}
describe("AI diagnostic contract", () => {
  it("requests separate hidden knowledge, preserves human authoring priority and validates the generated structure", async () => {
    const { input, raw } = fixture();
    const human = structuredClone(raw.diagnostic);
    human.scenarios[0]!.briefing.reason = "사람이 직접 작성한 시작 시점 정보";
    vi.mocked(completeJSON).mockResolvedValueOnce(raw);
    const generated = await generateAssessmentScenario(input, { diagnosticMode: true, diagnostic: human });
    expect(generated.diagnostic).toEqual(human);
    expect(vi.mocked(completeJSON).mock.lastCall![0].user).toContain("시작 시점에 이미 아는 사실만");
    expect(vi.mocked(completeJSON).mock.lastCall![0].user).toContain("private/cues/criteria");
    const compiled = compileAssessmentScenarioPackage({ ...input.compilationInput, scenarios: [{ dramaticScenario: generated.dramaticScenario, configuration: generated.configuration }] });
    expect(compiled.package).toBeDefined();
    const source = parseDiagnostic(generated.diagnostic, compiled.package!);
    expect(JSON.stringify(projectParticipant(source, "preparation"))).not.toContain("주요 고객 두 곳");
  });
  it("fails before persistence if AI omits diagnostic source or generates dangling cue references", async () => {
    const { input, raw } = fixture();
    vi.mocked(completeJSON).mockResolvedValueOnce({ ...raw, diagnostic: undefined });
    await expect(generateAssessmentScenario(input, { diagnosticMode: true })).rejects.toMatchObject({ kind: "validation" });
    raw.diagnostic.scenarios[0]!.cues[0]!.criterionIds = ["not-a-criterion"];
    vi.mocked(completeJSON).mockResolvedValueOnce(raw);
    await expect(generateAssessmentScenario(input, { diagnosticMode: true })).rejects.toMatchObject({ kind: "validation" });
  });
});
