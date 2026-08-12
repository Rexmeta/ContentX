import { z } from "zod/v4";
import { openai } from "@workspace/integrations-openai-ai-server";
import type { DramaticScenario } from "../ai/scenarioAmplifier";
import type { CategoryAxis, Classification } from "./taxonomy";

export const CLASSIFIER_MODEL = "gpt-5.6-terra";
export const CLASSIFIER_ID = `openai/${CLASSIFIER_MODEL}`;

/** Thrown when LLM classification fails (provider error or invalid output). */
export class ClassificationError extends Error {}

const ClassificationOutput = z.object({
  domain: z.string().min(1),
  conflictType: z.string().min(1),
  tone: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1).max(8),
});

export type Classifier = (
  scenario: DramaticScenario,
  existing: Record<CategoryAxis, string[]>,
) => Promise<Classification>;

function buildPrompt(
  scenario: DramaticScenario,
  existing: Record<CategoryAxis, string[]>,
): string {
  return `다음 시나리오를 분류하라.

[분류 축과 기존 카테고리]
- domain (상황이 벌어지는 현실 영역): ${existing.domain.join(", ")}
- conflictType (핵심 갈등 유형): ${existing.conflictType.join(", ")}
- tone (전반적 톤): ${existing.tone.join(", ")}

규칙:
1. 각 축에서 기존 카테고리 중 가장 잘 맞는 하나를 선택하라.
2. 기존 카테고리가 정말로 맞지 않을 때만 새 카테고리 이름(한국어, 2-8자 명사형)을 제안하라. 유사한 기존 카테고리가 있으면 반드시 그것을 사용하라.
3. tags: 이 시나리오 고유의 상황 키워드 3-6개 (한국어, 짧은 명사구).

JSON만 응답: {"domain": string, "conflictType": string, "tone": string, "tags": string[]}

[시나리오]
제목: ${scenario.title}
로그라인: ${scenario.logline}
시놉시스: ${scenario.synopsis}
주제: ${scenario.theme}
갈등: ${scenario.stakes}`;
}

/** LLM classifier: picks existing categories or proposes new ones. */
export const classifyWithLLM: Classifier = async (scenario, existing) => {
  let response;
  try {
    response = await openai.chat.completions.create({
      model: CLASSIFIER_MODEL,
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: buildPrompt(scenario, existing) }],
    });
  } catch (err) {
    throw new ClassificationError(
      `AI provider request failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new ClassificationError("AI returned an empty response.");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ClassificationError("AI classification was not valid JSON.");
  }

  const parsed = ClassificationOutput.safeParse(json);
  if (!parsed.success) {
    throw new ClassificationError(
      `AI classification did not match schema: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  return { ...parsed.data, classifiedBy: CLASSIFIER_ID };
};

/** Deterministic mock classifier for tests. */
export const mockClassifier: Classifier = async (scenario, existing) => ({
  domain: existing.domain[0] ?? "직장",
  conflictType: existing.conflictType[0] ?? "이해충돌",
  tone: existing.tone[0] ?? "긴장감",
  tags: [scenario.title.slice(0, 8) || "태그"],
  classifiedBy: "mock/classifier-v1",
});
