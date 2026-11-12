import { ArrowDown, ArrowUp } from "lucide-react";
import type { Entity } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DraftEditorProps } from "./graph-editor";

const beats = { hook: "도입 훅", setup: "상황 설정", escalation: "갈등 고조", decision: "선택", payoff: "결과" };

export function ScenarioStoryboard({ draft, onChange }: DraftEditorProps) {
  const scenes = draft.entities.filter(({ kind }) => kind === "action")
    .sort((a, b) => Number(a.attributes?.order) - Number(b.attributes?.order));
  const totalSeconds = scenes.reduce((total, scene) => total + Number(scene.attributes?.seconds ?? 0), 0);

  const updateScene = (id: string, patch: Partial<Entity>) => onChange({
    ...draft, entities: draft.entities.map((entity) => entity.id === id ? { ...entity, ...patch } : entity),
  });
  const moveScene = (from: number, to: number) => {
    const reordered = [...scenes];
    [reordered[from], reordered[to]] = [reordered[to]!, reordered[from]!];
    const positions = new Map(reordered.map(({ id }, index) => [id, index + 1]));
    onChange({
      ...draft, entities: draft.entities.map((entity) => entity.kind === "action"
        ? { ...entity, attributes: { ...entity.attributes, order: positions.get(entity.id) } }
        : entity),
    });
  };

  return <section className="space-y-4" aria-label="스토리보드 타임라인">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{scenes.length}개 장면 · 예상 {totalSeconds}초</p>
      <Button variant="outline" disabled={draft.entities.length >= 70 || draft.relationships.length >= 160} onClick={() => {
        const id = `entity_${crypto.randomUUID()}`;
        const narrative = draft.entities.find(({ kind }) => kind === "narrative");
        const order = Math.max(0, ...scenes.map((scene) => Number(scene.attributes?.order))) + 1;
        if (!narrative || order > 70) return;
        onChange({
          ...draft,
          entities: [...draft.entities, { id, kind: "action", name: "새 장면", attributes: { order, seconds: 10, beat: "setup", line: "" } }],
          relationships: [...draft.relationships, { id: `relationship_${crypto.randomUUID()}`, source: narrative.id, target: id, type: "includes" }],
        });
      }}>장면 추가</Button>
    </div>
    <div className="flex overflow-hidden rounded-md border" aria-label="장면별 시간 비율">
      {scenes.map((scene, index) => <div key={scene.id} className={`min-w-5 truncate border-r px-1.5 py-2 text-center text-xs last:border-r-0 ${index % 2 ? "bg-muted" : "bg-primary/10"}`} style={{ flexGrow: Number(scene.attributes?.seconds ?? 1), flexBasis: 0 }} title={scene.name}>{index + 1}</div>)}
    </div>
    <ol className="grid gap-3 md:grid-cols-2">
      {scenes.map((scene, index) => {
        const attributes = scene.attributes ?? {};
        return <li key={scene.id} className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">장면 {index + 1}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label={`장면 ${index + 1} 앞으로`} disabled={index === 0} onClick={() => moveScene(index, index - 1)}><ArrowUp /></Button>
              <Button variant="ghost" size="icon" aria-label={`장면 ${index + 1} 뒤로`} disabled={index === scenes.length - 1} onClick={() => moveScene(index, index + 1)}><ArrowDown /></Button>
            </div>
          </div>
          <label className="block text-sm">장면 제목<Input value={scene.name} onChange={(event) => updateScene(scene.id, { name: event.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">장면 역할
              <select className="h-9 w-full rounded-md border bg-background px-2" value={String(attributes.beat)} onChange={(event) => updateScene(scene.id, { attributes: { ...attributes, beat: event.target.value } })}>
                {Object.entries(beats).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm">길이(초)
              <Input type="number" min={1} max={180} value={Number(attributes.seconds) || ""} onChange={(event) => updateScene(scene.id, { attributes: { ...attributes, seconds: Number(event.target.value) } })} />
            </label>
          </div>
          <label className="block text-sm">화면에 보이는 행동<Textarea rows={2} value={scene.description ?? ""} onChange={(event) => updateScene(scene.id, { description: event.target.value })} /></label>
          <label className="block text-sm">대사·자막<Textarea rows={2} maxLength={1200} value={String(attributes.line ?? "")} onChange={(event) => updateScene(scene.id, { attributes: { ...attributes, line: event.target.value } })} /></label>
        </li>;
      })}
    </ol>
  </section>;
}
