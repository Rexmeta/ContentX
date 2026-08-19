/**
 * Workflow step executor — binds workflow steps to the EXISTING engine.
 * Each action calls the same domain services the public API routes use;
 * nothing here reimplements engine logic. Step status, results, and
 * produced artifact ids are recorded on the workflow so execution can be
 * resumed after leaving the page.
 */
import { orchestrator } from "../ai/orchestrator";
import { AmplificationError, amplifyIdeaWithLLM } from "../ai/llmAmplifier";
import * as scenarioRepo from "../scenario/repository";
import {
  classifyScenario,
} from "../scenario/classificationService";
import {
  buildBenchmarkReport,
  BenchmarkError,
  type BenchmarkReport,
} from "../scenario/benchmarkService";
import { ClassificationError } from "../scenario/classifier";
import * as contentService from "../content/service";
import * as populationService from "../population/service";
import * as dimensionService from "../population/dimensionService";
import { DuplicateDimensionError } from "../population/dimensionService";
import * as snapshotService from "../character/snapshotService";
import * as agentService from "../agent/service";
import * as simulationService from "../simulation/service";
import * as evaluationService from "../evaluation/service";
import * as projectionService from "../projection/service";
import type { DramaticScenario } from "../scenario/model";
import type { Classification } from "../scenario/taxonomy";
import type { Lineage } from "../../shared/lineage";
import type { Distribution } from "../population/model";
import { newId } from "../../shared/id";
import {
  InvalidWorkflowError,
  StepDependencyError,
  StepExecutionError,
  StepNotFoundError,
  type StepAction,
  type Workflow,
  type WorkflowStep,
} from "./model";
import * as repo from "./repository";

type Params = Record<string, unknown>;

