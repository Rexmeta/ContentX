import type { DramaticScenario } from "../scenario/model";

/** A diagnostic that can safely be returned to an author; it contains no inferred content. */
export interface AssessmentCompileDiagnostic {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
}

export interface AssessmentCompetencyInput {
  key: string;
  name: string;
  description?: string;
}

export interface AssessmentEvaluationDimensionInput {
  key: string;
  label: string;
  weight: number;
  criteria: string[];
  description?: string;
}

export interface AssessmentScenarioConfiguration {
  /** Stable ContentX-owned key. It is also the output scenario key. */
  scenarioKey: string;
  locale: string;
  categoryKey: string;
  competencyKeys: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime: number;
  objectiveType: string;
  /** Runtime timing is not present in DramaticScenario and must be supplied. */
  timeline?: string;
  playerRole?: string;
  objectives?: string[];
  successCriteria?: string[];
  primaryPersonaKey?: string;
  personaSwitchMode: "manual" | "automatic" | "disabled";
  personaSwitches?: Array<{
    fromPersonaKey: string;
    toPersonaKey: string;
    atFlowKey?: string;
    reason?: string;
  }>;
  constraints?: string[];
  difficultyProfile: { level: string; rationale?: string };
  evaluation?: { dimensions: AssessmentEvaluationDimensionInput[]; passingScore?: number };
  termination?: { conditions: string[]; maxTurns: number };
  simulation?: { mode: string; initialPrompt?: string; rules?: string[] };
  analytics?: { eventTypes: string[]; trackPersonaSwitches: boolean };
  targetDurationMinutes: number;
  targetTurns: number;
  minValidTurns: number;
}

export interface AssessmentCompilationInput {
  packageKey: string;
  version: string;
  publishedAt: string;
  sourcePackageId: string;
  author: string;
  metadata: { title?: string; description?: string; locale: string; tags: string[] };
  competencies: AssessmentCompetencyInput[];
  scenarios: Array<{
    dramaticScenario: DramaticScenario;
    configuration: AssessmentScenarioConfiguration;
  }>;
}

export interface AssessmentCompileResult<TPackage = AssessmentScenarioPackageV1> {
  package?: TPackage;
  diagnostics: AssessmentCompileDiagnostic[];
}

// Kept structural rather than importing Zod here, so model consumers have no validation dependency.
export interface AssessmentScenarioPackageV1 {
  schemaVersion: "1.0";
  packageKey: string;
  version: string;
  publishedAt: string;
  metadata: { title: string; description: string; locale: string; tags: string[] };
  competencies: AssessmentCompetencyInput[];
  scenarios: AssessmentPackageScenarioV1[];
  provenance: {
    source: "ContentX";
    sourcePackageId: string;
    author: string;
    contentHash: string;
  };
}

export interface AssessmentPackageScenarioV1 {
  key: string;
  title: string;
  description: string;
  locale: string;
  categoryKey: string;
  competencies: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTime: number;
  objectiveType: string;
  context: { situation: string; timeline: string; stakes: string; playerRole: string };
  objectives: string[];
  successCriteria: string[];
  personas: Array<{ key: string; name: string; role: string; background: string; traits: string[]; isPrimary: boolean }>;
  recommendedFlow: string[];
  flow: Array<{ key: string; title: string; description: string; beats: string[] }>;
  personaSwitches: Array<{ fromPersonaKey: string; toPersonaKey: string; atFlowKey?: string; reason?: string }>;
  personaSwitchMode: "manual" | "automatic" | "disabled";
  constraints: string[];
  difficultyProfile: { level: string; rationale?: string };
  evaluation: { dimensions: AssessmentEvaluationDimensionInput[]; passingScore?: number };
  termination: { conditions: string[]; maxTurns: number };
  simulation: { mode: string; initialPrompt?: string; rules?: string[] };
  analytics: { eventTypes: string[]; trackPersonaSwitches: boolean };
  targetDurationMinutes: number;
  targetTurns: number;
  minValidTurns: number;
}