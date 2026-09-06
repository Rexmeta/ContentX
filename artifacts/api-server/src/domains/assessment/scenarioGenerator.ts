import { z } from "zod";
import { completeJSON, LLMRequestError } from "../ai/llmClient";
import type { DramaticScenario } from "../scenario/model";
import type { AssessmentScenarioConfiguration } from "./model";
import type { InstantiatedAssessment } from "./templateInstantiator";
import { assessmentElementKey } from "./compiler";

const text = (minimum: number) => z.string().trim().min(minimum);
const generatedSchema = z.object({
  title: text(8), logline: text(30), synopsis: text(500), theme: text(15), stakes: text(150), twist: text(80),
  acts: z.array(z.object({ name: text(4), summary: text(100), beats: z.array(text(20)).min(3).max(5) }).strict()).length(3),
  characters: z.array(z.object({
    name: text(2), role: text(4), motivation: text(100), traits: z.array(text(2)).min(3),
    initialDialogue: text(20), behaviorGuidelines: z.array(text(20)).min(3),
  }).strict()).min(2).max(4),
  timeline: text(50), playerRole: text(4), objectives: z.array(text(35)).min(4),
  successCriteria: z.array(text(35)).min(4), constraints: z.array(text(20)).min(3),
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
acts는 정확히 3개이며 각 막은 name, summary, beats(3~5개)를 가진다. characters는 2~4명이며 name, role, motivation, traits, initialDialogue, behaviorGuidelines를 가진다. 각 인물의 motivation에는 입장·목표·양보 조건을 자연스럽게 포함한다. synopsis/stakes는 얕은 요약이 아니라 배경, 사건 경과, 데드라인, 이해관계, 위험을 충분히 서술한다. objectives와 successCriteria는 측정 가능한 행동과 산출물을 써라.`;
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
  return {
    dramaticScenario: {
      title: value.title, logline: value.logline, synopsis: value.synopsis, theme: value.theme, stakes: value.stakes, twist: value.twist,
      acts: value.acts, characters: value.characters.map(({ name, role, motivation }) => ({ name, role, motivation })),
      sourceIdea: input.dramaticScenario.sourceIdea,
    },
    configuration: {
      ...input.configuration,
      primaryPersonaKey: assessmentElementKey(value.characters[0]!.name, 0),
      timeline: value.timeline, playerRole: value.playerRole, objectives: value.objectives, successCriteria: value.successCriteria,
      constraints: value.constraints, difficultyProfile: { ...input.configuration.difficultyProfile, rationale: value.difficultyRationale },
      personaProfiles: value.characters.map(({ name, role, motivation, traits, initialDialogue, behaviorGuidelines }) => ({
        name, role, background: motivation, traits, initialDialogue, behaviorGuidelines,
      })),
      simulation: { ...input.configuration.simulation!, initialPrompt: value.simulationInitialPrompt, rules: value.simulationRules },
      termination: { ...input.configuration.termination!, conditions: value.terminationConditions },
    },
  };
}