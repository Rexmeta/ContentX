import type {
  AssessmentScenarioPackageV1,
  DiagnosticAuthoring,
  DiagnosticBriefing,
  DiagnosticCriterion,
  DiagnosticCue,
  DiagnosticMaterial,
  DiagnosticMaterialType,
  DiagnosticScenario,
} from "@workspace/api-client-react";

/** Stable IDs are minted exactly once, when an item is created. Edits never touch them. */
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export const BRIEFING_CHAR_RANGE = [250, 400] as const;
export const PREP_SECONDS_RANGE = [60, 120] as const;

export type LengthAdvice = { chars: number; charStatus: "low" | "ok" | "high"; seconds: number; secondStatus: "low" | "ok" | "high" };

export function briefingAdvice(briefing: DiagnosticBriefing): LengthAdvice {
  const chars = [briefing.roleAndAuthority, briefing.relationship, briefing.reason, briefing.goals].reduce((total, value) => total + value.trim().length, 0);
  const seconds = Number(briefing.preparationSeconds) || 0;
  const status = (value: number, [min, max]: readonly [number, number]) => (value < min ? "low" : value > max ? "high" : "ok");
  return { chars, charStatus: status(chars, BRIEFING_CHAR_RANGE), seconds, secondStatus: status(seconds, PREP_SECONDS_RANGE) };
}

export function participantMediaUrl(assessmentId: string, version: number, assetId: string, phase: "preparation" | "conversation") {
  return `/api/v1/assessments/${encodeURIComponent(assessmentId)}/versions/${version}/media/${encodeURIComponent(assetId)}?phase=${phase}`;
}

export const MATERIAL_TYPE_LABEL: Record<DiagnosticMaterialType, string> = { text: "텍스트", table: "표", image: "이미지", video: "영상" };
export const DISPLAY_AT_LABEL = { preparation: "준비 단계", conversation: "대화 단계", both: "두 단계 모두" } as const;

export function createMaterial(type: DiagnosticMaterialType): DiagnosticMaterial {
  return {
    id: newId("mat"),
    title: "",
    type,
    displayAt: "preparation",
    reopenDuringConversation: false,
    text: "",
    ...(type === "table" ? { table: { columns: ["항목", "내용"], rows: [["", ""]] } } : {}),
    ...(type === "image" ? { altText: "" } : {}),
    ...(type === "video" ? { transcript: "" } : {}),
  };
}

export function createCue(type: DiagnosticCue["type"], criterionIds: string[] = []): DiagnosticCue {
  return { id: newId("cue"), type, fact: "", criterionIds, ...(type === "discovery" ? { intent: "" } : { condition: "" }), tone: "", intensity: "중간", fallbackCondition: "" };
}

export function createCriterion(dimensionKey: string, competencyName: string): DiagnosticCriterion {
  return { id: newId("crit"), dimensionKey, competencyName, observableBehavior: "" };
}

type PackageScenario = AssessmentScenarioPackageV1["scenarios"][number];

export function initScenarioFromPackage(scenario: PackageScenario): DiagnosticScenario {
  const persona = scenario.personas.find((item) => item.isPrimary) ?? scenario.personas[0];
  return {
    scenarioKey: scenario.key,
    briefing: {
      roleAndAuthority: scenario.context.playerRole,
      relationship: persona ? `${persona.name} (${persona.role})` : "",
      // Legacy synopsis/objectives may contain hidden causes or model answers.
      // Do not automatically turn author-only narrative into participant content.
      reason: "",
      goals: "",
      preparationSeconds: 90,
    },
    materials: [],
    private: { hiddenCauses: "", internalIntent: "", modelAnswer: "", instructions: scenario.simulation.initialPrompt ?? "" },
    cues: [],
    criteria: scenario.evaluation.dimensions.map((dimension) => ({
      id: newId("crit"),
      dimensionKey: dimension.key,
      competencyName: dimension.label,
      observableBehavior: dimension.criteria.join("\n") || dimension.description || dimension.label,
    })),
  };
}

/** Legacy packages: every package scenario gets a diagnostic block seeded from its existing dimensions. */
export function initDiagnosticFromPackage(pkg: AssessmentScenarioPackageV1): DiagnosticAuthoring {
  return { schemaVersion: "contentx.diagnostic.v1", scenarios: pkg.scenarios.map(initScenarioFromPackage) };
}

/** Reopen: keep every authored ID, only add blocks for package scenarios that have none yet. */
export function reconcileWithPackage(diagnostic: DiagnosticAuthoring, pkg: AssessmentScenarioPackageV1): DiagnosticAuthoring {
  const known = new Set(diagnostic.scenarios.map((item) => item.scenarioKey));
  const missing = pkg.scenarios.filter((item) => !known.has(item.key)).map(initScenarioFromPackage);
  return missing.length ? { ...diagnostic, scenarios: [...diagnostic.scenarios, ...missing] } : diagnostic;
}

