import type { AssessmentCompileDiagnostic, AssessmentScenarioPackageV1 } from "./model";
import { AssessmentScenarioPackageV1Schema } from "./schema";

export interface AssessmentPackageValidationResult {
  valid: boolean;
  diagnostics: AssessmentCompileDiagnostic[];
}

export function validateAssessmentScenarioPackage(value: unknown): AssessmentPackageValidationResult {
  const parsed = AssessmentScenarioPackageV1Schema.safeParse(value);
  const diagnostics: AssessmentCompileDiagnostic[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      diagnostics.push({ severity: "error", code: "SCHEMA_VALIDATION_ERROR", path: issue.path.join(".") || "$", message: issue.message });
    }
    return { valid: false, diagnostics };
  }
  const packageValue: AssessmentScenarioPackageV1 = parsed.data;
  const competencyKeys = new Set(packageValue.competencies.map((competency) => competency.key));
  const packageKeys = new Set<string>();
  for (const [scenarioIndex, scenario] of packageValue.scenarios.entries()) {
    const path = `scenarios.${scenarioIndex}`;
    if (packageKeys.has(scenario.key)) diagnostics.push({ severity: "error", code: "DUPLICATE_SCENARIO_KEY", path: `${path}.key`, message: "Scenario keys must be unique." });
    packageKeys.add(scenario.key);
    for (const key of scenario.competencies) if (!competencyKeys.has(key)) diagnostics.push({ severity: "error", code: "UNKNOWN_COMPETENCY", path: `${path}.competencies`, message: `Unknown competency "${key}".` });
    const personaKeys = new Set(scenario.personas.map((persona) => persona.key));
    if (scenario.personas.filter((persona) => persona.isPrimary).length !== 1) diagnostics.push({ severity: "error", code: "INVALID_PRIMARY_PERSONA", path: `${path}.personas`, message: "Exactly one persona must be primary." });
    const flowKeys = new Set(scenario.flow.map((stage) => stage.key));
    if (scenario.recommendedFlow.some((key) => !flowKeys.has(key))) diagnostics.push({ severity: "error", code: "INVALID_FLOW", path: `${path}.recommendedFlow`, message: "recommendedFlow must reference flow stage keys." });
    for (const switchValue of scenario.personaSwitches) {
      if (!personaKeys.has(switchValue.fromPersonaKey) || !personaKeys.has(switchValue.toPersonaKey) || (switchValue.atFlowKey && !flowKeys.has(switchValue.atFlowKey))) diagnostics.push({ severity: "error", code: "INVALID_PERSONA_SWITCH", path: `${path}.personaSwitches`, message: "Persona switches must reference known personas and flow stages." });
    }
    const totalWeight = scenario.evaluation.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
    if (Math.abs(totalWeight - 1) > 1e-9 && Math.abs(totalWeight - 100) > 1e-9) diagnostics.push({ severity: "error", code: "INVALID_EVALUATION_WEIGHT", path: `${path}.evaluation.dimensions`, message: "Evaluation weights must total 1 or 100." });
    if (scenario.minValidTurns > scenario.targetTurns || scenario.targetTurns > scenario.termination.maxTurns) diagnostics.push({ severity: "error", code: "INVALID_TURN_LIMITS", path: `${path}.targetTurns`, message: "minValidTurns <= targetTurns <= termination.maxTurns is required." });
  }
  return { valid: diagnostics.length === 0, diagnostics };
}