import { DraftScenarioResponse } from "@workspace/api-zod";
import { completeJSON, LLMRequestError, LLM_MODEL_ID } from "./llmClient";
import type { DramaticScenario } from "../scenario/model";

export const AMPLIFIER_ID = LLM_MODEL_ID;

/** Thrown when the LLM response cannot be parsed into a valid scenario. */
export class AmplificationError extends Error {}

const SYSTEM_PROMPT = `당신은 현실 기반 시나리오 작가다. 사용자의 짧은 아이디어를 현실에서 실제로 일어날 법한, 구체적이고 개연성 있는 드라마틱 시나리오로 증폭한다.

절대 규칙:
1. 입력 아이디어의 문장을 그대로 인용하거나 반복하지 마라. 아이디어를 재해석하여 완전히 새로운 구체적 상황으로 발전시켜라.
2. 현실성: 실제 존재할 법한 직업, 조직, 장소, 이해관계를 사용하라. 인물에게는 실명 같은 자연스러운 이름, 구체적 직책, 개인사에 뿌리 내린 동기를 부여하라.
3. 갈등은 선악 구도가 아니라, 각자 타당한 이유를 가진 사람들의 이해관계·신념 충돌로 설계하라.
4. 사건은 인과적으로 연결되어야 한다. 우연이 아닌 인물의 선택이 다음 사건을 만든다.
5. 반전(twist)은 앞의 사건들에 심어진 단서에서 자라나야 하며, 뜬금없는 폭로여서는 안 된다.
6. 입력 언어로 작성하라 (한국어 입력 → 한국어 시나리오).

반드시 아래 JSON 스키마로만 응답하라 (추가 텍스트 없이 JSON만):
{
  "title": string,          // 시나리오 제목
  "logline": string,        // 1-2문장 로그라인
  "synopsis": string,       // 4-8문장 시놉시스
  "theme": string,          // 중심 주제
  "stakes": string,         // 걸려 있는 것 (양쪽 모두)
  "twist": string,          // 반전
  "acts": [                 // 정확히 3개의 막
    { "name": string, "summary": string, "beats": [string, ...] }  // 막당 비트 3-5개
  ],
  "characters": [           // 인물 3-5명
    { "name": string, "role": string, "motivation": string }
  ]
}`;

/**
 * Amplify a raw idea into a realistic dramatic scenario using the LLM.
 * The response is schema-validated; invalid output raises AmplificationError
 * (no silent fallback).
 *
 * @param benchmarkConstraints - Optional group-pattern constraint text from a
 *   benchmark report (architecture-v2.md §I). When provided it is appended to
 *   the user prompt so the LLM shapes the draft toward the group profile while
 *   still producing an original story.
 */
export async function amplifyIdeaWithLLM(
  idea: string,
  title?: string,
  benchmarkConstraints?: string,
): Promise<DramaticScenario> {
  let userPrompt = title?.trim()
    ? `아이디어: ${idea}\n(제목은 "${title.trim()}"을 유지하라)`
    : `아이디어: ${idea}`;
  if (benchmarkConstraints?.trim()) {
    userPrompt += `\n\n${benchmarkConstraints.trim()}`;
  }

  let json: unknown;
  try {
    json = await completeJSON({ system: SYSTEM_PROMPT, user: userPrompt });
  } catch (err) {
    // Upstream failures (timeout, rate limit, unavailable, empty or non-JSON
    // output) are part of the amplification failure contract → surfaced as
    // 502, never a bare 500.
    if (err instanceof LLMRequestError) {
      throw new AmplificationError(err.message, { cause: err });
    }
    throw err;
  }

  const parsed = DraftScenarioResponse.safeParse(json);
  if (!parsed.success) {
    throw new AmplificationError(
      `AI response did not match the scenario schema: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  const scenario: DramaticScenario = {
    ...parsed.data,
    sourceIdea: idea,
    amplifiedBy: AMPLIFIER_ID,
  };
  if (title?.trim()) scenario.title = title.trim();
  return scenario;
}
