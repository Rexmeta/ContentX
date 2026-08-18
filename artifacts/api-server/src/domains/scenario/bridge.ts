import { AnalyzeBridgeResponse, DraftScenarioResponse } from "@workspace/api-zod";
import { completeJSON, LLMRequestError, LLM_MODEL_ID } from "../ai/llmClient";
import type { DramaticScenario } from "./model";

/**
 * Bridge Remix — connects two existing stories with a new canonical scenario.
 * Story A (source) ends somewhere; Story B (target) begins somewhere else.
 * The analyzer maps the gap between those states; the synthesizer writes the
 * scenario that carries the reader across it.
 */

export const BRIDGE_SYNTHESIZER_ID = LLM_MODEL_ID;

/** Thrown when LLM bridge analysis/generation fails (provider error or invalid output). */
export class BridgeError extends Error {}

export const BRIDGE_GAP_DIMENSIONS = [
  "timeline",
  "location",
  "characters",
  "goals",
  "conflict",
  "relationships",
  "knowledge",
  "threads",
  "contradictions",
] as const;

export type BridgeGapDimension = (typeof BRIDGE_GAP_DIMENSIONS)[number];
export type BridgeGapStatus = "compatible" | "transition" | "conflict";

export interface BridgeGapItem {
  dimension: BridgeGapDimension;
  status: BridgeGapStatus;
  explanation: string;
  requirement?: string | null;
}

export interface BridgeAnalysis {
  summary: string;
  gaps: BridgeGapItem[];
  requirements: string[];
}

/**
 * Enforces the analysis output contract: exactly one gap item for each of the
 * nine dimensions, no duplicates. LLM output is nondeterministic, so this is
 * validated on every analysis result before it reaches the client.
 * Throws BridgeError (surfaced as 502 by the route).
 */
export function validateBridgeAnalysis(analysis: BridgeAnalysis): BridgeAnalysis {
  const seen = new Map<string, number>();
  for (const gap of analysis.gaps) {
    seen.set(gap.dimension, (seen.get(gap.dimension) ?? 0) + 1);
  }
  const missing = BRIDGE_GAP_DIMENSIONS.filter((d) => !seen.has(d));
  const duplicated = BRIDGE_GAP_DIMENSIONS.filter((d) => (seen.get(d) ?? 0) > 1);
  if (missing.length > 0 || duplicated.length > 0) {
    const parts = [
      ...(missing.length > 0 ? [`missing dimensions: ${missing.join(", ")}`] : []),
      ...(duplicated.length > 0
        ? [`duplicated dimensions: ${duplicated.join(", ")}`]
        : []),
    ];
    throw new BridgeError(
      `AI bridge analysis must cover each of the ${BRIDGE_GAP_DIMENSIONS.length} gap dimensions exactly once (${parts.join("; ")})`,
    );
  }
  return analysis;
}

export type BridgeAnalyzer = (
  source: DramaticScenario,
  target: DramaticScenario,
) => Promise<BridgeAnalysis>;

export type BridgeSynthesizer = (
  source: DramaticScenario,
  target: DramaticScenario,
  requirements: string[],
  instruction?: string,
) => Promise<DramaticScenario>;

function describeScenario(label: string, s: DramaticScenario): string {
  return [
    `[${label}: "${s.title}"]`,
    `- 로그라인: ${s.logline}`,
    `- 시놉시스: ${s.synopsis}`,
    `- 주제: ${s.theme} / 걸린 것: ${s.stakes}`,
    `- 반전: ${s.twist}`,
    `- 사건 구조:\n${s.acts
      .map(
        (a) =>
          `  · ${a.name}: ${a.summary}\n${a.beats.map((b) => `    - ${b}`).join("\n")}`,
      )
      .join("\n")}`,
    `- 인물:\n${s.characters
      .map((c) => `  · ${c.name} (${c.role}) — ${c.motivation}`)
      .join("\n")}`,
  ].join("\n");
}

const ANALYZE_SYSTEM_PROMPT = `당신은 이야기 연결 분석 전문가다. 이야기 A의 결말 상태와 이야기 B의 시작 상태 사이의 간극을 분석한다.

다음 9개 차원을 각각 평가하라:
- timeline: 시간 흐름의 연속성
- location: 장소·무대의 이동
- characters: 인물의 연속성 (등장·퇴장·변화)
- goals: 목표의 전환
- conflict: 갈등의 종결과 새 갈등의 발생
- relationships: 인물 관계의 변화
- knowledge: 인물·세계가 아는 것/상태의 전환
- threads: A에서 해소되지 않은 실마리
- contradictions: 두 이야기 사이의 명백한 모순

각 차원의 status:
- "compatible": 그대로 이어져도 자연스럽다
- "transition": 다리 이야기에서 전환이 필요하다
- "conflict": 명백히 충돌하므로 다리에서 해소해야 한다

transition/conflict 차원에는 requirement(다리 이야기가 충족해야 할 전환 요구사항, 한 문장)를 제시하라.
requirements 배열에는 다리 생성에 쓸 요구사항 초안을 모아라 (각 500자 이내).
입력 언어로 작성하라 (한국어 재료 → 한국어 분석).

반드시 아래 JSON 스키마로만 응답하라 (JSON만):
{
  "summary": string,  // 왜 다리가 필요한지(또는 필요 없는지) 설명
  "gaps": [ { "dimension": string, "status": "compatible"|"transition"|"conflict", "explanation": string, "requirement": string|null } ],
  "requirements": [string, ...]
}`;