export type DiagnosticIssue = { path: string; message: string };

/** Blocking structural checks only. Length recommendations are advisory and never appear here. */
export function validateDiagnostic(diagnostic: DiagnosticAuthoring, pkg: AssessmentScenarioPackageV1): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const stableIds = new Set<string>();
  diagnostic.scenarios.forEach((scenario, s) => {
    const base = `시나리오 ${s + 1}`;
    for (const item of [...scenario.materials, ...scenario.cues, ...scenario.criteria]) {
      if (!/^[a-zA-Z0-9_-]+$/.test(item.id) || stableIds.has(item.id)) issues.push({ path: base, message: "자료·단서·평가 기준 ID는 패키지 전체에서 고유해야 합니다." });
      stableIds.add(item.id);
    }
    const packageScenario = pkg.scenarios.find((item) => item.key === scenario.scenarioKey);
    const dimensionKeys = new Set(packageScenario?.evaluation.dimensions.map((d) => d.key) ?? []);
    const b = scenario.briefing;
    if (!b.roleAndAuthority.trim()) issues.push({ path: `${base} · 브리핑`, message: "역할과 권한을 입력하세요." });
    if (!b.relationship.trim()) issues.push({ path: `${base} · 브리핑`, message: "상대와의 관계를 입력하세요." });
    if (!b.reason.trim()) issues.push({ path: `${base} · 브리핑`, message: "대화 이유를 입력하세요." });
    if (!b.goals.trim()) issues.push({ path: `${base} · 브리핑`, message: "목표를 입력하세요." });
    if (!Number.isInteger(b.preparationSeconds) || b.preparationSeconds < 1) issues.push({ path: `${base} · 브리핑`, message: "준비 시간은 1초 이상의 정수여야 합니다." });
    scenario.materials.forEach((m, i) => {
      const p = `${base} · 자료 ${i + 1}`;
      if (!m.title.trim()) issues.push({ path: p, message: "자료 제목을 입력하세요." });
      if (m.type === "text" && !m.text.trim()) issues.push({ path: p, message: "본문을 입력하세요." });
      if (m.type === "table") {
        if (!m.table?.columns.length || m.table.columns.some((c) => !c.trim())) issues.push({ path: p, message: "모든 열 제목을 입력하세요." });
        if (!m.table?.rows.length) issues.push({ path: p, message: "행을 1개 이상 추가하세요." });
        if (m.table?.rows.some((row) => row.length !== m.table!.columns.length)) issues.push({ path: p, message: "표의 모든 행과 열 개수가 같아야 합니다." });
      }
      if ((m.type === "image" || m.type === "video") && !m.assetId) issues.push({ path: p, message: "파일을 업로드하세요." });
      if (m.type === "image" && !m.altText?.trim()) issues.push({ path: p, message: "대체 텍스트를 입력하세요." });
      if (m.type === "video" && !m.transcript?.trim()) issues.push({ path: p, message: "영상 스크립트를 입력하세요." });
      if (m.type !== "text" && !m.text.trim()) issues.push({ path: p, message: "핵심 사실을 담은 텍스트 대체를 입력하세요." });
    });
    const criterionIds = new Set(scenario.criteria.map((c) => c.id));
    if (!scenario.criteria.length) issues.push({ path: `${base} · 평가`, message: "평가 기준을 1개 이상 두세요." });
    scenario.criteria.forEach((c, i) => {
      const p = `${base} · 평가 ${i + 1}`;
      if (!dimensionKeys.has(c.dimensionKey)) issues.push({ path: p, message: `패키지에 없는 평가 차원(${c.dimensionKey || "미선택"})입니다.` });
      if (!c.competencyName.trim()) issues.push({ path: p, message: "역량명을 입력하세요." });
      if (!c.observableBehavior.trim()) issues.push({ path: p, message: "관찰 가능한 행동을 입력하세요." });
    });
    scenario.cues.forEach((cue, i) => {
      const p = `${base} · 단서 ${i + 1}`;
      if (!cue.fact.trim()) issues.push({ path: p, message: "공개할 사실을 입력하세요." });
      if (cue.type === "discovery" && !cue.intent?.trim()) issues.push({ path: p, message: "발견 단서는 참여자 의도를 입력하세요." });
      if (cue.type === "common" && !cue.condition?.trim()) issues.push({ path: p, message: "공통 단서는 제공 조건을 입력하세요." });
      if (!cue.criterionIds.length) issues.push({ path: p, message: "연결할 평가 기준을 1개 이상 선택하세요." });
      if (cue.criterionIds.some((id) => !criterionIds.has(id))) issues.push({ path: p, message: "삭제된 평가 기준이 연결되어 있습니다." });
    });
  });
  return issues;
}

export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
