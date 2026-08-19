import { DraftScenarioResponse } from "@workspace/api-zod";
import {
  completeJSON,
  completeJSONStreaming,
  LLMRequestError,
  LLM_MODEL_ID,
} from "./llmClient";
import type {
  DramaticScenario,
  ScenarioAct,
  ScenarioCharacter,
} from "../scenario/model";

export const AMPLIFIER_ID = LLM_MODEL_ID;

/** Thrown when the LLM response cannot be parsed into a valid scenario. */
export class AmplificationError extends Error {}

const STREAMABLE_FIELDS = [
  "title",
  "logline",
  "synopsis",
  "theme",
  "stakes",
  "twist",
  "acts",
  "characters",
] as const;
type StreamableField = (typeof STREAMABLE_FIELDS)[number];
export type DraftPreview = Partial<
  Pick<
    DramaticScenario,
    "title" | "logline" | "synopsis" | "theme" | "stakes" | "twist" | "acts" | "characters"
  >
>;

function readJSONString(
  text: string,
  start: number,
): { value: string; end: number } | null {
  if (text[start] !== '"') return null;
  let escaped = false;
  for (let index = start + 1; index < text.length; index += 1) {
    const character = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      const raw = text.slice(start, index + 1);
      try {
        const value = JSON.parse(raw);
        return typeof value === "string" ? { value, end: index + 1 } : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function readCompleteJSONValue(text: string, start: number): {
  value: unknown;
  end: number;
} | null {
  let index = start;
  while (/\s/.test(text[index] ?? "")) index += 1;
  if (index >= text.length) return null;

  if (text[index] === '"') {
    const stringValue = readJSONString(text, index);
    if (!stringValue) return null;
    return { value: stringValue.value, end: stringValue.end };
  }

  if (text[index] === "[" || text[index] === "{") {
    const stack = [text[index] === "[" ? "]" : "}"];
    let escaped = false;
    let inString = false;
    for (let cursor = index + 1; cursor < text.length; cursor += 1) {
      const character = text[cursor];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === "[" || character === "{") {
        stack.push(character === "[" ? "]" : "}");
      } else if (character === "]" || character === "}") {
        if (stack.at(-1) !== character) return null;
        stack.pop();
        if (stack.length === 0) {
          const raw = text.slice(index, cursor + 1);
          try {
            return { value: JSON.parse(raw), end: cursor + 1 };
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  let end = index;
  while (end < text.length && !",}".includes(text[end]!)) end += 1;
  const raw = text.slice(index, end).trim();
  if (!raw) return null;
  try {
    return { value: JSON.parse(raw), end: index + raw.length };
  } catch {
    return null;
  }
}

function isScenarioAct(value: unknown): value is ScenarioAct {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.beats) &&
    candidate.beats.every((beat) => typeof beat === "string")
  );
}

function isScenarioCharacter(value: unknown): value is ScenarioCharacter {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.role === "string" &&
    typeof candidate.motivation === "string"
  );
}

function publicScenarioActs(value: unknown[]): ScenarioAct[] {
  return value.map((item) => {
    const act = item as ScenarioAct;
    return {
      name: act.name,
      summary: act.summary,
      beats: [...act.beats],
    };
  });
}

function publicScenarioCharacters(value: unknown[]): ScenarioCharacter[] {
  return value.map((item) => {
    const character = item as ScenarioCharacter;
    return {
      name: character.name,
      role: character.role,
      motivation: character.motivation,
    };
  });
}

/**
 * Extract only complete, public top-level fields from the JSON prefix. This
 * intentionally does not attempt to parse or expose arbitrary nested keys:
 * prompt/reasoning/provider metadata can never enter a draft checkpoint.
 */
export function extractDraftPreview(raw: string): DraftPreview {
  const preview: DraftPreview = {};
  let index = raw.indexOf("{");
  if (index < 0) return preview;
  index += 1;

  while (index < raw.length) {
    while (/\s|,/.test(raw[index] ?? "")) index += 1;
    if (raw[index] === "}") break;
    const key = readJSONString(raw, index);
    if (!key) break;
    index = key.end;
    while (/\s/.test(raw[index] ?? "")) index += 1;
    if (raw[index] !== ":") break;
    const parsed = readCompleteJSONValue(raw, index + 1);
    if (!parsed) break;
    index = parsed.end;

    if (!STREAMABLE_FIELDS.includes(key.value as StreamableField)) continue;
    const field = key.value as StreamableField;
    if (typeof parsed.value === "string" && field !== "acts" && field !== "characters") {
      preview[field] = parsed.value;
    } else if (
      field === "acts" &&
      Array.isArray(parsed.value) &&
      parsed.value.every(isScenarioAct)
    ) {
      preview.acts = publicScenarioActs(parsed.value);
    } else if (
      field === "characters" &&
      Array.isArray(parsed.value) &&
      parsed.value.every(isScenarioCharacter)
    ) {
      preview.characters = publicScenarioCharacters(parsed.value);
    }
  }
  return preview;
}

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
  onProgress?: (
    phase: "character-conflict" | "validating",
    label: string,
  ) => Promise<void>,
  onPartial?: (preview: DraftPreview) => Promise<void>,
): Promise<DramaticScenario> {
  let userPrompt = title?.trim()
    ? `아이디어: ${idea}\n(제목은 "${title.trim()}"을 유지하라)`
    : `아이디어: ${idea}`;
  if (benchmarkConstraints?.trim()) {
    userPrompt += `\n\n${benchmarkConstraints.trim()}`;
  }

  let json: unknown;
  try {
    const emitted = new Set<StreamableField>();
    json = onPartial
      ? await completeJSONStreaming(
          { system: SYSTEM_PROMPT, user: userPrompt },
          async (raw) => {
            const preview = extractDraftPreview(raw);
            const next: DraftPreview = {};
            for (const field of STREAMABLE_FIELDS) {
              if (emitted.has(field) || preview[field] === undefined) continue;
              emitted.add(field);
              if (field === "acts") next.acts = preview.acts;
              else if (field === "characters") next.characters = preview.characters;
              else if (field === "title") next.title = preview.title;
              else if (field === "logline") next.logline = preview.logline;
              else if (field === "synopsis") next.synopsis = preview.synopsis;
              else if (field === "theme") next.theme = preview.theme;
              else if (field === "stakes") next.stakes = preview.stakes;
              else next.twist = preview.twist;
            }
            if (Object.keys(next).length > 0) {
              if (title?.trim() && next.title !== undefined) {
                next.title = title.trim();
              }
              await onPartial(next);
            }
          },
        )
      : await completeJSON({ system: SYSTEM_PROMPT, user: userPrompt });
  } catch (err) {
    // Upstream failures (timeout, rate limit, unavailable, empty or non-JSON
    // output) are part of the amplification failure contract → surfaced as
    // 502, never a bare 500.
    if (err instanceof LLMRequestError) {
      throw new AmplificationError(err.message, { cause: err });
    }
    throw err;
  }

  await onProgress?.(
    "character-conflict",
    "인물의 목표와 갈등 구성을 확인하고 있어요.",
  );
  await onProgress?.(
    "validating",
    "생성된 이야기의 형식과 필수 항목을 검증하고 있어요.",
  );
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
