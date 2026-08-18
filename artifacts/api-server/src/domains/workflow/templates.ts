/**
 * Default workflow templates per output type — the encoded form of
 * docs/ux/output-workflow-map.md. The planner clones a template, prefills
 * step params from the interpreted intent, and persists the result.
 *
 * Step titles use user vocabulary (P0 terminology map), never internal terms.
 */
import { newId } from "../../shared/id";
import {
  SUPPORTED_OUTPUT_TYPES,
  type OutputIntent,
  type OutputType,
  type WorkflowStep,
} from "./model";

type StepSeed = Omit<WorkflowStep, "id" | "status" | "dependencies"> & {
  /** Local keys of prior seeds this step depends on. */
  dependsOn?: string[];
  key: string;
  /** Override the default first=ready/rest=pending status. */
  status?: WorkflowStep["status"];
};

function materialize(seeds: StepSeed[]): WorkflowStep[] {
  const idByKey = new Map<string, string>();
  for (const seed of seeds) idByKey.set(seed.key, newId("step"));
  return seeds.map((seed, i) => {
    const { key, dependsOn, status, ...rest } = seed;
    return {
      ...rest,
      id: idByKey.get(key)!,
      status: status ?? (i === 0 ? "ready" : "pending"),
      dependencies: (dependsOn ?? []).map((k) => {
        const id = idByKey.get(k);
        if (!id) throw new Error(`Template bug: unknown dependency "${k}"`);
        return id;
      }),
    };
  });
}

function storySteps(intent: OutputIntent, projection: "novel" | "roleplay"): StepSeed[] {
  const idea = intent.extractedInputs["idea"] ?? intent.description;
  return [
    {
      key: "idea",
      type: "input",
      title: "아이디어를 들려주세요",
      description: "만들고 싶은 이야기를 한두 문장으로 설명해주세요.",
      importance: "required",
      input: [],
      output: ["idea"],
      binding: {
        action: "provide_input",
        api: "— (폼 입력)",
        params: idea ? { idea } : {},
      },
    },
    {
      key: "draft",
      type: "generate",
      title: "이야기 초안 만들기",
      description: "아이디어를 구체적인 이야기 초안으로 발전시킵니다.",
      importance: "required",
      input: ["idea"],
      output: ["scenarioId"],
      dependsOn: ["idea"],
      binding: { action: "draft_story", api: "POST /v1/scenarios/draft" },
    },
    {
      key: "classify",
      type: "analyze",
      title: "장르·분위기 정리",
      description: "이야기의 장르와 분위기를 자동으로 정리합니다.",
      importance: "recommended",
      input: ["scenarioId"],
      output: ["classification"],
      dependsOn: ["draft"],
      binding: { action: "classify_story", api: "POST /v1/scenarios/:id/classify" },
    },
    {
      key: "world",
      type: "compose",
      title: "이야기 구조 만들기",
      description: "등장인물·장소·사건을 연결한 이야기 구조를 만듭니다.",
      importance: "required",
      input: ["scenarioId"],
      output: ["contentId"],
      dependsOn: ["draft"],
      binding: { action: "build_world", api: "POST /v1/content" },
    },
    {
      key: "validate",
      type: "validate",
      title: "이야기 점검하기",
      description: "구조에 빠진 부분이 없는지 점검합니다.",
      importance: "optional",
      input: ["contentId"],
      output: ["validationReport"],
      dependsOn: ["world"],
      binding: { action: "validate_world", api: "POST /v1/content/:id/validate" },
    },
    projection === "novel"
      ? {
          key: "project",
          type: "project",
          title: "소설로 만들기",
          description: "완성된 이야기 구조를 소설 형태로 바꿉니다.",
          importance: "required",
          input: ["contentId"],
          output: ["novelProjection"],
          dependsOn: ["world"],
          binding: { action: "project_novel", api: "POST /v1/projections (novel)" },
        }
      : {
          key: "project",
          type: "project",
          title: "롤플레이로 바꾸기",
          description: "이야기를 롤플레이 시나리오로 바꿉니다.",
          importance: "required",
          input: ["contentId"],
          output: ["roleplayProjection"],
          dependsOn: ["world"],
          binding: { action: "project_roleplay", api: "POST /v1/projections (roleplayx)" },
        },
  ];
}

