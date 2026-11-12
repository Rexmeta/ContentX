import { createHash } from "node:crypto";
import { z } from "zod";
import type { DiagnosticAuthoring, AssessmentParticipantPreview, AssessmentDiagnosticExport } from "@workspace/api-zod";
import type { AssessmentScenarioPackageV1 } from "./model";
import { canonicalizeJson } from "./hash";

const text = z.string().trim().min(1);
const id = text.regex(/^[a-zA-Z0-9_-]+$/, "IDs must use letters, numbers, hyphens or underscores");
export const diagnosticScenarioSchema = z.object({
  scenarioKey: text,
  briefing: z.object({
    roleAndAuthority: text, relationship: text, reason: text, goals: text,
    // Recommendations are NOT validation limits.
    preparationSeconds: z.number().int().positive(),
  }).strict(),
  materials: z.array(z.object({
    id, title: text, type: z.enum(["text", "table", "image", "video"]),
    displayAt: z.enum(["preparation", "conversation", "both"]), reopenDuringConversation: z.boolean(),
    text: z.string(),
    table: z.object({ columns: z.array(text).min(1), rows: z.array(z.array(z.string()).min(1)).min(1) }).strict().optional(),
    assetId: id.optional(), altText: z.string().optional(), transcript: z.string().optional(),
  }).strict()),
  private: z.object({ hiddenCauses: z.string(), internalIntent: z.string(), modelAnswer: z.string(), instructions: z.string() }).strict(),
  cues: z.array(z.object({
    id, type: z.enum(["discovery", "common"]), intent: z.string().optional(), condition: z.string().optional(),
    fact: text, criterionIds: z.array(id).min(1), tone: z.string().optional(), intensity: z.string().optional(),
    fallbackCondition: z.string().optional(),
  }).strict()),
  criteria: z.array(z.object({ id, dimensionKey: text, competencyName: text, observableBehavior: text }).strict()).min(1),
}).strict();
export const diagnosticSchema = z.object({
  schemaVersion: z.literal("contentx.diagnostic.v1"),
  scenarios: z.array(diagnosticScenarioSchema).min(1),
}).strict().superRefine((value, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  const seen = new Set<string>();
  const allIds = new Set<string>();
  value.scenarios.forEach((scenario, s) => {
    if (seen.has(scenario.scenarioKey)) issue(["scenarios", s, "scenarioKey"], "Duplicate scenario key");
    seen.add(scenario.scenarioKey);
    for (const group of ["materials", "cues", "criteria"] as const) scenario[group].forEach((item, i) => {
      if (allIds.has(item.id)) issue(["scenarios", s, group, i, "id"], "Duplicate stable ID");
      allIds.add(item.id);
    });
    const criteria = new Set(scenario.criteria.map((c) => c.id));
    scenario.cues.forEach((cue, i) => {
      if (cue.type === "discovery" && !cue.intent?.trim()) issue(["scenarios", s, "cues", i, "intent"], "Semantic question intent is required; literal sentence matching is not supported");
      if (cue.type === "common" && !cue.condition?.trim()) issue(["scenarios", s, "cues", i, "condition"], "Common cue disclosure condition is required");
      if (new Set(cue.criterionIds).size !== cue.criterionIds.length || cue.criterionIds.some((c) => !criteria.has(c))) issue(["scenarios", s, "cues", i, "criterionIds"], "Unknown or duplicate criterion reference");
    });
    scenario.materials.forEach((material, i) => {
      const path = ["scenarios", s, "materials", i];
      if (material.type === "table" && (!material.table || material.table.rows.some((r) => r.length !== material.table!.columns.length))) issue(path, "Accessible table with equal column counts is required");
      if (material.type !== "table" && !material.text.trim()) issue(path, "Accessible text containing essential facts is required");
      if (["image", "video"].includes(material.type) && !material.assetId) issue(path, "A private uploaded asset is required");
      if (material.type === "image" && !material.altText?.trim()) issue(path, "Image alternative text is required");
      if (material.type === "video" && !material.transcript?.trim()) issue(path, "Video captions or transcript is required");
    });
  });
});

