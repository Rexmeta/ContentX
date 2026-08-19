import { DraftScenarioResponse } from "@workspace/api-zod";
import { completeJSON, LLMRequestError, LLM_MODEL_ID } from "../ai/llmClient";
import type { DramaticScenario } from "./model";
import type { Lineage, LineageParent, ScenarioElement } from "../../shared/lineage";

export const SYNTHESIZER_ID = LLM_MODEL_ID;

/** Thrown when LLM synthesis fails (provider error or invalid output). */
export class SynthesisError extends Error {}

export type { Lineage, LineageParent, ScenarioElement };

export interface SynthesisSourceInput {
  scenario: DramaticScenario;
  elements: ScenarioElement[];
}

export type Synthesizer = (
  sources: SynthesisSourceInput[],
  instruction?: string,
) => Promise<DramaticScenario>;

const ELEMENT_LABEL: Record<ScenarioElement, string> = {
  // Original 5 elements
  characters: "인물과 인물 관계",
  conflict: "갈등 구조 (주제·걸린 것·이해관계 충돌)",
  setting: "배경·무대 (장소, 조직, 세계)",
  twist: "반전 장치",
  structure: "3막 사건 구조와 전개 리듬",
  // Extended elements (phase 1)
  relationship: "인물 간 관계 역학",
  goal: "인물들의 목표와 동기",
  event: "핵심 사건·전환점",
  ending: "결말·해소 방식",
};

/** Extract only the selected elements of a source scenario, structured. */
export function extractElements(
  scenario: DramaticScenario,
  elements: ScenarioElement[],
): string {
  const parts: string[] = [];
  for (const el of elements) {
    switch (el) {
      case "characters":
        parts.push(
          `- 인물:\n${scenario.characters
            .map((c) => `  · ${c.name} (${c.role}) — ${c.motivation}`)
            .join("\n")}`,
        );
        break;
      case "conflict":
        parts.push(
          `- 갈등 구조: 주제 "${scenario.theme}" / 걸린 것 "${scenario.stakes}" / 로그라인 "${scenario.logline}"`,
        );
        break;
      case "setting":
        parts.push(`- 배경·무대: ${scenario.synopsis}`);
        break;
      case "twist":
        parts.push(`- 반전: ${scenario.twist}`);
        break;
      case "structure":
        parts.push(
          `- 사건 구조:\n${scenario.acts
            .map(
              (a) =>
                `  · ${a.name}: ${a.summary}\n${a.beats.map((b) => `    - ${b}`).join("\n")}`,
            )
            .join("\n")}`,
        );
        break;
      case "relationship":
        parts.push(
          `- 인물 간 관계 역학:\n${scenario.characters
            .map((c) => `  · ${c.name} (${c.role})`)
            .join("\n")}\n  로그라인 맥락: "${scenario.logline}"`,
        );
        break;
      case "goal":
        parts.push(
          `- 인물 목표·동기:\n${scenario.characters
            .map((c) => `  · ${c.name}: ${c.motivation}`)
            .join("\n")}`,
        );
        break;
      case "event":
        // Key turning-point beats from each act
        parts.push(
          `- 핵심 사건·전환점:\n${scenario.acts
            .map((a) => `  · [${a.name}] ${a.beats[0] ?? a.summary}`)
            .join("\n")}`,
        );
        break;
      case "ending":
        // Final act represents the resolution/ending
        {
          const finalAct = scenario.acts[scenario.acts.length - 1];
          parts.push(
            finalAct
              ? `- 결말·해소: [${finalAct.name}] ${finalAct.summary}`
              : `- 결말·해소: ${scenario.twist}`,
          );
        }
        break;
    }
  }
  return parts.join("\n");
}

const SYSTEM_PROMPT = `당신은 시나리오 합성 전문가다. 여러 시나리오에서 선택된 요소들을 재료로, 완전히 새로운 하나의 유기적인 시나리오를 창조한다.

절대 규칙:
1. 요소를 기계적으로 이어붙이지 마라. 가져온 요소들이 서로 필연적으로 얽히는 새로운 상황을 발명하라. 인물을 가져왔다면 그 인물이 새 배경에서 살아온 이유가 있어야 하고, 갈등 구조를 가져왔다면 새 인물들의 이해관계로 재해석되어야 한다.
2. 가져오지 않은 요소는 자유롭게 새로 창작하되, 가져온 요소들과 인과적으로 맞물려야 한다.
3. 현실성: 실제 있을 법한 직업·조직·이해관계. 우연이 아닌 인물의 선택이 사건을 만든다.
4. 결과물은 재료의 출처를 모르는 독자에게도 하나의 완결된 이야기로 읽혀야 한다.
5. 입력 언어로 작성하라 (한국어 재료 → 한국어 시나리오).

반드시 아래 JSON 스키마로만 응답하라 (JSON만):
{
  "title": string, "logline": string, "synopsis": string, "theme": string,
  "stakes": string, "twist": string,
  "acts": [ { "name": string, "summary": string, "beats": [string, ...] } ],  // 정확히 3개, 막당 비트 3-5개
  "characters": [ { "name": string, "role": string, "motivation": string } ]  // 3-5명
}`;

function buildUserPrompt(
  sources: SynthesisSourceInput[],
  instruction?: string,
): string {
  const blocks = sources.map(
    (s, i) =>
      `[재료 ${i + 1}: "${s.scenario.title}" — 가져올 요소: ${s.elements
        .map((e) => ELEMENT_LABEL[e])
        .join(", ")}]\n${extractElements(s.scenario, s.elements)}`,
  );
  const parts = [blocks.join("\n\n")];
  if (instruction?.trim()) {
    parts.push(`[추가 지시]\n${instruction.trim()}`);
  }
  parts.push("위 재료들을 유기적으로 결합한 새 시나리오를 생성하라.");
  return parts.join("\n\n");
}

/** LLM synthesizer: recombines selected elements into a new scenario. */
export const synthesizeWithLLM: Synthesizer = async (sources, instruction) => {
  let json: unknown;
  try {
    json = await completeJSON({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(sources, instruction),
    });
  } catch (err) {
    if (err instanceof LLMRequestError) {
      throw new SynthesisError(err.message, { cause: err });
    }
    throw err;
  }

  const parsed = DraftScenarioResponse.safeParse(json);
  if (!parsed.success) {
    throw new SynthesisError(
      `AI synthesis did not match the scenario schema: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  return { ...parsed.data, amplifiedBy: SYNTHESIZER_ID };
};

/** Deterministic mock synthesizer for tests. */
export const mockSynthesizer: Synthesizer = async (sources, instruction) => {
  const base = sources[0]!.scenario;
  return {
    ...base,
    title: `합성: ${sources.map((s) => s.scenario.title).join(" × ")}`,
    logline: `${sources.length}개 시나리오의 요소를 결합한 새 이야기${instruction ? ` (${instruction})` : ""}`,
    amplifiedBy: "mock/synthesizer-v1",
  };
};