function productReactionSteps(intent: OutputIntent): StepSeed[] {
  const product = intent.extractedInputs["product"] ?? intent.description;
  const audience = intent.extractedInputs["audience"] ?? "";
  return [
    {
      key: "product",
      type: "input",
      title: "제품을 설명해주세요",
      description: "어떤 제품/서비스의 반응이 궁금한가요?",
      importance: "required",
      input: [],
      output: ["productBrief"],
      binding: {
        action: "provide_input",
        api: "— (폼 입력)",
        params: {
          ...(product ? { product } : {}),
          ...(audience ? { audience } : {}),
        },
      },
    },
    {
      key: "audience",
      type: "generate",
      title: "타겟 고객 정의하기",
      description: "제품에 맞는 가상 고객 집단의 특성을 정의합니다.",
      importance: "required",
      input: ["productBrief"],
      output: ["populationId"],
      dependsOn: ["product"],
      binding: { action: "define_audience", api: "POST /v1/populations" },
    },
    {
      key: "personas",
      type: "generate",
      title: "가상 고객 만들기",
      description: "정의한 특성에 따라 가상 고객을 뽑아냅니다.",
      importance: "required",
      input: ["populationId"],
      output: ["samplingRunId", "characterIds"],
      dependsOn: ["audience"],
      binding: {
        action: "generate_personas",
        api: "POST /v1/sampling",
        params: { sampleSize: 4 },
      },
    },
    {
      key: "actors",
      type: "transform",
      title: "시뮬레이션 준비하기",
      description: "가상 고객이 대화에 참여할 수 있게 자동으로 준비합니다.",
      importance: "required",
      input: ["characterIds"],
      output: ["agentIds"],
      dependsOn: ["personas"],
      binding: { action: "prepare_actors", api: "POST /v1/snapshots → /v1/agents" },
    },
    {
      key: "simulate",
      type: "simulate",
      title: "반응 시뮬레이션 돌리기",
      description: "가상 고객들이 제품에 대해 이야기하게 합니다.",
      importance: "required",
      input: ["agentIds", "productBrief"],
      output: ["simulationId"],
      dependsOn: ["actors"],
      binding: {
        action: "run_simulation",
        api: "POST /v1/simulations",
        params: { maxTurns: 12 },
      },
    },
    {
      key: "analyze",
      type: "analyze",
      title: "결과 분석 보기",
      description: "시뮬레이션 결과를 분석해 반응 리포트를 만듭니다.",
      importance: "required",
      input: ["simulationId"],
      output: ["evaluationIds"],
      dependsOn: ["simulate"],
      binding: { action: "analyze_results", api: "POST /v1/evaluations" },
    },
  ];
}

/**
 * Plan-only placeholder for output types not yet fully supported (준비 중).
 * The notice step is intentionally NOT runnable (no binding, pending) so a
 * coming-soon workflow can never execute or appear completed.
 */
function comingSoonSteps(_intent: OutputIntent, note: string): StepSeed[] {
  return [
    {
      key: "notice",
      type: "input",
      title: "준비 중인 결과물이에요",
      description: note,
      importance: "optional",
      status: "pending",
      input: [],
      output: [],
      binding: null,
    },
  ];
}

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  movie: "영화 이야기",
  novel: "소설",
  roleplay: "롤플레이",
  "product-reaction": "제품 반응 시뮬레이션",
  game: "게임 콘텐츠",
  advertisement: "광고 콘텐츠",
  remix: "콘텐츠 조합",
  "external-transform": "외부 콘텐츠 재구성",
};

export function isSupported(outputType: OutputType): boolean {
  return SUPPORTED_OUTPUT_TYPES.includes(outputType);
}

export function buildTemplateSteps(intent: OutputIntent): WorkflowStep[] {
  switch (intent.outputType) {
    case "novel":
      return materialize(storySteps(intent, "novel"));
    case "roleplay":
      return materialize(storySteps(intent, "roleplay"));
    case "product-reaction":
      return materialize(productReactionSteps(intent));
    default:
      return materialize(
        comingSoonSteps(
          intent,
          `"${OUTPUT_TYPE_LABELS[intent.outputType]}"는 아직 준비 중입니다. 지금은 소설·롤플레이·제품 반응 시뮬레이션을 끝까지 만들 수 있어요.`,
        ),
      );
  }
}
