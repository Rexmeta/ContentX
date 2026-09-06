import { z } from "zod";
import { completeJSON, LLMRequestError } from "../ai/llmClient";
import type { DramaticScenario } from "../scenario/model";
import type { AssessmentScenarioConfiguration } from "./model";
import type { InstantiatedAssessment } from "./templateInstantiator";
import { assessmentElementKey } from "./compiler";

const text = (minimum: number) => z.string().trim().min(minimum);
const successLevels = ["optimal", "good", "acceptable", "failure"] as const;
const successLabels: Record<(typeof successLevels)[number], string> = {
  optimal: "최적",
  good: "양호",
  acceptable: "수용 가능",
  failure: "실패",
};
const generatedSchema = z.object({
  title: text(8), logline: text(30), synopsis: text(500), theme: text(15), stakes: text(150), twist: text(80),
  acts: z.array(z.object({ name: text(4), summary: text(100), beats: z.array(text(20)).min(3).max(5) }).strict()).length(3),
  characters: z.array(z.object({
    name: text(2), role: text(4), stance: text(100), goal: text(60), tradeoff: text(80), traits: z.array(text(2)).min(3),
    initialDialogue: text(20), behaviorGuidelines: z.array(text(20)).min(3),
  }).strict()).min(2).max(4),
  timeline: text(50), playerRole: z.object({
    position: text(4), department: text(2), experience: text(2), responsibility: text(100),
  }).strict(), objectives: z.array(text(35)).min(4),
  successCriteria: z.object({
    optimal: text(100), good: text(100), acceptable: text(100), failure: text(100),
  }).strict(), constraints: z.array(text(20)).min(3),
  difficultyRationale: text(35), simulationInitialPrompt: text(150),
  simulationRules: z.array(text(20)).min(3), terminationConditions: z.array(text(20)).min(2),
  competencyKeys: z.array(text(1)).min(1),
  evaluation: z.array(z.object({ key: text(1), weight: z.number().finite().nonnegative(), criteria: z.array(text(10)).min(1) }).strict()).min(1),
}).strict();

export type GeneratedAssessmentScenario = z.infer<typeof generatedSchema>;

export class AssessmentScenarioGenerationError extends Error {
  constructor(
    readonly kind: "provider" | "validation",
    message: string,
    readonly issues?: string[],
  ) {
    super(message);
    this.name = "AssessmentScenarioGenerationError";
  }
}

function prompt(input: InstantiatedAssessment): string {
  const template = input.template;
  return `당신은 한국 기업의 Assessment Center 수석 설계자다. 아래 고정 평가 청사진을 절대 바꾸지 말고, 골든타임 장애 대응 사례처럼 구체적인 시간·수치·이해관계·상충하는 선택지·실패 결과가 살아 있는 고밀도 한국어 역할극을 JSON으로 설계하라.

조직 맥락과 사용자 요청은 이미 초안에 반영되어 있다:
${JSON.stringify({ title: input.title, description: input.description, draft: input.dramaticScenario, participantRole: input.configuration.playerRole })}

고정 역량 키(순서까지 동일): ${JSON.stringify(input.configuration.competencyKeys)}
고정 평가 차원(키, 가중치, 기준을 동일하게 보존): ${JSON.stringify(input.configuration.evaluation?.dimensions)}

반드시 JSON 객체만 반환한다. 다음 키를 정확히 포함한다:
title, logline, synopsis, theme, stakes, twist, acts, characters, timeline, playerRole, objectives, successCriteria, constraints, difficultyRationale, simulationInitialPrompt, simulationRules, terminationConditions, competencyKeys, evaluation.
acts는 정확히 3개이며 각 막은 name, summary, beats(3~5개)를 가진다.
characters는 2~4명이며 name, role, stance, goal, tradeoff, traits, initialDialogue, behaviorGuidelines를 가진다. stance(현재 주장과 근거), goal(얻고자 하는 결과), tradeoff(양보 가능한 조건)를 서로 반복하지 말고 각각 충분히 구체적으로 쓴다.
playerRole은 position, department, experience, responsibility를 가진 객체이며 responsibility에는 응시자가 내려야 할 결정, 조율할 이해관계자, 만들어야 할 산출물을 명시한다.
successCriteria는 optimal, good, acceptable, failure 네 키를 정확히 가진 객체다. 각 수준은 관찰 가능한 합의 수준, 실행안, 잔여 위험과 실패 결과가 단계적으로 구분되어야 한다.
synopsis/stakes는 얕은 요약이 아니라 배경, 사건 경과, 구체적 데드라인, 단기·장기 이해관계와 위험을 충분히 서술한다. objectives는 측정 가능한 행동과 산출물을 쓴다.`;
}

