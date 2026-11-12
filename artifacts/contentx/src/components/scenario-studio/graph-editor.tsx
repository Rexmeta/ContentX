import { useMemo, useState } from "react";
import type { Entity, Relationship, ScenarioGraphDraft } from "@workspace/api-client-react";
import { StableGraph } from "@/components/stable-graph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { computeWorldLayout } from "@/lib/graph-layout";

const kinds: Record<string, string> = {
  narrative: "시나리오", event: "사건", character: "인물", conflict: "갈등",
  goal: "목표", constraint: "제약·트레이드오프", action: "장면", object: "자료",
};
const colors: Record<string, string> = {
  narrative: "#1d4ed8", event: "#075985", character: "#6d28d9", conflict: "#be123c",
  goal: "#047857", constraint: "#92400e", action: "#155e75", object: "#475569",
};
const selectStyle = "w-full rounded-md border bg-background px-2 py-2 text-sm";

export type DraftEditorProps = {
  draft: ScenarioGraphDraft;
  onChange: (next: ScenarioGraphDraft) => void;
};

export function ScenarioGraphEditor({ draft, onChange }: DraftEditorProps) {
  const [selection, setSelection] = useState(draft.entities.find((entry) => entry.kind === "narrative")?.id ?? "");
  const [newKind, setNewKind] = useState("character");
  const [view, setView] = useState<"core" | "all">("core");
  const { nodes, edges } = useMemo(() => {
    const entities = view === "all" ? draft.entities : draft.entities.filter(({ kind }) => !["action", "object"].includes(kind));
    const visible = new Set(entities.map(({ id }) => id));
    const graph = computeWorldLayout(entities, draft.relationships.filter(({ source, target }) => visible.has(source) && visible.has(target)));
    const entityKinds = new Map(entities.map(({ id, kind }) => [id, kind]));
    return {
      nodes: graph.nodes.map((node) => {
        const kind = entityKinds.get(node.id) ?? "";
        return { ...node, color: colors[kind] ?? "#475569", sublabel: kinds[kind] ?? kind };
      }),
      edges: graph.edges.map((edge) => ({
        ...edge, color: /conflict|oppos|pressure|tradeoff/i.test(edge.type) ? "#e11d48" : undefined,
      })),
    };
  }, [draft.entities, draft.relationships, view]);
  const entity = draft.entities.find(({ id }) => id === selection);
  const relation = draft.relationships.find(({ id }) => id === selection);
  const updateEntity = (patch: Partial<Entity>) => onChange({
    ...draft, entities: draft.entities.map((entry) => entry.id === selection ? { ...entry, ...patch } : entry),
  });
  const updateRelation = (patch: Partial<Relationship>) => onChange({
    ...draft, relationships: draft.relationships.map((entry) => entry.id === selection ? { ...entry, ...patch } : entry),
  });
  const addEntity = () => {
    const id = `entity_${crypto.randomUUID()}`;
    onChange({ ...draft, entities: [...draft.entities, { id, kind: newKind, name: `새 ${kinds[newKind]}` }] });
    setSelection(id);
  };
  const addRelation = () => {
    if (!entity) return;
    const target = draft.entities.find(({ id }) => id !== entity.id);
    if (!target) return;
    const id = `relationship_${crypto.randomUUID()}`;
    onChange({ ...draft, relationships: [...draft.relationships, { id, source: entity.id, target: target.id, type: "related_to" }] });
    setSelection(id);
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]" aria-label="시나리오 지식 그래프">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={view === "core" ? "default" : "outline"} size="sm" aria-pressed={view === "core"} onClick={() => setView("core")}>사건·인물·갈등</Button>
          <Button variant={view === "all" ? "default" : "outline"} size="sm" aria-pressed={view === "all"} onClick={() => setView("all")}>장면·자료까지 보기</Button>
          <span className="text-xs text-muted-foreground">분홍색 연결선은 갈등과 압박 관계를 표시합니다.</span>
        </div>
        <div className="relative h-[420px] overflow-hidden rounded-lg border bg-background">
          <StableGraph nodes={nodes} edges={edges} selectionId={selection}
            onSelectNode={setSelection} onSelectEdge={setSelection} onEmptyClick={() => setSelection("")} />
        </div>
      </div>
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <label className="block space-y-1 text-sm">편집 대상
          <select className={selectStyle} value={selection} onChange={(event) => setSelection(event.target.value)}>
            <option value="">노드 또는 관계 선택</option>
            <optgroup label="노드">{draft.entities.map((entry) => <option key={entry.id} value={entry.id}>{kinds[entry.kind] ?? entry.kind} · {entry.name}</option>)}</optgroup>
            <optgroup label="관계">{draft.relationships.map((entry) => <option key={entry.id} value={entry.id}>{draft.entities.find(({ id }) => id === entry.source)?.name} → {entry.type} → {draft.entities.find(({ id }) => id === entry.target)?.name}</option>)}</optgroup>
          </select>
        </label>
        <div className="flex gap-2">
          <select aria-label="추가할 노드 종류" className={selectStyle} value={newKind} onChange={(event) => setNewKind(event.target.value)}>
            {["character", "event", "conflict", "goal", "constraint"].map((kind) => <option key={kind} value={kind}>{kinds[kind]}</option>)}
          </select>
          <Button variant="outline" onClick={addEntity} disabled={draft.entities.length >= 70}>추가</Button>
        </div>
        {entity && <div className="space-y-3">
          <label className="block space-y-1 text-sm">이름<Input value={entity.name} onChange={(event) => updateEntity({ name: event.target.value })} /></label>
          <label className="block space-y-1 text-sm">설명<Textarea rows={5} value={entity.description ?? ""} onChange={(event) => updateEntity({ description: event.target.value })} /></label>
          {typeof entity.attributes?.sourceUri === "string" && /^https?:\/\//i.test(entity.attributes.sourceUri) &&
            <a href={entity.attributes.sourceUri} target="_blank" rel="noreferrer" className="block text-sm text-primary underline">원본 자료 열기</a>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={addRelation} disabled={draft.relationships.length >= 160}>관계 추가</Button>
            <Button variant="ghost" size="sm" disabled={draft.entities.length === 1} onClick={() => {
              onChange({
                ...draft,
                entities: draft.entities.filter(({ id }) => id !== selection),
                relationships: draft.relationships.filter(({ source, target }) => source !== selection && target !== selection),
              });
              setSelection("");
            }}>노드 삭제</Button>
          </div>
        </div>}
        {relation && <div className="space-y-3">
          {(["source", "target"] as const).map((endpoint) => <label key={endpoint} className="block space-y-1 text-sm">
            {endpoint === "source" ? "출발 노드" : "도착 노드"}
            <select className={selectStyle} value={relation[endpoint]} onChange={(event) => updateRelation({ [endpoint]: event.target.value })}>
              {draft.entities.filter(({ id }) => id !== relation[endpoint === "source" ? "target" : "source"]).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>)}
          <label className="block space-y-1 text-sm">관계 유형<Input list="scenario-relations" value={relation.type} onChange={(event) => updateRelation({ type: event.target.value })} /></label>
          <datalist id="scenario-relations">{["conflicts_with", "pressures", "supports", "reports_to", "causes", "tradeoff", "participates_in", "inspired_by"].map((type) => <option key={type} value={type} />)}</datalist>
          <label className="block space-y-1 text-sm">관계 설명<Textarea value={typeof relation.attributes?.detail === "string" ? relation.attributes.detail : ""} onChange={(event) => updateRelation({ attributes: { ...relation.attributes, detail: event.target.value } })} /></label>
          <Button variant="ghost" size="sm" onClick={() => {
            onChange({ ...draft, relationships: draft.relationships.filter(({ id }) => id !== selection) });
            setSelection("");
          }}>관계 삭제</Button>
        </div>}
      </div>
    </section>
  );
}
