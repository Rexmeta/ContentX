import { useMemo } from "react";
import type { ScenarioRecord } from "@workspace/api-client-react";
import { GitMerge, GitBranch, FileText, Ghost, CornerDownRight, Link2 } from "lucide-react";

/**
 * Scenario lineage family tree.
 *
 * Synthesis lineage forms a DAG (a child can have multiple parents). We render
 * it as a forest: every root (a scenario with no parents that has descendants)
 * starts a tree, and children with multiple parents appear under each parent
 * with a "multi-parent" marker. Parents that were deleted from the library are
 * rendered as ghost nodes so the chain stays legible.
 */

interface TreeNode {
  id: string;
  record: ScenarioRecord | null; // null => ghost (deleted parent)
  ghostTitle?: string;
  elements?: string[]; // elements this node contributed to its child context (set on children)
  bridgeRole?: string | null; // role this node's parent played in producing THIS bridge child (source/target)
  children: TreeNode[];
  multiParent: boolean;
}

function buildForest(scenarios: ScenarioRecord[]): { roots: TreeNode[]; involved: number } {
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  // parentId -> children entries
  const childrenOf = new Map<string, { child: ScenarioRecord; elements: string[]; role?: string | null }[]>();
  const ghostTitles = new Map<string, string>();
  const hasParents = new Set<string>();
  const isParent = new Set<string>();

  for (const s of scenarios) {
    if (!s.lineage || s.lineage.parents.length === 0) continue;
    hasParents.add(s.id);
    for (const p of s.lineage.parents) {
      isParent.add(p.scenarioId);
      if (!byId.has(p.scenarioId)) ghostTitles.set(p.scenarioId, p.title);
      const list = childrenOf.get(p.scenarioId) || [];
      list.push({ child: s, elements: p.elements as string[], role: p.role ?? null });
      childrenOf.set(p.scenarioId, list);
    }
  }

  const parentCount = (id: string) => {
    const rec = byId.get(id);
    return rec?.lineage?.parents.length ?? 0;
  };

  const involvedIds = new Set<string>([...hasParents, ...isParent]);

  const build = (id: string, elements: string[] | undefined, bridgeRole: string | null | undefined, visited: Set<string>): TreeNode => {
    const record = byId.get(id) || null;
    const node: TreeNode = {
      id,
      record,
      ghostTitle: record ? undefined : ghostTitles.get(id) || "Deleted scenario",
      elements,
      bridgeRole,
      children: [],
      multiParent: parentCount(id) > 1,
    };
    if (visited.has(id)) return node; // cycle guard
    const nextVisited = new Set(visited).add(id);
    const kids = childrenOf.get(id) || [];
    node.children = kids
      .sort((a, b) => a.child.createdAt.localeCompare(b.child.createdAt))
      .map((k) => build(k.child.id, k.elements, k.role, nextVisited));
    return node;
  };

  // Roots: nodes involved in lineage that themselves have no parents
  // (including ghost parents, which by definition have no known parents).
  const rootIds = [...involvedIds].filter((id) => {
    const rec = byId.get(id);
    if (!rec) return true; // ghost parent => root
    return !rec.lineage || rec.lineage.parents.length === 0;
  });

  const roots = rootIds
    .sort((a, b) => {
      const ra = byId.get(a);
      const rb = byId.get(b);
      return (ra?.createdAt || "").localeCompare(rb?.createdAt || "");
    })
    .map((id) => build(id, undefined, undefined, new Set()));

  return { roots, involved: involvedIds.size };
}

function countDescendants(node: TreeNode): number {
  return node.children.reduce((acc, c) => acc + 1 + countDescendants(c), 0);
}

