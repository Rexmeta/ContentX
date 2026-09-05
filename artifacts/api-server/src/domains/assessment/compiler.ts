import type {
  AssessmentCompilationInput,
  AssessmentCompileDiagnostic,
  AssessmentCompileResult,
  AssessmentPackageScenarioV1,
  AssessmentScenarioConfiguration,
  AssessmentScenarioPackageV1,
} from "./model";
import { withAssessmentPackageHash } from "./hash";
import { validateAssessmentScenarioPackage } from "./validator";

const diagnostic = (
  diagnostics: AssessmentCompileDiagnostic[],
  code: string,
  path: string,
  message: string,
): void => {
  diagnostics.push({ severity: "error", code, path, message });
};

function nonBlank(value: string | undefined, diagnostics: AssessmentCompileDiagnostic[], code: string, path: string): string {
  if (value?.trim()) return value.trim();
  diagnostic(diagnostics, code, path, "A non-empty value is required and cannot be inferred safely.");
  return "";
}

/** Stable keys make character/act references portable without altering DramaticScenario. */
export function assessmentElementKey(value: string, index: number): string {
  const normalized = value.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${normalized || "item"}-${index + 1}`;
}

function compileScenario(
  source: AssessmentCompilationInput["scenarios"][number],
  competencyKeys: Set<string>,
  diagnostics: AssessmentCompileDiagnostic[],
  index: number,
): AssessmentPackageScenarioV1 {
  const { dramaticScenario: dramatic, configuration: config } = source;
  const path = `scenarios[${index}]`;
  const title = nonBlank(dramatic.title, diagnostics, "MISSING_TITLE", `${path}.dramaticScenario.title`);
  const synopsis = nonBlank(dramatic.synopsis, diagnostics, "MISSING_SYNOPSIS", `${path}.dramaticScenario.synopsis`);
  const stakes = nonBlank(dramatic.stakes, diagnostics, "MISSING_STAKES", `${path}.dramaticScenario.stakes`);
  const personas = dramatic.characters.map((character, characterIndex) => ({
    key: assessmentElementKey(character.name, characterIndex),
    name: nonBlank(character.name, diagnostics, "MISSING_PERSONA_NAME", `${path}.dramaticScenario.characters[${characterIndex}].name`),
    role: nonBlank(character.role, diagnostics, "MISSING_PERSONA_ROLE", `${path}.dramaticScenario.characters[${characterIndex}].role`),
    background: nonBlank(character.motivation, diagnostics, "MISSING_PERSONA_BACKGROUND", `${path}.dramaticScenario.characters[${characterIndex}].motivation`),
    traits: [],
    isPrimary: false,
  }));
  if (!personas.length) diagnostic(diagnostics, "MISSING_PRIMARY_PERSONA", `${path}.dramaticScenario.characters`, "At least one character is required.");
  const primary = config.primaryPersonaKey;
  const primaryIndex = personas.findIndex((persona) => persona.key === primary);
  if (!primary || primaryIndex < 0) {
    diagnostic(diagnostics, "MISSING_PRIMARY_PERSONA", `${path}.configuration.primaryPersonaKey`, "primaryPersonaKey must reference a compiled character key.");
  } else {
    personas[primaryIndex]!.isPrimary = true;
  }

  const flow = dramatic.acts.map((act, actIndex) => ({
    key: assessmentElementKey(act.name, actIndex),
    title: nonBlank(act.name, diagnostics, "INVALID_FLOW", `${path}.dramaticScenario.acts[${actIndex}].name`),
    description: nonBlank(act.summary, diagnostics, "INVALID_FLOW", `${path}.dramaticScenario.acts[${actIndex}].summary`),
    beats: act.beats.filter((beat) => beat.trim().length > 0),
  }));
  if (!flow.length) diagnostic(diagnostics, "INVALID_FLOW", `${path}.dramaticScenario.acts`, "At least one act is required to build a flow.");

  for (const key of config.competencyKeys) {
    if (!competencyKeys.has(key)) diagnostic(diagnostics, "MISSING_COMPETENCY", `${path}.configuration.competencyKeys`, `Unknown competency "${key}".`);
  }
  if (!config.competencyKeys.length) diagnostic(diagnostics, "MISSING_COMPETENCY", `${path}.configuration.competencyKeys`, "At least one competency is required.");
  if (!config.objectives?.length) diagnostic(diagnostics, "MISSING_OBJECTIVES", `${path}.configuration.objectives`, "Objectives must be explicitly provided.");
  if (!config.successCriteria?.length) diagnostic(diagnostics, "MISSING_SUCCESS_CRITERIA", `${path}.configuration.successCriteria`, "Success criteria must be explicitly provided.");
  if (!config.evaluation) diagnostic(diagnostics, "MISSING_EVALUATION", `${path}.configuration.evaluation`, "Evaluation is required.");
  if (!config.termination) diagnostic(diagnostics, "MISSING_TERMINATION", `${path}.configuration.termination`, "Termination configuration is required.");
  if (!config.simulation) diagnostic(diagnostics, "MISSING_SIMULATION", `${path}.configuration.simulation`, "Simulation configuration is required.");
  if (!config.analytics) diagnostic(diagnostics, "MISSING_ANALYTICS", `${path}.configuration.analytics`, "Analytics configuration is required.");

  return {
    key: nonBlank(config.scenarioKey, diagnostics, "MISSING_SCENARIO_KEY", `${path}.configuration.scenarioKey`),
    title, description: synopsis, locale: nonBlank(config.locale, diagnostics, "MISSING_LOCALE", `${path}.configuration.locale`),
    categoryKey: nonBlank(config.categoryKey, diagnostics, "MISSING_CATEGORY", `${path}.configuration.categoryKey`),
    competencies: config.competencyKeys, difficulty: config.difficulty, estimatedTime: config.estimatedTime,
    objectiveType: nonBlank(config.objectiveType, diagnostics, "MISSING_OBJECTIVE_TYPE", `${path}.configuration.objectiveType`),
    context: {
      situation: synopsis,
      timeline: nonBlank(config.timeline, diagnostics, "MISSING_TIMELINE", `${path}.configuration.timeline`),
      stakes,
      playerRole: nonBlank(config.playerRole, diagnostics, "MISSING_PLAYER_ROLE", `${path}.configuration.playerRole`),
    },
    objectives: config.objectives ?? [],
    successCriteria: config.successCriteria ?? [],
    personas, recommendedFlow: flow.map((stage) => stage.key), flow,
    personaSwitches: config.personaSwitches ?? [], personaSwitchMode: config.personaSwitchMode,
    constraints: config.constraints ?? [], difficultyProfile: config.difficultyProfile,
    evaluation: config.evaluation ?? { dimensions: [] },
    termination: config.termination ?? { conditions: [], maxTurns: 0 },
    simulation: config.simulation ?? { mode: "" },
    analytics: config.analytics ?? { eventTypes: [], trackPersonaSwitches: false },
    targetDurationMinutes: config.targetDurationMinutes, targetTurns: config.targetTurns, minValidTurns: config.minValidTurns,
  };
}

/**
 * Explicit, deterministic projection: synopsis/stakes map to context, acts to flow,
 * and characters to personas. Runtime/evaluation values only come from configuration.
 */
export function compileAssessmentScenarioPackage(input: AssessmentCompilationInput): AssessmentCompileResult {
  const diagnostics: AssessmentCompileDiagnostic[] = [];
  const scenarios = [...input.scenarios]
    .sort((a, b) =>
      a.configuration.scenarioKey < b.configuration.scenarioKey
        ? -1
        : a.configuration.scenarioKey > b.configuration.scenarioKey
          ? 1
          : 0,
    )
    .map((scenario, index) => compileScenario(scenario, new Set(input.competencies.map((item) => item.key)), diagnostics, index));
  const packageValue: AssessmentScenarioPackageV1 = {
    schemaVersion: "1.0", packageKey: nonBlank(input.packageKey, diagnostics, "MISSING_PACKAGE_KEY", "packageKey"),
    version: nonBlank(input.version, diagnostics, "MISSING_VERSION", "version"), publishedAt: input.publishedAt,
    metadata: {
      title: nonBlank(input.metadata.title, diagnostics, "MISSING_PACKAGE_TITLE", "metadata.title"),
      description: nonBlank(input.metadata.description, diagnostics, "MISSING_PACKAGE_DESCRIPTION", "metadata.description"),
      locale: nonBlank(input.metadata.locale, diagnostics, "MISSING_LOCALE", "metadata.locale"), tags: input.metadata.tags,
    },
    competencies: input.competencies, scenarios,
    provenance: { source: "ContentX", sourcePackageId: nonBlank(input.sourcePackageId, diagnostics, "MISSING_SOURCE_PACKAGE_ID", "sourcePackageId"), author: nonBlank(input.author, diagnostics, "MISSING_AUTHOR", "author"), contentHash: "" },
  };
  const validation = validateAssessmentScenarioPackage(withAssessmentPackageHash(packageValue));
  diagnostics.push(...validation.diagnostics);
  return diagnostics.some((item) => item.severity === "error")
    ? { diagnostics }
    : { package: withAssessmentPackageHash(packageValue), diagnostics };
}

export type AssessmentScenarioCompilerInput = AssessmentCompilationInput;