/** Validation runs against raw input, before generated Zod can strip unknown private fields. */
export function parseDiagnostic(value: unknown, pkg: AssessmentScenarioPackageV1): DiagnosticAuthoring {
  const result = diagnosticSchema.parse(value);
  const expected = new Map(pkg.scenarios.map((s) => [s.key, s]));
  if (result.scenarios.length !== expected.size) throw new Error("Diagnostic source must cover every package scenario exactly once");
  for (const scenario of result.scenarios) {
    const target = expected.get(scenario.scenarioKey);
    if (!target) throw new Error(`Unknown scenario key: ${scenario.scenarioKey}`);
    const dimensions = new Set(target.evaluation.dimensions.map((d) => d.key));
    if (scenario.criteria.some((c) => !dimensions.has(c.dimensionKey))) throw new Error("Diagnostic criterion must reference an existing evaluation dimension");
  }
  return result;
}

export const diagnosticHash = (value: unknown) => createHash("sha256").update(canonicalizeJson(value)).digest("hex");

export function isMaterialVisible(material: DiagnosticAuthoring["scenarios"][number]["materials"][number], phase: "preparation" | "conversation") {
  return phase === "preparation"
    ? material.displayAt !== "conversation"
    : material.displayAt === "conversation" || material.reopenDuringConversation;
}

/** Explicit nested allowlist: never spread source objects into public responses. */
export function projectParticipant(source: DiagnosticAuthoring, phase: "preparation" | "conversation"): AssessmentParticipantPreview {
  return {
    schemaVersion: "contentx.participant.v1", phase,
    scenarios: source.scenarios.map((s) => ({
      scenarioKey: s.scenarioKey,
      briefing: {
        roleAndAuthority: s.briefing.roleAndAuthority, relationship: s.briefing.relationship,
        reason: s.briefing.reason, goals: s.briefing.goals, preparationSeconds: s.briefing.preparationSeconds,
      },
      materials: s.materials.filter((m) => isMaterialVisible(m, phase)).map((m) => ({
        id: m.id, title: m.title, type: m.type, displayAt: m.displayAt,
        reopenDuringConversation: m.reopenDuringConversation, text: m.text,
        ...(m.table ? { table: { columns: [...m.table.columns], rows: m.table.rows.map((r) => [...r]) } } : {}),
        ...(m.assetId ? { assetId: m.assetId } : {}), ...(m.altText ? { altText: m.altText } : {}),
        ...(m.transcript ? { transcript: m.transcript } : {}),
      })),
    })),
  };
}

export const diagnosticRuntimeRules = [
  "ContentX authors content and rules; the receiving engine presents, records and evaluates. This export is NOT evidence of execution.",
  "Discovery cues use semantic question intent, never exact-sentence matching. Reveal facts only when the intent is satisfied.",
  "Present common cues at condition; if unreachable, use fallbackCondition when supplied. Unsupported conditions must be rejected with explicit diagnostics, not silently dropped.",
  "Record actual cue delivery with scenarioKey, cueId, timestamp, turn, trigger and fallbackUsed; join observations to criterionIds.",
  "Common cue not actually presented => no_observation_opportunity for its linked reaction criteria; do not score as failure.",
  "Discovery cue not revealed AND sufficient questioning opportunity recorded AND no relevant question => not_observed for cause exploration.",
  "No sufficient opportunity evidence => opportunity_unknown, not not_observed. Never invent delivery or completed evaluations.",
  "Follow material displayAt and reopenDuringConversation. Media must pass the same phase authorization as the participant projection.",
];
export function exportDiagnostic(pkg: AssessmentScenarioPackageV1, source: DiagnosticAuthoring): AssessmentDiagnosticExport {
  return {
    schemaVersion: "contentx.diagnostic-export.v1", packageKey: pkg.packageKey, version: Number(pkg.version),
    diagnostic: parseDiagnostic(source, pkg), rules: diagnosticRuntimeRules,
    receiverStatus: "mapping_required_not_runtime_verified", runtimeResults: null,
  };
}