function sameFixedSet(value: GeneratedAssessmentScenario, input: InstantiatedAssessment): string[] {
  const expectedKeys = input.configuration.competencyKeys;
  const dimensionMap = new Map((input.configuration.evaluation?.dimensions ?? []).map((item) => [item.key, item]));
  const issues: string[] = [];
  if (value.competencyKeys.length !== expectedKeys.length || value.competencyKeys.some((key, index) => key !== expectedKeys[index])) issues.push("competencyKeys must exactly match the selected template competency set.");
  if (value.evaluation.length !== dimensionMap.size) issues.push("evaluation must contain exactly the selected template evaluation dimensions.");
  for (const item of value.evaluation) {
    const expected = dimensionMap.get(item.key);
    if (!expected || item.weight !== expected.weight || JSON.stringify(item.criteria) !== JSON.stringify(expected.criteria)) issues.push(`evaluation.${item.key} must exactly preserve the selected template definition.`);
  }
  return issues;
}

/** Generates and quality-gates rich Korean material before any persistence occurs. */
export async function generateAssessmentScenario(input: InstantiatedAssessment): Promise<{ dramaticScenario: DramaticScenario; configuration: AssessmentScenarioConfiguration }> {
  let raw: unknown;
  try {
    raw = await completeJSON({ system: "Return only strict JSON. Do not add commentary.", user: prompt(input), maxCompletionTokens: 8192 });
  } catch (error) {
    const message = error instanceof LLMRequestError ? error.message : "AI assessment scenario generation failed.";
    throw new AssessmentScenarioGenerationError("provider", message);
  }
  const parsed = generatedSchema.safeParse(raw);
  const issues = !parsed.success
    ? parsed.error.issues.map((issue) => `${issue.path.join(".") || "$"}: ${issue.message}`)
    : sameFixedSet(parsed.data, input);
  if (issues.length) throw new AssessmentScenarioGenerationError("validation", "AI output did not meet the required assessment quality contract.", issues);
  const value = parsed.data!;
  const playerRole = [
    `[직책] ${value.playerRole.position}`,
    `[소속] ${value.playerRole.department}`,
    `[경력] ${value.playerRole.experience}`,
    `[책임] ${value.playerRole.responsibility}`,
  ].join("\n");
  const successCriteria = successLevels.map((level) => `[${successLabels[level]}] ${value.successCriteria[level]}`);
  return {
    dramaticScenario: {
      title: value.title, logline: value.logline, synopsis: value.synopsis, theme: value.theme, stakes: value.stakes, twist: value.twist,
      acts: value.acts, characters: value.characters.map(({ name, role, stance, goal, tradeoff }) => ({
        name, role, motivation: `[입장]\n${stance}\n[목표]\n${goal}\n[양보 조건]\n${tradeoff}`,
      })),
      sourceIdea: input.dramaticScenario.sourceIdea,
    },
    configuration: {
      ...input.configuration,
      primaryPersonaKey: assessmentElementKey(value.characters[0]!.name, 0),
      timeline: value.timeline, playerRole, objectives: value.objectives, successCriteria,
      constraints: value.constraints, difficultyProfile: { ...input.configuration.difficultyProfile, rationale: value.difficultyRationale },
      personaProfiles: value.characters.map(({ name, role, stance, goal, tradeoff, traits, initialDialogue, behaviorGuidelines }) => ({
        name, role, background: `[입장]\n${stance}\n[목표]\n${goal}\n[양보 조건]\n${tradeoff}`, traits, initialDialogue, behaviorGuidelines,
      })),
      simulation: { ...input.configuration.simulation!, initialPrompt: value.simulationInitialPrompt, rules: value.simulationRules },
      termination: { ...input.configuration.termination!, conditions: value.terminationConditions },
    },
  };
}