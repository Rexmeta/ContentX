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
 * The exact workflow.artifacts keys each executor action actually writes.
 * Derived from executor.ts; actions absent here write no artifact keys.
 *
 * `provide_input` is handled separately: it stores whichever string params
 * it receives, so we use the template step's `output` array after translating
 * display-only names to the actual executor artifact keys via
 * PROVIDE_INPUT_KEY_MAP.
 */
const EXECUTOR_ARTIFACT_KEYS: Readonly<Partial<Record<string, readonly string[]>>> = {
  draft_story: ["idea", "scenarioId"],
  build_world: ["contentId"],
  define_audience: ["populationId", "product"],
  generate_personas: ["samplingRunId"],
  prepare_actors: ["agentIds"],
  run_simulation: ["simulationId"],
  analyze_results: ["evaluationIds"],
};

/**
 * Template step `output` display keys → actual workflow.artifacts keys written
 * by `actProvideInput` in the executor.  Only keys that differ need an entry;
 * all others map to themselves.
 */
const PROVIDE_INPUT_KEY_MAP: Readonly<Record<string, string>> = {
  productBrief: "product", // template display key differs from executor artifact key
};

/**
 * Actions that produce no workflow-level artifact keys but represent
 * side-effect work already embedded in another artifact (e.g. classification
 * is stored on the scenario row, not in workflow.artifacts).  These steps are
 * safe to pre-complete by cascade when all their dependencies are done.
 */
const CASCADE_COMPLETE_ACTIONS = new Set(["classify_story", "validate_world"]);

/**
 * Given existing artifacts from a prior workflow, pre-mark template steps as
 * `complete` when the executor action's actual artifact keys are satisfied, then
 * cascade-complete transparent side-effect steps whose dependencies are done,
 * and finally promote `pending` steps whose deps are all covered to `ready`.
 *
 * Exported for unit testing.
 */
export function applyExistingArtifacts(
  steps: Workflow["steps"],
  existing: Record<string, string>,
): Workflow["steps"] {
  if (!Object.keys(existing).length) return steps;

  // Pass 1 — mark steps complete whose actual executor artifact keys are all
  // present in `existing`.
  let updated = steps.map((step): Workflow["steps"][number] => {
    const action = step.binding?.action;
    if (!action) return step;

    // provide_input stores whatever string params it receives; the template's
    // output[] names the expected artifact keys, translated through
    // PROVIDE_INPUT_KEY_MAP where the display name differs from the stored key.
    const coveredKeys: readonly string[] =
      action === "provide_input"
        ? step.output.map((k) => PROVIDE_INPUT_KEY_MAP[k] ?? k)
        : (EXECUTOR_ARTIFACT_KEYS[action] ?? []);

    if (coveredKeys.length > 0 && coveredKeys.every((k) => k in existing)) {
      const payload = Object.fromEntries(
        coveredKeys.map((k) => [k, existing[k]]),
      );
      return { ...step, status: "complete" as const, result: { payload } };
    }
    return step;
  });

  // Pass 2 — cascade-complete transparent side-effect steps (no artifact
  // output) whose every dependency is already done.  Iterate until stable
  // (handles linear chains in a single pass for typical templates).
  let changed = true;
  while (changed) {
    changed = false;
    const doneIds = new Set(
      updated
        .filter((s) => s.status === "complete" || s.status === "skipped")
        .map((s) => s.id),
    );
    updated = updated.map((step) => {
      if (step.status !== "pending") return step;
      const action = step.binding?.action ?? "";
      if (
        CASCADE_COMPLETE_ACTIONS.has(action) &&
        step.dependencies.every((d) => doneIds.has(d))
      ) {
        changed = true;
        return { ...step, status: "complete" as const, result: {} };
      }
      return step;
    });
  }

  // Pass 3 — promote pending → ready for steps whose deps are all satisfied.
  const doneIds = new Set(
    updated
      .filter((s) => s.status === "complete" || s.status === "skipped")
      .map((s) => s.id),
  );
  updated = updated.map((step) => {
    if (
      step.status === "pending" &&
      step.dependencies.every((d) => doneIds.has(d))
    ) {
      return { ...step, status: "ready" as const };
    }
    return step;
  });

  return updated;
}

/**
 * Derive an initial workflow status from pre-computed step statuses so that a
 * fully pre-completed workflow is not left in "draft".
 */
function deriveInitialStatus(steps: Workflow["steps"]): Workflow["status"] {
  const relevant = steps.filter((s) => s.status !== "skipped");
  if (!relevant.length) return "draft";
  if (relevant.every((s) => s.status === "complete")) return "complete";
  if (relevant.some((s) => s.status === "complete")) return "running";
  return "draft";
}

/**
 * Plan and persist a recommended workflow.
 * - outputType only → template with empty inputs
 * - description only → LLM interprets output type + inputs
 * - both → template for the chosen type, LLM-free (description becomes input)
 *
 * Pass `existingArtifacts` (e.g. from a prior workflow's artifacts map) to
 * skip steps that have already been produced and jump straight to the first
 * un-completed step.
 */
export async function planWorkflow(input: {
  outputType?: OutputType | undefined;
  description?: string | undefined;
  existingArtifacts?: Record<string, string> | undefined;
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

  const existing = input.existingArtifacts ?? {};
  const rawSteps = buildTemplateSteps(intent);
  const steps = applyExistingArtifacts(rawSteps, existing);
  const initialStatus = deriveInitialStatus(steps);

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
    artifacts: Object.keys(existing).length ? existing : undefined,
    status: initialStatus,
  });
  return repo.toWorkflow(row);
}
