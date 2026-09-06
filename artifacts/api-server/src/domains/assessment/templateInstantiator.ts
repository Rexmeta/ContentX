import type { AssessmentCompilationInput, AssessmentScenarioConfiguration } from "./model";
import type { DramaticScenario } from "../scenario/model";
import { assessmentElementKey } from "./compiler";
import { getScenarioTemplate, type AssessmentScenarioTemplate } from "./scenarioTemplateCatalog";

export interface InstantiateTemplateOptions {
  templateId: string;
  companyContext: string;
  participantRole?: string;
  situation?: string;
  counterpartName?: string;
  counterpartRole?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  packageId?: string;
  packageKey?: string;
  title?: string;
  description?: string;
  author?: string;
  passingScore?: number;
}

export interface InstantiatedAssessment {
  template: AssessmentScenarioTemplate;
  compilationInput: AssessmentCompilationInput;
  dramaticScenario: DramaticScenario;
  configuration: AssessmentScenarioConfiguration;
  title: string;
  description: string;
}

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function generateStableKey(value: string, prefix: string): string {
  const ascii = slug(value);
  if (ascii) return `${prefix}-${ascii}`;
  let hash = 2166136261;
  for (const char of value.trim()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function instantiateAssessmentTemplate(options: InstantiateTemplateOptions): InstantiatedAssessment {
  const template = getScenarioTemplate(options.templateId);
  if (!template) {
    throw new Error(`Assessment template not found: "${options.templateId}".`);
  }

  const companyContext = options.companyContext?.trim();
  if (!companyContext) {
    throw new Error("companyContext is required to instantiate an assessment template.");
  }

  const participantRole = options.participantRole?.trim() || template.targetRole;
  const title = options.title?.trim() || `${template.title} [${companyContext}]`;
  const customSituation = options.situation?.trim();

  // Combine template synopsis with specific company context and situation
  const situationDescription = customSituation
    ? `[조직 및 배경: ${companyContext}]\n${customSituation}\n\n[표준 시나리오 맥락]\n${template.dramatic.synopsis}`
    : `[조직 및 배경: ${companyContext}]\n${template.dramatic.synopsis}`;

  const description = options.description?.trim() || `${template.description} (조직: ${companyContext}, 응시자: ${participantRole})`;

  // Counterpart persona customization
  const baseCharacter = template.dramatic.characters[0]!;
  const counterpartName = options.counterpartName?.trim() || baseCharacter.name;
  const counterpartRole = options.counterpartRole?.trim() || baseCharacter.role;

  const characters = [
    {
      name: counterpartName,
      role: counterpartRole,
      motivation: `${baseCharacter.motivation} (소속: ${companyContext})`,
    },
  ];

  const primaryPersonaKey = assessmentElementKey(characters[0].name, 0);

  const dramaticScenario: DramaticScenario = {
    title,
    logline: template.dramatic.logline,
    synopsis: situationDescription,
    theme: template.dramatic.theme,
    stakes: template.dramatic.stakes,
    twist: template.dramatic.twist,
    acts: template.dramatic.acts.map((act) => ({
      name: act.name,
      summary: act.summary,
      beats: [...act.beats],
    })),
    characters,
    sourceIdea: `Template: ${template.id} (${template.title})`,
  };

  const packageKey =
    options.packageKey?.trim() ||
    generateStableKey(`${template.id}-${companyContext}`, "pkg");
  const packageId = options.packageId?.trim() || packageKey;
  const scenarioKey = generateStableKey(`${template.id}-scenario`, "scen");
  const difficulty = options.difficulty || template.difficulty;
  const passingScore = options.passingScore ?? template.evaluation.defaultPassingScore;

  const configuration: AssessmentScenarioConfiguration = {
    scenarioKey,
    locale: "ko-KR",
    categoryKey: template.category,
    competencyKeys: template.competencies.map((c) => c.key),
    difficulty,
    estimatedTime: template.estimatedTime,
    objectiveType: "roleplay",
    timeline: `면담 진행 중 (약 ${template.estimatedTime}분 소요)`,
    playerRole: participantRole,
    objectives: [...template.learningObjectives],
    successCriteria: template.evaluation.dimensions.flatMap((dim) => dim.criteria),
    primaryPersonaKey,
    personaSwitchMode: "disabled",
    personaSwitches: [],
    constraints: [
      "인신공격이나 비하 발언 없이 상호 존중하는 대화를 유지합니다.",
      "주어진 면담 시간과 목표에 집중하여 현실적인 대안을 도출합니다.",
    ],
    difficultyProfile: {
      level: difficulty,
      rationale: `${template.categoryLabel} ${difficulty} 수준 평가 프로필`,
    },
    evaluation: {
      dimensions: template.evaluation.dimensions.map((dim) => ({
        key: dim.key,
        label: dim.label,
        weight: dim.weight,
        criteria: [...dim.criteria],
        description: dim.description,
      })),
      passingScore,
    },
    termination: {
      conditions: [...template.termination.conditions],
      maxTurns: template.termination.maxTurns,
    },
    simulation: {
      mode: template.simulation.mode,
      initialPrompt: `[상황 설정: ${companyContext}]\n${template.simulation.defaultInitialPrompt}\n상대방(응시자)은 '${participantRole}' 자격으로 당신과 면담을 진행하고 있습니다.`,
      rules: [...template.simulation.rules],
    },
    analytics: {
      eventTypes: ["turn", "message"],
      trackPersonaSwitches: false,
    },
    targetDurationMinutes: template.estimatedTime,
    targetTurns: template.termination.targetTurns,
    minValidTurns: template.termination.minValidTurns,
  };

  const compilationInput: AssessmentCompilationInput = {
    packageKey,
    version: "1",
    publishedAt: new Date().toISOString(),
    sourcePackageId: packageId,
    author: options.author?.trim() || "ContentX HR Studio",
    metadata: {
      title,
      description,
      locale: "ko-KR",
      tags: ["contentx", "assessment-center", template.category, template.id],
    },
    competencies: template.competencies.map((c) => ({
      key: c.key,
      name: c.name,
      description: c.description,
    })),
    scenarios: [
      {
        dramaticScenario,
        configuration,
      },
    ],
  };

  return {
    template,
    compilationInput,
    dramaticScenario,
    configuration,
    title,
    description,
  };
}

