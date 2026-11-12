import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAssessmentDiagnosticQueryKey,
  getGetAssessmentPackageVersionQueryKey,
  getGetAssessmentQueryKey,
  getListAssessmentsQueryKey,
  requestAssessmentMediaUpload,
  useCreateAssessmentDiagnosticVersion,
  type AssessmentMediaUploadInputContentType,
  type AssessmentScenarioPackageV1,
  type DiagnosticAuthoring,
  type DiagnosticCriterion,
  type DiagnosticCue,
  type DiagnosticMaterial,
  type DiagnosticMaterialType,
  type DiagnosticScenario,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, EyeOff, Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";
import {
  BRIEFING_CHAR_RANGE,
  DISPLAY_AT_LABEL,
  MATERIAL_TYPE_LABEL,
  PREP_SECONDS_RANGE,
  briefingAdvice,
  createCriterion,
  createCue,
  createMaterial,
  validateDiagnostic,
} from "@/lib/diagnostic";

const ALLOWED_MEDIA: Record<"image" | "video", AssessmentMediaUploadInputContentType[]> = {
  image: ["image/png", "image/jpeg", "image/webp"],
  video: ["video/mp4", "video/webm"],
};
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DiagnosticEditor({ assessmentId, sourceVersion, pkg, initial, onCancel, onSaved }: {
  assessmentId: string;
  sourceVersion: number;
  pkg: AssessmentScenarioPackageV1;
  initial: DiagnosticAuthoring;
  onCancel: () => void;
  onSaved: (version: number) => void;
}) {
  // Seeded once; the parent remounts the editor (key) when the source version changes.
  const [draft, setDraft] = useState<DiagnosticAuthoring>(initial);
  const [active, setActive] = useState(0);
  const save = useCreateAssessmentDiagnosticVersion();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const issues = useMemo(() => validateDiagnostic(draft, pkg), [draft, pkg]);
  const scenario = draft.scenarios[active];
  const packageScenario = pkg.scenarios.find((item) => item.key === scenario?.scenarioKey);
  const dimensions = packageScenario?.evaluation.dimensions ?? [];

  const update = (fn: (current: DiagnosticScenario) => DiagnosticScenario) =>
    setDraft((current) => ({ ...current, scenarios: current.scenarios.map((item, index) => (index === active ? fn(item) : item)) }));

  const submit = () => {
    if (issues.length) return;
    save.mutate({ id: assessmentId, version: sourceVersion, data: draft }, {
      onSuccess: (record) => {
        queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAssessmentQueryKey(assessmentId) });
        queryClient.invalidateQueries({ queryKey: getGetAssessmentPackageVersionQueryKey(assessmentId, record.version) });
        queryClient.invalidateQueries({ queryKey: getGetAssessmentDiagnosticQueryKey(assessmentId, record.version) });
        toast({ title: `진단 v${record.version} 저장됨`, description: `v${sourceVersion}의 나머지 내용을 그대로 이어받은 후속 버전입니다.` });
        onSaved(record.version);
      },
      onError: (error) => toast({ variant: "destructive", title: "진단 버전을 저장하지 못했습니다", description: error.message }),
    });
  };

  if (!scenario) return null;
  const advice = briefingAdvice(scenario.briefing);

  return (
    <section data-testid="diagnostic-editor" aria-label="진단 편집기" className="rounded-xl border bg-card">
      <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="tech-label text-primary">진단 편집 · v{sourceVersion}에서 후속 버전 생성</p>
          <h2 className="headline-lg mt-1">상대역이 아는 것과 응시자가 아는 것을 나눕니다</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-cancel-diagnostic" onClick={onCancel}><X className="mr-1.5 h-4 w-4" />취소</Button>
          <Button data-testid="button-save-diagnostic" onClick={submit} disabled={save.isPending || issues.length > 0}>
            {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}새 버전 저장
          </Button>
        </div>
      </header>

      {draft.scenarios.length > 1 && (
        <nav aria-label="시나리오 선택" className="flex gap-1 overflow-x-auto border-b px-4 py-2">
          {draft.scenarios.map((item, index) => (
            <button key={item.scenarioKey} type="button" data-testid={`tab-diagnostic-scenario-${item.scenarioKey}`} aria-current={index === active} onClick={() => setActive(index)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${index === active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}>
              {pkg.scenarios.find((s) => s.key === item.scenarioKey)?.title ?? item.scenarioKey}
            </button>
          ))}
        </nav>
      )}

      <div className="divide-y">
        <Block index="01" title="응시자 브리핑" note="응시자가 시작할 때 아는 내용입니다.">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="briefing-role" label="역할과 권한" value={scenario.briefing.roleAndAuthority} onChange={(v) => update((s) => ({ ...s, briefing: { ...s.briefing, roleAndAuthority: v } }))} />
            <TextField id="briefing-relationship" label="상대와의 관계" value={scenario.briefing.relationship} onChange={(v) => update((s) => ({ ...s, briefing: { ...s.briefing, relationship: v } }))} />
            <TextField id="briefing-reason" label="대화 이유" value={scenario.briefing.reason} onChange={(v) => update((s) => ({ ...s, briefing: { ...s.briefing, reason: v } }))} />
            <TextField id="briefing-goals" label="목표" value={scenario.briefing.goals} onChange={(v) => update((s) => ({ ...s, briefing: { ...s.briefing, goals: v } }))} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="input-briefing-seconds">준비 시간(초)</Label>
              <Input id="input-briefing-seconds" data-testid="input-briefing-seconds" type="number" min={1} value={String(scenario.briefing.preparationSeconds)} onChange={(e) => update((s) => ({ ...s, briefing: { ...s.briefing, preparationSeconds: Number(e.target.value) } }))} />
            </div>
            <p data-testid="text-briefing-advice" role="status" className={`rounded-md px-3 py-2 text-xs ${advice.charStatus === "ok" && advice.secondStatus === "ok" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-900 dark:text-amber-200"}`}>
              권장 {BRIEFING_CHAR_RANGE[0]}–{BRIEFING_CHAR_RANGE[1]}자 · {PREP_SECONDS_RANGE[0]}–{PREP_SECONDS_RANGE[1]}초. 현재 <b>{advice.chars}자</b> · <b>{advice.seconds}초</b>
              {advice.charStatus !== "ok" || advice.secondStatus !== "ok" ? " — 권장 범위 밖이지만 저장할 수 있습니다." : ""}
            </p>
          </div>
        </Block>

        <Block index="02" title="자료" note="준비·대화 단계에 공개됩니다. 이미지·영상은 텍스트 대체가 필요합니다.">
          <MaterialsEditor assessmentId={assessmentId} materials={scenario.materials} onChange={(materials) => update((s) => ({ ...s, materials }))} />
        </Block>

        <Block index="03" title="비공개 · 상대역 전용" note="응시자에게 절대 노출되지 않습니다." privateZone>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="private-causes" label="숨은 원인" value={scenario.private.hiddenCauses} onChange={(v) => update((s) => ({ ...s, private: { ...s.private, hiddenCauses: v } }))} />
            <TextField id="private-intent" label="상대역 속마음" value={scenario.private.internalIntent} onChange={(v) => update((s) => ({ ...s, private: { ...s.private, internalIntent: v } }))} />
            <TextField id="private-model" label="모범 대응" value={scenario.private.modelAnswer} onChange={(v) => update((s) => ({ ...s, private: { ...s.private, modelAnswer: v } }))} />
            <TextField id="private-instructions" label="연기 지침" value={scenario.private.instructions} onChange={(v) => update((s) => ({ ...s, private: { ...s.private, instructions: v } }))} />
          </div>
          <CuesEditor cues={scenario.cues} criteria={scenario.criteria} onChange={(cues) => update((s) => ({ ...s, cues }))} />
        </Block>

        <Block index="04" title="관찰 평가 기준" note="패키지의 기존 평가 차원에 연결됩니다.">
          <CriteriaEditor
            criteria={scenario.criteria}
            dimensions={dimensions}
            onChange={(criteria, removedId) => update((s) => ({ ...s, criteria, cues: removedId ? s.cues.map((cue) => ({ ...cue, criterionIds: cue.criterionIds.filter((id) => id !== removedId) })) : s.cues }))}
          />
        </Block>
      </div>

      {issues.length > 0 && (
        <div data-testid="list-diagnostic-issues" role="alert" className="border-t bg-destructive/5 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />저장 전 확인 {issues.length}건</p>
          <ul className="grid gap-1 text-xs sm:grid-cols-2">{issues.slice(0, 12).map((issue, i) => <li key={i}><span className="font-mono text-muted-foreground">{issue.path}</span> {issue.message}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

function Block({ index, title, note, privateZone, children }: { index: string; title: string; note: string; privateZone?: boolean; children: ReactNode }) {
  return (
    <fieldset className={`p-4 md:p-5 ${privateZone ? "bg-[repeating-linear-gradient(135deg,transparent,transparent_10px,hsl(var(--muted))_10px,hsl(var(--muted))_11px)]" : ""}`}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-xs text-primary">{index}</span>
        <h3 className="text-sm font-semibold flex items-center gap-1.5">{privateZone && <EyeOff className="h-3.5 w-3.5" />}{title}</h3>
        <span className="text-xs text-muted-foreground">{note}</span>
      </div>
      {children}
    </fieldset>
  );
}

function TextField({ id, label, value, onChange, rows = 3 }: { id: string; label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`input-${id}`}>{label}</Label>
      <Textarea id={`input-${id}`} data-testid={`input-${id}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="bg-background" />
    </div>
  );
}

function MaterialsEditor({ assessmentId, materials, onChange }: { assessmentId: string; materials: DiagnosticMaterial[]; onChange: (next: DiagnosticMaterial[]) => void }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const patch = (id: string, values: Partial<DiagnosticMaterial>) => onChange(materials.map((m) => (m.id === id ? { ...m, ...values } : m)));
  const upload = async (material: DiagnosticMaterial, file: File) => {
    const kind = material.type === "image" ? "image" : "video";
    const contentType = file.type as AssessmentMediaUploadInputContentType;
    if (!ALLOWED_MEDIA[kind].includes(contentType)) { setUploadError(`${MATERIAL_TYPE_LABEL[material.type]} 형식이 지원되지 않습니다: ${file.type || "알 수 없음"}`); return; }
    setUploading(material.id); setUploadError(null);
    try {
      const { assetId, uploadURL } = await requestAssessmentMediaUpload({ contentType });
      const response = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
      if (!response.ok) throw new Error(`업로드 실패 (${response.status})`);
      patch(material.id, { assetId });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "업로드 실패");
    } finally {
      setUploading(null);
    }
  };
  void assessmentId;
  return (
    <div className="space-y-3">
      {materials.length === 0 && <p data-testid="status-materials-empty" className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">아직 자료가 없습니다. 메일, 실적표, 현장 사진처럼 응시자가 보는 근거를 추가하세요.</p>}
      {materials.map((m, index) => (
        <article key={m.id} data-testid={`editor-material-${m.id}`} className="rounded-lg border bg-background p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="tech-label text-muted-foreground">자료 {index + 1} · {MATERIAL_TYPE_LABEL[m.type]}</span>
            <Button variant="ghost" size="sm" aria-label={`자료 ${index + 1} 삭제`} data-testid={`button-delete-material-${index}`} onClick={() => onChange(materials.filter((x) => x.id !== m.id))}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
            <div className="space-y-1.5"><Label htmlFor={`material-title-${m.id}`}>제목</Label><Input id={`material-title-${m.id}`} data-testid={`input-material-title-${index}`} value={m.title} onChange={(e) => patch(m.id, { title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor={`material-display-${m.id}`}>공개 시점</Label>
              <select id={`material-display-${m.id}`} data-testid={`select-material-display-${index}`} className={selectClass} value={m.displayAt} onChange={(e) => patch(m.id, { displayAt: e.target.value as DiagnosticMaterial["displayAt"] })}>
                {Object.entries(DISPLAY_AT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <label className="flex h-9 items-center gap-2 text-xs"><input type="checkbox" data-testid={`checkbox-material-reopen-${index}`} checked={m.reopenDuringConversation} onChange={(e) => patch(m.id, { reopenDuringConversation: e.target.checked })} />대화 중 다시 열기</label>
          </div>
          {m.type === "table" && m.table && <TableEditor index={index} table={m.table} onChange={(table) => patch(m.id, { table })} />}
          {(m.type === "image" || m.type === "video") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`material-file-${m.id}`}>{MATERIAL_TYPE_LABEL[m.type]} 파일</Label>
                <div className="flex items-center gap-2">
                  <Input id={`material-file-${m.id}`} data-testid={`input-material-file-${index}`} type="file" accept={ALLOWED_MEDIA[m.type].join(",")} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(m, file); }} />
                  {uploading === m.id ? <Loader2 className="h-4 w-4 animate-spin" aria-label="업로드 중" /> : <Upload className="h-4 w-4 text-muted-foreground" aria-hidden />}
                </div>
                <p data-testid={`text-material-asset-${index}`} className="font-mono text-[11px] text-muted-foreground">{m.assetId ? `asset ${m.assetId}` : "업로드 전"}</p>
              </div>
              {m.type === "image"
                ? <TextField id={`material-alt-${index}`} label="대체 텍스트 (스크린리더)" rows={2} value={m.altText ?? ""} onChange={(v) => patch(m.id, { altText: v })} />
                : <TextField id={`material-transcript-${index}`} label="영상 스크립트" rows={2} value={m.transcript ?? ""} onChange={(v) => patch(m.id, { transcript: v })} />}
            </div>
          )}
          <TextField id={`material-text-${index}`} label={m.type === "text" ? "본문" : "텍스트 대체 (핵심 사실 모두 포함)"} value={m.text} onChange={(v) => patch(m.id, { text: v })} />
        </article>
      ))}
      {uploadError && <p role="alert" data-testid="status-upload-error" className="text-xs text-destructive">{uploadError}</p>}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MATERIAL_TYPE_LABEL) as DiagnosticMaterialType[]).map((type) => (
          <Button key={type} variant="outline" size="sm" data-testid={`button-add-material-${type}`} onClick={() => onChange([...materials, createMaterial(type)])}><Plus className="mr-1 h-3.5 w-3.5" />{MATERIAL_TYPE_LABEL[type]}</Button>
        ))}
      </div>
    </div>
  );
}

function TableEditor({ index, table, onChange }: { index: number; table: NonNullable<DiagnosticMaterial["table"]>; onChange: (next: NonNullable<DiagnosticMaterial["table"]>) => void }) {
  const setColumn = (c: number, value: string) => onChange({ ...table, columns: table.columns.map((x, i) => (i === c ? value : x)) });
  const setCell = (r: number, c: number, value: string) => onChange({ ...table, rows: table.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? value : x)) : row)) });
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="text-xs border-separate border-spacing-1">
          <caption className="sr-only">표 편집</caption>
          <thead><tr>{table.columns.map((column, c) => <th key={c} scope="col"><Input aria-label={`열 ${c + 1} 제목`} data-testid={`input-table-${index}-col-${c}`} className="h-8 font-semibold" value={column} onChange={(e) => setColumn(c, e.target.value)} /></th>)}<th><span className="sr-only">행 삭제</span></th></tr></thead>
          <tbody>{table.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}><Input aria-label={`${r + 1}행 ${c + 1}열`} data-testid={`input-table-${index}-cell-${r}-${c}`} className="h-8" value={cell} onChange={(e) => setCell(r, c, e.target.value)} /></td>)}<td><Button variant="ghost" size="sm" aria-label={`${r + 1}행 삭제`} disabled={table.rows.length <= 1} onClick={() => onChange({ ...table, rows: table.rows.filter((_, i) => i !== r) })}><X className="h-3.5 w-3.5" /></Button></td></tr>)}</tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" data-testid={`button-add-row-${index}`} onClick={() => onChange({ ...table, rows: [...table.rows, table.columns.map(() => "")] })}>행 추가</Button>
        <Button variant="outline" size="sm" data-testid={`button-add-column-${index}`} onClick={() => onChange({ columns: [...table.columns, ""], rows: table.rows.map((row) => [...row, ""]) })}>열 추가</Button>
        <Button variant="outline" size="sm" disabled={table.columns.length <= 1} onClick={() => onChange({ columns: table.columns.slice(0, -1), rows: table.rows.map((row) => row.slice(0, -1)) })}>마지막 열 삭제</Button>
      </div>
    </div>
  );
}

function CuesEditor({ cues, criteria, onChange }: { cues: DiagnosticCue[]; criteria: DiagnosticCriterion[]; onChange: (next: DiagnosticCue[]) => void }) {
  const patch = (id: string, values: Partial<DiagnosticCue>) => onChange(cues.map((c) => (c.id === id ? { ...c, ...values } : c)));
  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">상대역 단서</h4>
        <span className="text-xs text-muted-foreground">문장 일치가 아니라 응시자의 의도로 판단합니다.</span>
      </div>
      {cues.map((cue, index) => (
        <article key={cue.id} data-testid={`editor-cue-${cue.id}`} className="rounded-lg border bg-background p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="tech-label text-muted-foreground">단서 {index + 1}</span>
              <select aria-label={`단서 ${index + 1} 유형`} data-testid={`select-cue-type-${index}`} className={`${selectClass} h-8 w-auto`} value={cue.type} onChange={(e) => { const type = e.target.value as DiagnosticCue["type"]; patch(cue.id, type === "discovery" ? { type, intent: cue.intent ?? "", condition: undefined } : { type, condition: cue.condition ?? "", intent: undefined }); }}>
                <option value="discovery">발견 단서</option>
                <option value="common">공통 단서</option>
              </select>
            </div>
            <Button variant="ghost" size="sm" aria-label={`단서 ${index + 1} 삭제`} data-testid={`button-delete-cue-${index}`} onClick={() => onChange(cues.filter((c) => c.id !== cue.id))}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {cue.type === "discovery"
              ? <TextField id={`cue-intent-${index}`} label="응시자 의도 (이런 취지로 물으면)" rows={2} value={cue.intent ?? ""} onChange={(v) => patch(cue.id, { intent: v })} />
              : <TextField id={`cue-condition-${index}`} label="제공 조건 (언제 꺼내는가)" rows={2} value={cue.condition ?? ""} onChange={(v) => patch(cue.id, { condition: v })} />}
            <TextField id={`cue-fact-${index}`} label="공개할 사실" rows={2} value={cue.fact} onChange={(v) => patch(cue.id, { fact: v })} />
            <TextField id={`cue-tone-${index}`} label="말투" rows={1} value={cue.tone ?? ""} onChange={(v) => patch(cue.id, { tone: v })} />
            <div className="space-y-1.5">
              <Label htmlFor={`cue-intensity-${cue.id}`}>강도</Label>
              <select id={`cue-intensity-${cue.id}`} data-testid={`select-cue-intensity-${index}`} className={selectClass} value={cue.intensity ?? ""} onChange={(e) => patch(cue.id, { intensity: e.target.value })}>
                {["낮음", "중간", "높음"].map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
          </div>
          <TextField id={`cue-fallback-${index}`} label="대체 조건 (끝까지 묻지 않을 때)" rows={1} value={cue.fallbackCondition ?? ""} onChange={(v) => patch(cue.id, { fallbackCondition: v })} />
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">연결 평가 기준</legend>
            {criteria.length === 0 ? <p className="text-xs text-muted-foreground">평가 기준을 먼저 추가하세요.</p> : (
              <div className="flex flex-wrap gap-2">
                {criteria.map((criterion) => (
                  <label key={criterion.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                    <input type="checkbox" data-testid={`checkbox-cue-${index}-criterion-${criterion.id}`} checked={cue.criterionIds.includes(criterion.id)} onChange={(e) => patch(cue.id, { criterionIds: e.target.checked ? [...cue.criterionIds, criterion.id] : cue.criterionIds.filter((id) => id !== criterion.id) })} />
                    {criterion.competencyName || criterion.dimensionKey}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </article>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" data-testid="button-add-cue-discovery" onClick={() => onChange([...cues, createCue("discovery", criteria[0] ? [criteria[0].id] : [])])}><Plus className="mr-1 h-3.5 w-3.5" />발견 단서</Button>
        <Button variant="outline" size="sm" data-testid="button-add-cue-common" onClick={() => onChange([...cues, createCue("common", criteria[0] ? [criteria[0].id] : [])])}><Plus className="mr-1 h-3.5 w-3.5" />공통 단서</Button>
      </div>
    </div>
  );
}

function CriteriaEditor({ criteria, dimensions, onChange }: { criteria: DiagnosticCriterion[]; dimensions: AssessmentScenarioPackageV1["scenarios"][number]["evaluation"]["dimensions"]; onChange: (next: DiagnosticCriterion[], removedId?: string) => void }) {
  const patch = (id: string, values: Partial<DiagnosticCriterion>) => onChange(criteria.map((c) => (c.id === id ? { ...c, ...values } : c)));
  const known = new Set(dimensions.map((d) => d.key));
  return (
    <div className="space-y-3">
      {criteria.map((criterion, index) => (
        <article key={criterion.id} data-testid={`editor-criterion-${criterion.id}`} className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[180px_1fr_1.4fr_auto] sm:items-start">
          <div className="space-y-1.5">
            <Label htmlFor={`criterion-dim-${criterion.id}`}>평가 차원</Label>
            <select id={`criterion-dim-${criterion.id}`} data-testid={`select-criterion-dimension-${index}`} aria-invalid={!known.has(criterion.dimensionKey)} className={selectClass} value={criterion.dimensionKey} onChange={(e) => patch(criterion.id, { dimensionKey: e.target.value })}>
              {!known.has(criterion.dimensionKey) && <option value={criterion.dimensionKey}>연결 끊김: {criterion.dimensionKey || "미선택"}</option>}
              {dimensions.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label htmlFor={`criterion-name-${criterion.id}`}>역량명</Label><Input id={`criterion-name-${criterion.id}`} data-testid={`input-criterion-name-${index}`} value={criterion.competencyName} onChange={(e) => patch(criterion.id, { competencyName: e.target.value })} /></div>
          <TextField id={`criterion-behavior-${index}`} label="관찰 가능한 행동" rows={2} value={criterion.observableBehavior} onChange={(v) => patch(criterion.id, { observableBehavior: v })} />
          <Button variant="ghost" size="sm" className="sm:mt-6" aria-label={`평가 기준 ${index + 1} 삭제`} data-testid={`button-delete-criterion-${index}`} onClick={() => onChange(criteria.filter((c) => c.id !== criterion.id), criterion.id)}><Trash2 className="h-4 w-4" /></Button>
        </article>
      ))}
      <Button variant="outline" size="sm" data-testid="button-add-criterion" disabled={!dimensions.length} onClick={() => onChange([...criteria, createCriterion(dimensions[0]!.key, dimensions[0]!.label)])}><Plus className="mr-1 h-3.5 w-3.5" />평가 기준</Button>
    </div>
  );
}
