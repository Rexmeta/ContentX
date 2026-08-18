/**
 * Workflow planner — interprets an output intent (choice or natural
 * language) and produces a recommended workflow from the template library.
 *
 * AI recommends; the user decides. The planner only proposes steps — the
 * user can add/remove/edit before execution.
 */
import { completeJSON, LLMRequestError } from "../ai/llmClient";
import { newId } from "../../shared/id";
import {
  OUTPUT_TYPES,
  type OutputIntent,
  type OutputType,
  type Workflow,
} from "./model";
import { buildTemplateSteps, OUTPUT_TYPE_LABELS } from "./templates";
import * as repo from "./repository";

/** Thrown when the AI cannot interpret the description (→ 502). */
export class IntentInterpretationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "IntentInterpretationError";
  }
}

const INTENT_SYSTEM_PROMPT = `당신은 콘텐츠 제작 도우미의 의도 해석기다. 사용자의 자연어 설명을 읽고, 어떤 결과물(Output)을 원하는지와 필요한 입력 요소를 추출한다.

가능한 outputType (정확히 이 값 중 하나):
- "movie": 영화 이야기/트리트먼트
- "novel": 소설
- "roleplay": 롤플레이 시나리오
- "product-reaction": 제품/서비스에 대한 가상 고객 반응 시뮬레이션
- "game": 게임 세계관/콘텐츠
- "advertisement": 광고 스토리/카피
- "remix": 기존 콘텐츠 여러 개를 조합
- "external-transform": 외부 콘텐츠를 가져와 재구성

extractedInputs에 담을 수 있는 키 (해당할 때만):
- "idea": 이야기 아이디어 요약 (movie/novel/roleplay/game)
- "product": 제품/서비스 설명 (product-reaction/advertisement)
- "audience": 타겟 고객 설명 (product-reaction/advertisement)
- "title": 사용자가 명시한 제목

반드시 아래 JSON으로만 응답하라:
{ "outputType": string, "extractedInputs": { ... } }`;

async function interpretDescription(
  description: string,
): Promise<{ outputType: OutputType; extractedInputs: Record<string, string> }> {
  let json: unknown;
  try {
    json = await completeJSON({
      system: INTENT_SYSTEM_PROMPT,
      user: `사용자 설명: ${description}`,
    });
  } catch (err) {
    if (err instanceof LLMRequestError) {
      throw new IntentInterpretationError(err.message, { cause: err });
    }
    throw err;
  }
  const obj = json as {
    outputType?: unknown;
    extractedInputs?: unknown;
  };
  const outputType = obj.outputType;
  if (
    typeof outputType !== "string" ||
    !(OUTPUT_TYPES as readonly string[]).includes(outputType)
  ) {
    throw new IntentInterpretationError(
      `AI가 결과물 유형을 판별하지 못했습니다 (받은 값: ${JSON.stringify(outputType)}).`,
    );
  }
  const extractedInputs: Record<string, string> = {};
  if (obj.extractedInputs && typeof obj.extractedInputs === "object") {
    for (const [k, v] of Object.entries(
      obj.extractedInputs as Record<string, unknown>,
    )) {
      if (typeof v === "string" && v.trim()) extractedInputs[k] = v.trim();
    }
  }
  return { outputType: outputType as OutputType, extractedInputs };
}

/**
 * Plan and persist a recommended workflow.
 * - outputType only → template with empty inputs
 * - description only → LLM interprets output type + inputs
 * - both → template for the chosen type, LLM-free (description becomes input)
 */
export async function planWorkflow(input: {
  outputType?: OutputType | undefined;
  description?: string | undefined;
}): Promise<Workflow> {
  const description = input.description?.trim() ?? "";
  let intent: OutputIntent;
  if (input.outputType) {
    intent = {
      outputType: input.outputType,
      description,
      extractedInputs: description
        ? input.outputType === "product-reaction" ||
          input.outputType === "advertisement"
          ? { product: description }
          : { idea: description }
        : {},
    };
  } else {
    const interpreted = await interpretDescription(description);
    intent = {
      outputType: interpreted.outputType,
      description,
      extractedInputs: interpreted.extractedInputs,
    };
  }

  const steps = buildTemplateSteps(intent);
  const label = OUTPUT_TYPE_LABELS[intent.outputType];
  const hint =
    intent.extractedInputs["title"] ??
    intent.extractedInputs["idea"] ??
    intent.extractedInputs["product"] ??
    "";
  const title = hint ? `${label}: ${hint.slice(0, 60)}` : `${label} 만들기`;

  const row = await repo.insertWorkflow({
    id: newId("workflow"),
    title,
    intent,
    steps,
    status: "draft",
  });
  return repo.toWorkflow(row);
}