/** LLM bridge analyzer: maps the gap between A's ending and B's beginning. */
export const analyzeBridgeWithLLM: BridgeAnalyzer = async (source, target) => {
  let json: unknown;
  try {
    json = await completeJSON({
      system: ANALYZE_SYSTEM_PROMPT,
      user: [
        describeScenario("이야기 A (출발)", source),
        describeScenario("이야기 B (도착)", target),
        "이야기 A의 결말 상태와 이야기 B의 시작 상태 사이의 간극을 분석하라.",
      ].join("\n\n"),
    });
  } catch (err) {
    if (err instanceof LLMRequestError) {
      throw new BridgeError(err.message, { cause: err });
    }
    throw err;
  }

  const parsed = AnalyzeBridgeResponse.safeParse(json);
  if (!parsed.success) {
    throw new BridgeError(
      `AI bridge analysis did not match the schema: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return validateBridgeAnalysis(parsed.data as BridgeAnalysis);
};

const GENERATE_SYSTEM_PROMPT = `당신은 다리 이야기(Bridge Story) 작가다. 이야기 A의 결말에서 출발해 이야기 B의 시작에 자연스럽게 도착하는, 독립적으로도 완결된 새 시나리오를 쓴다.

절대 규칙:
1. 1막은 A의 결말 상태에서 필연적으로 이어져야 하고, 3막의 끝은 B의 시작 상태를 정확히 준비해야 한다.
2. 주어진 전환 요구사항을 모두 서사 안에서 충족하라 — 설명이 아니라 사건과 인물의 선택으로.
3. 다리 이야기는 그 자체로 완결된 드라마여야 한다: 고유한 갈등, 걸린 것, 반전을 가져라.
4. 현실성: 실제 있을 법한 직업·조직·이해관계. 우연이 아닌 인물의 선택이 사건을 만든다.
5. 입력 언어로 작성하라 (한국어 재료 → 한국어 시나리오).

반드시 아래 JSON 스키마로만 응답하라 (JSON만):
{
  "title": string, "logline": string, "synopsis": string, "theme": string,
  "stakes": string, "twist": string,
  "acts": [ { "name": string, "summary": string, "beats": [string, ...] } ],  // 정확히 3개, 막당 비트 3-5개
  "characters": [ { "name": string, "role": string, "motivation": string } ]  // 3-5명
}`;

/** LLM bridge synthesizer: writes the scenario that connects A → B. */
export const bridgeWithLLM: BridgeSynthesizer = async (
  source,
  target,
  requirements,
  instruction,
) => {
  const parts = [
    describeScenario("이야기 A (출발 — 이 결말에서 시작)", source),
    describeScenario("이야기 B (도착 — 이 시작으로 연결)", target),
  ];
  if (requirements.length > 0) {
    parts.push(
      `[전환 요구사항]\n${requirements.map((r) => `- ${r}`).join("\n")}`,
    );
  }
  if (instruction?.trim()) {
    parts.push(`[추가 지시]\n${instruction.trim()}`);
  }
  parts.push("A와 B를 잇는 다리 이야기를 생성하라.");

  let json: unknown;
  try {
    json = await completeJSON({
      system: GENERATE_SYSTEM_PROMPT,
      user: parts.join("\n\n"),
    });
  } catch (err) {
    if (err instanceof LLMRequestError) {
      throw new BridgeError(err.message, { cause: err });
    }
    throw err;
  }

  const parsed = DraftScenarioResponse.safeParse(json);
  if (!parsed.success) {
    throw new BridgeError(
      `AI bridge generation did not match the scenario schema: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return { ...parsed.data, amplifiedBy: BRIDGE_SYNTHESIZER_ID };
};

/** Deterministic mock analyzer for tests. */
export const mockBridgeAnalyzer: BridgeAnalyzer = async (source, target) => ({
  summary: `"${source.title}"의 결말과 "${target.title}"의 시작 사이에는 전환이 필요하다.`,
  gaps: BRIDGE_GAP_DIMENSIONS.map((dimension, i) => ({
    dimension,
    status: i % 3 === 0 ? "transition" : i % 3 === 1 ? "compatible" : "conflict",
    explanation: `${dimension} 차원 분석 (mock)`,
    requirement: i % 3 === 1 ? null : `${dimension} 전환 요구사항 (mock)`,
  })),
  requirements: ["시간 경과를 명시하라 (mock)", "주인공의 이동 동기를 만들어라 (mock)"],
});

/** Deterministic mock bridge synthesizer for tests. */
export const mockBridgeSynthesizer: BridgeSynthesizer = async (
  source,
  target,
  requirements,
  instruction,
) => ({
  ...source,
  title: `다리: ${source.title} → ${target.title}`,
  logline: `${source.title}의 결말과 ${target.title}의 시작을 잇는 이야기 (요구사항 ${requirements.length}개${instruction ? `, ${instruction}` : ""})`,
  amplifiedBy: "mock/bridge-v1",
});