function NodeCard({
  node,
  depth,
  onOpen,
}: {
  node: TreeNode;
  depth: number;
  onOpen: (r: ScenarioRecord) => void;
}) {
  const isGhost = !node.record;
  const isSynth = Boolean(node.record?.lineage && node.record.lineage.parents.length > 0);
  const isBridge = node.record?.lineage?.kind === "bridge";
  const descendants = depth === 0 ? countDescendants(node) : 0;

  return (
    <div className="relative">
      {depth > 0 && (
        <div className="absolute -left-4 top-5 w-4 border-t border-dashed border-border" aria-hidden />
      )}
      <div
        onClick={() => node.record && onOpen(node.record)}
        className={`group border rounded-lg p-3 mb-2 flex flex-col gap-1.5 transition-colors ${
          isGhost
            ? "border-dashed border-border bg-muted/20 text-muted-foreground cursor-default"
            : "border-border bg-card hover:border-primary cursor-pointer"
        }`}
        title={isGhost ? "This parent scenario was deleted from the library" : "Open scenario"}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {isGhost ? (
            <Ghost className="h-3.5 w-3.5 shrink-0" />
          ) : isBridge ? (
            <Link2 className="h-3.5 w-3.5 text-chart-3 shrink-0" />
          ) : isSynth ? (
            <GitMerge className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : (
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className={`text-sm font-bold ${isGhost ? "italic" : "group-hover:text-primary transition-colors"}`}>
            {node.record?.title || node.ghostTitle || "Untitled"}
          </span>
          {isGhost && (
            <span className="text-[9px] font-mono uppercase tracking-wider rounded-full border border-dashed border-border px-2 py-px">
              deleted
            </span>
          )}
          {isBridge && (
            <span className="text-[9px] font-mono uppercase tracking-wider rounded-full bg-chart-3/10 text-chart-3 border border-chart-3/20 px-2 py-px flex items-center gap-1">
              <Link2 className="h-2.5 w-2.5" /> bridge
            </span>
          )}
          {node.multiParent && (
            <span className="text-[9px] font-mono uppercase tracking-wider rounded-full bg-secondary/10 text-secondary border border-secondary/20 px-2 py-px flex items-center gap-1">
              <GitBranch className="h-2.5 w-2.5" /> multi-parent
            </span>
          )}
          {depth === 0 && descendants > 0 && (
            <span className="ml-auto text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {descendants} descendant{descendants > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {node.bridgeRole && (
          <div className="flex flex-wrap items-center gap-1">
            <CornerDownRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase mr-1">via</span>
            <span className="bg-chart-3/10 text-chart-3 border border-chart-3/20 text-[9px] font-mono rounded-full px-2 py-px uppercase tracking-wider">
              {node.bridgeRole === "source" ? "bridged from (A)" : "bridged into (B)"}
            </span>
          </div>
        )}
        {node.elements && node.elements.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <CornerDownRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase mr-1">took</span>
            {node.elements.map((el) => (
              <span
                key={el}
                className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-mono rounded-full px-2 py-px uppercase tracking-wider"
              >
                {el}
              </span>
            ))}
          </div>
        )}
        {node.record?.scenario?.logline && (
          <p className="text-xs text-muted-foreground line-clamp-1 font-serif">
            {node.record.scenario.logline}
          </p>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="pl-8 border-l border-dashed border-border ml-2">
          {node.children.map((child, i) => (
            <NodeCard key={`${child.id}-${i}`} node={child} depth={depth + 1} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LineageTree({
  scenarios,
  onOpen,
}: {
  scenarios: ScenarioRecord[];
  onOpen: (r: ScenarioRecord) => void;
}) {
  const { roots } = useMemo(() => buildForest(scenarios), [scenarios]);

  if (roots.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 md:p-8">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground mb-4">
          <GitMerge className="h-8 w-8" />
        </div>
        <h3 className="headline-lg mb-2">No lineage yet</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          Synthesize two or more scenarios in the Scenario Library — their family tree will appear here,
          showing which stories grew out of which.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-8">
      <p className="tech-label text-muted-foreground">
        {roots.length} family tree{roots.length > 1 ? "s" : ""} · click a node to open the scenario
      </p>
      {roots.map((root) => (
        <div key={root.id} className="border border-border rounded-xl bg-background/50 p-4 overflow-x-auto">
          <NodeCard node={root} depth={0} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}