function str(params: Params, key: string): string | undefined {
  const v = params[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function num(params: Params, key: string): number | undefined {
  const v = params[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

interface ActionOutcome {
  artifacts?: Record<string, string>;
  result?: Record<string, unknown>;
}

interface ActionContext {
  workflow: Workflow;
  step: WorkflowStep;
  params: Params;
}

function requireArtifact(wf: Workflow, key: string, hint: string): string {
  const v = wf.artifacts[key];
  if (!v) {
    throw new InvalidWorkflowError(
      `이 단계에 필요한 "${key}"가 아직 없습니다. ${hint}`,
    );
  }
  return v;
}

async function actProvideInput(ctx: ActionContext): Promise<ActionOutcome> {
  const artifacts: Record<string, string> = {};
  const stored: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx.params)) {
    if (typeof v === "string" && v.trim()) {
      artifacts[k] = v.trim();
      stored[k] = v.trim();
    }
  }
  // An input step that produces artifacts must actually receive content —
  // completing it empty would let downstream steps run without their inputs.
  if (ctx.step.output.length > 0 && Object.keys(artifacts).length === 0) {
    throw new InvalidWorkflowError(
      "입력 내용이 비어 있습니다. 내용을 채운 뒤 실행해주세요.",
    );
  }
  return { artifacts, result: stored };
}

async function actBenchmarkReference(
  ctx: ActionContext,
): Promise<ActionOutcome> {
  // scenarioIds param: array or comma-separated string
  const raw = ctx.params["scenarioIds"] ?? ctx.params["benchmarkScenarioIds"];
  let scenarioIds: string[];
  if (Array.isArray(raw)) {
    scenarioIds = raw.filter((v): v is string => typeof v === "string" && !!v.trim());
  } else if (typeof raw === "string" && raw.trim()) {
    scenarioIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    throw new InvalidWorkflowError(
      "참고 시나리오 ID 목록을 scenarioIds 파라미터로 지정해주세요. " +
        "예: ['id1','id2'] 또는 'id1,id2'",
    );
  }

  let report: BenchmarkReport;
  try {
    report = await buildBenchmarkReport(scenarioIds);
  } catch (err) {
    if (err instanceof BenchmarkError) {
      throw new InvalidWorkflowError(err.message);
    }
    throw err;
  }

  return {
    artifacts: {
      benchmarkConstraints: report.draftConstraints,
    },
    result: {
      scenarioCount: report.scenarioCount,
      classifiedCount: report.classifiedCount,
      profile: report.profile,
      warning: report.warning ?? null,
    },
  };
}

async function actDraftStory(ctx: ActionContext): Promise<ActionOutcome> {
  const idea =
    str(ctx.params, "idea") ??
    ctx.workflow.artifacts["idea"] ??
    ctx.workflow.intent.extractedInputs["idea"] ??
    ctx.workflow.intent.description;
  if (!idea?.trim()) {
    throw new InvalidWorkflowError(
      "아이디어가 비어 있습니다. 먼저 아이디어 입력 단계를 완료해주세요.",
    );
  }
  const title = str(ctx.params, "title");

  // Inject benchmark constraints when a benchmark_reference step ran before this.
  const benchmarkConstraints =
    str(ctx.params, "benchmarkConstraints") ??
    (ctx.workflow.artifacts["benchmarkConstraints"] || undefined);

  let scenario: DramaticScenario;
  try {
    scenario = await amplifyIdeaWithLLM(idea, title, benchmarkConstraints);
  } catch (err) {
    if (err instanceof AmplificationError) {
      throw new StepExecutionError(err.message, { cause: err });
    }
    throw err;
  }
  const row = await scenarioRepo.insertScenario({
    id: newId("scenario"),
    title: scenario.title,
    idea,
    scenario,
    classification: null,
    lineage: null,
  });
  return {
    artifacts: { idea, scenarioId: row.id },
    result: {
      scenarioId: row.id,
      title: scenario.title,
      logline: scenario.logline,
      synopsis: scenario.synopsis,
    },
  };
}

async function actClassifyStory(ctx: ActionContext): Promise<ActionOutcome> {
  const scenarioId = requireArtifact(
    ctx.workflow,
    "scenarioId",
    "이야기 초안 단계를 먼저 완료해주세요.",
  );
  const row = await scenarioRepo.getScenario(scenarioId);
  if (!row) throw new InvalidWorkflowError("저장된 이야기를 찾을 수 없습니다.");
  let classification: Classification;
  try {
    classification = await classifyScenario(row.scenario as DramaticScenario);
  } catch (err) {
    if (err instanceof ClassificationError) {
      throw new StepExecutionError(err.message, { cause: err });
    }
    throw err;
  }
  await scenarioRepo.updateScenario(scenarioId, { classification });
  return { result: { classification } };
}

async function actBuildWorld(ctx: ActionContext): Promise<ActionOutcome> {
  const scenarioId = requireArtifact(
    ctx.workflow,
    "scenarioId",
    "이야기 초안 단계를 먼저 완료해주세요.",
  );
  const row = await scenarioRepo.getScenario(scenarioId);
  if (!row) throw new InvalidWorkflowError("저장된 이야기를 찾을 수 없습니다.");
  const scenario = row.scenario as DramaticScenario;
  const payload = orchestrator.generateFromScenario(row.idea, scenario);
  const lineage = row.lineage as Lineage | null;
  if (lineage && payload.provenance) {
    payload.provenance = { ...payload.provenance, lineage };
  }
  const graph = await contentService.commitGraph(
    row.idea,
    payload,
    undefined,
    scenario.title,
  );
  return {
    artifacts: { contentId: graph.id },
    result: {
      contentId: graph.id,
      title: graph.title,
      entityCount: graph.entities.length,
      relationshipCount: graph.relationships.length,
    },
  };
}

async function actValidateWorld(ctx: ActionContext): Promise<ActionOutcome> {
  const contentId = requireArtifact(
    ctx.workflow,
    "contentId",
    "이야기 구조 단계를 먼저 완료해주세요.",
  );
  const report = await contentService.validateContent(contentId);
  if (!report) {
    throw new InvalidWorkflowError("이야기 구조를 찾을 수 없습니다.");
  }
  return { result: { report } };
}

async function actProject(
  ctx: ActionContext,
  target: "novel" | "roleplayx",
): Promise<ActionOutcome> {
  const contentId = requireArtifact(
    ctx.workflow,
    "contentId",
    "이야기 구조 단계를 먼저 완료해주세요.",
  );
  try {
    const result = await projectionService.project({ target, contentId });
    return {
      result: {
        target: result.target,
        payload: result.payload,
        provenance: result.provenance,
      },
    };
  } catch (err) {
    if (
      err instanceof projectionService.InvalidProjectionError ||
      err instanceof projectionService.ContentNotFoundError
    ) {
      throw new InvalidWorkflowError(err.message);
    }
    if (err instanceof projectionService.ProjectionExecutionError) {
      throw new StepExecutionError(err.message, { cause: err });
    }
    throw err;
  }
}

/** Default consumer-research dimensions for the audience template. */
const AUDIENCE_DIMENSIONS: {
  name: string;
  category: string;
  dataType: string;
  allowedValues: string[];
  description: string;
  weights: Record<string, number>;
}[] = [
  {
    name: "cx_age_group",
    category: "demographic",
    dataType: "enum",
    allowedValues: ["20대", "30대", "40대", "50대 이상"],
    description: "연령대",
    weights: { "20대": 0.3, "30대": 0.35, "40대": 0.2, "50대 이상": 0.15 },
  },
  {
    name: "cx_tech_affinity",
    category: "technology",
    dataType: "enum",
    allowedValues: ["낮음", "보통", "높음"],
    description: "기술 친숙도",
    weights: { 낮음: 0.2, 보통: 0.45, 높음: 0.35 },
  },
  {
    name: "cx_price_sensitivity",
    category: "preference",
    dataType: "enum",
    allowedValues: ["낮음", "보통", "높음"],
    description: "가격 민감도",
    weights: { 낮음: 0.25, 보통: 0.45, 높음: 0.3 },
  },
  {
    name: "cx_adopter_type",
    category: "behavioral",
    dataType: "enum",
    allowedValues: ["얼리어답터", "실용주의자", "보수적"],
    description: "수용 성향",
    weights: { 얼리어답터: 0.25, 실용주의자: 0.5, 보수적: 0.25 },
  },
];

async function actDefineAudience(ctx: ActionContext): Promise<ActionOutcome> {
  const product =
    str(ctx.params, "product") ??
    ctx.workflow.artifacts["product"] ??
    ctx.workflow.intent.extractedInputs["product"] ??
    ctx.workflow.intent.description;
  if (!product?.trim()) {
    throw new InvalidWorkflowError(
      "제품 설명이 비어 있습니다. 먼저 제품 설명 단계를 완료해주세요.",
    );
  }
  const audience =
    str(ctx.params, "audience") ?? ctx.workflow.artifacts["audience"] ?? "";

  for (const dim of AUDIENCE_DIMENSIONS) {
    try {
      await dimensionService.createDimension({
        name: dim.name,
        category: dim.category,
        dataType: dim.dataType,
        allowedValues: dim.allowedValues,
        description: dim.description,
      });
    } catch (err) {
      if (!(err instanceof DuplicateDimensionError)) throw err;
    }
  }

  const distributions: Record<string, Distribution> = {};
  for (const dim of AUDIENCE_DIMENSIONS) {
    distributions[dim.name] = {
      type: "categorical",
      weights: dim.weights,
    } as Distribution;
  }

  const population = await populationService.createPopulation({
    name: `타겟 고객: ${product.slice(0, 50)}`,
    domain: audience ? `consumer-research: ${audience.slice(0, 80)}` : "consumer-research",
    dimensions: AUDIENCE_DIMENSIONS.map((d) => d.name),
    distributions,
  });
  return {
    artifacts: { populationId: population.id, product },
    result: {
      populationId: population.id,
      name: population.name,
      dimensions: population.dimensions,
    },
  };
}

async function actGeneratePersonas(ctx: ActionContext): Promise<ActionOutcome> {
  const populationId = requireArtifact(
    ctx.workflow,
    "populationId",
    "타겟 고객 정의 단계를 먼저 완료해주세요.",
  );
  const sampleSize = num(ctx.params, "sampleSize") ?? 4;
  const seed = num(ctx.params, "seed") ?? Math.floor(Math.random() * 1_000_000);
  const { run, characterIds } = await populationService.samplePopulation({
    populationId,
    sampleSize,
    strategy: "weighted",
    seed,
  });
  return {
    artifacts: { samplingRunId: run.id },
    result: { samplingRunId: run.id, seed, sampleSize, characterIds },
  };
}

async function actPrepareActors(ctx: ActionContext): Promise<ActionOutcome> {
  const samplingRunId = requireArtifact(
    ctx.workflow,
    "samplingRunId",
    "가상 고객 만들기 단계를 먼저 완료해주세요.",
  );
  const run = await populationService.getSamplingRun(samplingRunId);
  if (!run) throw new InvalidWorkflowError("가상 고객 샘플을 찾을 수 없습니다.");
  const product = ctx.workflow.artifacts["product"] ?? "제품";
  const agentIds: string[] = [];
  for (const characterId of run.characterIds) {
    const snapshot = await snapshotService.createSnapshot({ characterId });
    const agent = await agentService.createAgent({
      snapshotId: snapshot.id,
      goals: [
        {
          objective: `"${product.slice(0, 60)}"에 대한 솔직한 반응과 의견 제시`,
          priority: 1,
          urgency: 0.7,
          successCriteria: ["자신의 특성과 관점에서 제품을 평가한다"],
        },
      ],
      constraints: [
        { type: "soft", description: "자신의 성향(가격 민감도·기술 친숙도)과 일관되게 반응한다" },
      ],
    });
    agentIds.push(agent.id);
  }
  return {
    artifacts: { agentIds: agentIds.join(",") },
    result: { agentIds, count: agentIds.length },
  };
}

async function actRunSimulation(ctx: ActionContext): Promise<ActionOutcome> {
  const agentIdsRaw = requireArtifact(
    ctx.workflow,
    "agentIds",
    "시뮬레이션 준비 단계를 먼저 완료해주세요.",
  );
  const agentIds = agentIdsRaw.split(",").filter(Boolean);
  const product = ctx.workflow.artifacts["product"] ?? ctx.workflow.intent.description;
  const topic =
    str(ctx.params, "topic") ?? `신제품에 대한 반응: ${product.slice(0, 120)}`;
  const maxTurns = num(ctx.params, "maxTurns") ?? 12;
  const seed = num(ctx.params, "seed") ?? Math.floor(Math.random() * 1_000_000);
  const policy = str(ctx.params, "policy") ?? "heuristic";
  const simulation = await simulationService.runSimulation({
    name: ctx.workflow.title.slice(0, 80),
    topic,
    agentIds,
    seed,
    maxTurns,
    policy,
  });
  return {
    artifacts: { simulationId: simulation.id },
    result: {
      simulationId: simulation.id,
      status: simulation.status,
      turnsExecuted: simulation.turnsExecuted,
      outcome: simulation.outcome,
    },
  };
}

async function actAnalyzeResults(ctx: ActionContext): Promise<ActionOutcome> {
  const simulationId = requireArtifact(
    ctx.workflow,
    "simulationId",
    "반응 시뮬레이션 단계를 먼저 완료해주세요.",
  );
  const evaluations = await evaluationService.evaluateSimulation({
    simulationId,
  });
  return {
    artifacts: { evaluationIds: evaluations.map((e) => e.id).join(",") },
    result: {
      evaluationIds: evaluations.map((e) => e.id),
      evaluations: evaluations.map((e) => ({
        id: e.id,
        kind: e.kind,
        subjectType: e.subjectType,
        subjectId: e.subjectId,
        scores: e.scores,
      })),
    },
  };
}

const ACTIONS: Record<
  StepAction,
  (ctx: ActionContext) => Promise<ActionOutcome>
> = {
  provide_input: actProvideInput,
  benchmark_reference: actBenchmarkReference,
  draft_story: actDraftStory,
  classify_story: actClassifyStory,
  build_world: actBuildWorld,
  validate_world: actValidateWorld,
  project_novel: (ctx) => actProject(ctx, "novel"),
  project_roleplay: (ctx) => actProject(ctx, "roleplayx"),
  define_audience: actDefineAudience,
  generate_personas: actGeneratePersonas,
  prepare_actors: actPrepareActors,
  run_simulation: actRunSimulation,
  analyze_results: actAnalyzeResults,
};

function isDone(step: WorkflowStep): boolean {
  return step.status === "complete" || step.status === "skipped";
}

/** Recompute pending/ready flags after a status change. */
function refreshReadiness(steps: WorkflowStep[]): void {
  const byId = new Map(steps.map((s) => [s.id, s]));
  for (const step of steps) {
    if (step.status !== "pending" && step.status !== "ready") continue;
    // A dependency that no longer resolves blocks the step (fail closed);
    // write-path validation should make this unreachable.
    const ready = step.dependencies.every((depId) => {
      const dep = byId.get(depId);
      return dep ? isDone(dep) : false;
    });
    step.status = ready ? "ready" : "pending";
  }
}

function overallStatus(steps: WorkflowStep[]): Workflow["status"] {
  const relevant = steps.filter((s) => s.status !== "skipped");
  if (relevant.some((s) => s.status === "failed")) return "failed";
  if (relevant.length > 0 && relevant.every((s) => s.status === "complete")) {
    return "complete";
  }
  if (steps.some((s) => s.status === "complete" || s.status === "running")) {
    return "running";
  }
  return "draft";
}

/**
 * Execute one step. The workflow row is re-read and re-written around the
 * action; a failed action records status=failed + error on the step instead
 * of leaving the workflow in a phantom running state.
 */
export async function runStep(input: {
  workflowId: string;
  stepId: string;
  params?: Record<string, unknown> | undefined;
}): Promise<{ workflow: Workflow; failed: boolean }> {
  const row = await repo.getWorkflow(input.workflowId);
  if (!row) return Promise.reject(new StepNotFoundError(input.workflowId));
  const workflow = repo.toWorkflow(row);
  const step = workflow.steps.find((s) => s.id === input.stepId);
  if (!step) throw new StepNotFoundError(input.stepId);
  if (!step.binding) {
    throw new InvalidWorkflowError("이 단계는 자동 실행을 지원하지 않습니다.");
  }
  const action = ACTIONS[step.binding.action];
  if (!action) {
    throw new InvalidWorkflowError(
      `알 수 없는 실행 동작입니다: ${step.binding.action}`,
    );
  }
  const unmet = step.dependencies.filter((depId) => {
    const dep = workflow.steps.find((s) => s.id === depId);
    return !dep || !isDone(dep);
  });
  if (unmet.length > 0) {
    const titles = unmet
      .map((id) => workflow.steps.find((s) => s.id === id)?.title ?? id)
      .join(", ");
    throw new StepDependencyError(`먼저 완료해야 하는 단계가 있어요: ${titles}`);
  }

  const params: Params = {
    ...(step.binding.params ?? {}),
    ...(input.params ?? {}),
  };

  step.status = "running";
  step.error = null;
  await repo.updateWorkflow(workflow.id, {
    steps: workflow.steps,
    status: "running",
  });

  let failed = false;
  try {
    const outcome = await action({ workflow, step, params });
    step.status = "complete";
    step.result = outcome.result ?? null;
    // Persist the (possibly edited) inputs onto the binding so re-opening
    // the workflow shows what was actually used.
    step.binding = { ...step.binding, params };
    if (outcome.artifacts) {
      workflow.artifacts = { ...workflow.artifacts, ...outcome.artifacts };
    }
  } catch (err) {
    failed = true;
    step.status = "failed";
    step.error = err instanceof Error ? err.message : String(err);
    refreshReadiness(workflow.steps);
    await repo.updateWorkflow(workflow.id, {
      steps: workflow.steps,
      status: overallStatus(workflow.steps),
    });
    throw err;
  }

  refreshReadiness(workflow.steps);
  const updated = await repo.updateWorkflow(workflow.id, {
    steps: workflow.steps,
    artifacts: workflow.artifacts,
    status: overallStatus(workflow.steps),
  });
  return { workflow: repo.toWorkflow(updated!), failed };
}
