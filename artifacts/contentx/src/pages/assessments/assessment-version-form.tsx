import { useState } from "react";
import { useListScenarios, type AssessmentPackageVersionCreateInput, type ScenarioRecord } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export type AssessmentVersionFormValues = { packageId: string; title: string; description: string; competency: string; dimensionLabel: string; dimensionKey: string; criteria: string; passingScore: string; maxTurns: string; targetTurns: string };
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const identifierKey = (value: string, prefix: string) => {
  const ascii = slug(value);
  if (ascii) return ascii;
  // Keep identifiers schema-valid when a user supplies a Korean (or other non-ASCII) label.
  // This is deliberately independent from characterKey, which must mirror the compiler.
  let hash = 2166136261;
  for (const character of value.trim()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};
/** Mirrors the compiler's stable character key: ASCII name slug plus one-based index. */
const characterKey = (name: string, index: number) => `${slug(name) || "item"}-${index + 1}`;

export function AssessmentVersionForm({ packageId, version, initialValues, showPackageId = false, isPending, onSubmit }: {
  packageId: string; version: number; initialValues?: Partial<AssessmentVersionFormValues>; showPackageId?: boolean; isPending?: boolean;
  onSubmit: (id: string, data: AssessmentPackageVersionCreateInput) => void;
}) {
  const [values, setValues] = useState<AssessmentVersionFormValues>({ packageId, title: "", description: "", competency: "", dimensionLabel: "응답 품질", dimensionKey: "quality", criteria: "", passingScore: "70", maxTurns: "10", targetTurns: "5", ...initialValues });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryByScenario, setPrimaryByScenario] = useState<Record<string, string>>({});
  const scenarios = useListScenarios({});
  const set = (name: keyof AssessmentVersionFormValues) => (value: string) => setValues((current) => ({ ...current, [name]: value }));
  const toggle = (scenario: ScenarioRecord, checked: boolean) => {
    setSelectedIds((current) => checked ? [...current, scenario.id] : current.filter((id) => id !== scenario.id));
    if (checked) setPrimaryByScenario((current) => ({ ...current, [scenario.id]: characterKey(scenario.scenario.characters[0]?.name ?? "", 0) }));
  };
  const selected = (scenarios.data ?? []).filter((scenario) => selectedIds.includes(scenario.id));
  const submit = () => {
    const passingScore = Number(values.passingScore), maxTurns = Number(values.maxTurns), targetTurns = Number(values.targetTurns);
    const required = [values.packageId, values.title, values.description, values.competency, values.dimensionLabel, values.dimensionKey, values.criteria];
    if (required.some((value) => !value.trim()) || !selected.length || selected.some((scenario) => !primaryByScenario[scenario.id]) || !Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100 || !Number.isInteger(maxTurns) || maxTurns < 1 || !Number.isInteger(targetTurns) || targetTurns < 1) return;
    const competencyKey = identifierKey(values.competency, "competency");
    onSubmit(values.packageId.trim(), {
      packageId: values.packageId.trim(), packageKey: identifierKey(values.packageId, "package"), version, publishedAt: new Date().toISOString(), author: "ContentX author",
      metadata: { title: values.title.trim(), description: values.description.trim(), locale: "ko-KR", tags: ["contentx"] },
      competencies: [{ key: competencyKey, name: values.competency.trim() }],
      scenarios: selected.map((source) => ({
        scenarioId: source.id, scenarioKey: source.id, locale: "ko-KR", categoryKey: "general", competencyKeys: [competencyKey], difficulty: "intermediate", estimatedTime: 10, objectiveType: "roleplay",
        timeline: "현재", playerRole: "참여자", objectives: ["상황에 맞는 응답을 완성합니다"], successCriteria: ["평가 기준을 충족합니다"],
        primaryPersonaKey: primaryByScenario[source.id]!, personaSwitchMode: "disabled", personaSwitches: [], constraints: ["안전한 대화를 유지합니다"], difficultyProfile: { level: "intermediate", rationale: "표준 난이도" },
        evaluation: { dimensions: [{ key: values.dimensionKey.trim(), label: values.dimensionLabel.trim(), weight: 1, criteria: values.criteria.split("\n").map((item) => item.trim()).filter(Boolean) }], passingScore },
        termination: { conditions: ["목표 달성"], maxTurns }, simulation: { mode: "roleplay", initialPrompt: values.description.trim(), rules: ["persona를 유지합니다"] },
        analytics: { eventTypes: ["message"], trackPersonaSwitches: false }, targetDurationMinutes: 10, targetTurns, minValidTurns: 1,
      })),
    });
  };
  const invalid = !values.packageId.trim() || !values.title.trim() || !values.description.trim() || !values.competency.trim() || !values.dimensionLabel.trim() || !values.dimensionKey.trim() || !values.criteria.trim() || !selected.length || selected.some((scenario) => !primaryByScenario[scenario.id]);
  return <section className="space-y-4">
    <div className="grid sm:grid-cols-2 gap-4">{showPackageId && <Field label="Package ID" value={values.packageId} onChange={set("packageId")} placeholder="customer-support-basics" />}<Field label="역량" value={values.competency} onChange={set("competency")} placeholder="공감적 문제 해결" /></div>
    <Field label="제목" value={values.title} onChange={set("title")} placeholder="고객 지원 roleplay" />
    <div className="space-y-2"><Label htmlFor="input-assessment-description">설명 및 상황</Label><Textarea id="input-assessment-description" data-testid="input-assessment-description" value={values.description} onChange={(event) => set("description")(event.target.value)} /></div>
    <fieldset className="space-y-3 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">저장된 Scenario (최소 1개)</legend>{scenarios.isLoading ? <p className="text-sm text-muted-foreground">시나리오 불러오는 중…</p> : scenarios.data?.map((scenario) => <div key={scenario.id} className="space-y-2 border-b last:border-0 pb-3 last:pb-0"><label className="flex items-center gap-2 text-sm"><input data-testid={`checkbox-assessment-scenario-${scenario.id}`} type="checkbox" checked={selectedIds.includes(scenario.id)} onChange={(event) => toggle(scenario, event.target.checked)} />{scenario.title}</label>{selectedIds.includes(scenario.id) && <div className="pl-6 space-y-1"><Label>Primary character</Label><Select value={primaryByScenario[scenario.id]} onValueChange={(value) => setPrimaryByScenario((current) => ({ ...current, [scenario.id]: value }))}><SelectTrigger data-testid={`select-assessment-primary-persona-${scenario.id}`}><SelectValue placeholder="Primary character 선택" /></SelectTrigger><SelectContent>{scenario.scenario.characters.map((character, index) => <SelectItem key={characterKey(character.name, index)} value={characterKey(character.name, index)}>{character.name} · {character.role}</SelectItem>)}</SelectContent></Select></div>}</div>)}</fieldset>
    <div className="grid sm:grid-cols-2 gap-4"><Field label="Evaluation label" value={values.dimensionLabel} onChange={set("dimensionLabel")} placeholder="응답 품질" /><Field label="Evaluation key" value={values.dimensionKey} onChange={set("dimensionKey")} placeholder="quality" /><Field label="Passing score (0-100)" type="number" value={values.passingScore} onChange={set("passingScore")} placeholder="70" /><Field label="Max turns" type="number" value={values.maxTurns} onChange={set("maxTurns")} placeholder="10" /><Field label="Target turns" type="number" value={values.targetTurns} onChange={set("targetTurns")} placeholder="5" /></div>
    <div className="space-y-2"><Label htmlFor="input-assessment-evaluation-criteria">Evaluation criteria</Label><Textarea id="input-assessment-evaluation-criteria" data-testid="input-assessment-evaluation-criteria" value={values.criteria} onChange={(event) => set("criteria")(event.target.value)} placeholder="한 줄에 하나의 평가 기준을 입력하세요." /></div>
    <Button data-testid="button-create-assessment-version" onClick={submit} disabled={isPending || invalid}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}불변 버전 생성</Button>
  </section>;
}
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: "text" | "number" }) {
  const id = `input-assessment-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} data-testid={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
}