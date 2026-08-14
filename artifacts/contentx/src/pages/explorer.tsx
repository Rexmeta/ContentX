import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import { 
  useGetContent, getGetContentQueryKey, useListContent, getListContentQueryKey,
  useGetPopulation, getGetPopulationQueryKey, useListPopulations, getListPopulationsQueryKey,
  useListDimensions, getListDimensionsQueryKey,
  useListSamplingRuns, getListSamplingRunsQueryKey,
  useListDependencyRules, getListDependencyRulesQueryKey,
  useListCharacters, getListCharactersQueryKey,
  useGetCharacter, getGetCharacterQueryKey,
  useListAgents, getListAgentsQueryKey,
  useListSnapshots, getListSnapshotsQueryKey,
  useGetSimulation, getGetSimulationQueryKey, useListSimulations, getListSimulationsQueryKey,
  useListSimulationEvents, getListSimulationEventsQueryKey,
  useListEvaluations, getListEvaluationsQueryKey
} from "@workspace/api-client-react";
import { StableGraph, GraphLegend } from "@/components/stable-graph";
import { computePopulationLayout, computeLineageLayout, computeWorldLayout, computeCharacterLayout, computeSimulationLayout } from "@/lib/graph-layout";
import { useState, useMemo, useEffect } from "react";
import { formatDisplayName } from "@/lib/display-name";
import { Network, Database, Users, UserCircle, PlayCircle, GitMerge } from "lucide-react";

type Perspective = "world" | "population" | "character" | "simulation" | "lineage";

export default function Explorer() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialPerspective = (searchParams.get("perspective") as Perspective) || "population";
  const initialId = searchParams.get("id") || "";

  const [perspective, setPerspective] = useState<Perspective>(initialPerspective);
  const [targetId, setTargetId] = useState<string>(initialId);
  const [selectionId, setSelectionId] = useState<string | null>(null);

  // List queries for selectors
  const { data: allContents } = useListContent({ query: { queryKey: getListContentQueryKey() } });
  const { data: allPopulations } = useListPopulations({ query: { queryKey: getListPopulationsQueryKey() } });
  const { data: allCharacters } = useListCharacters({ query: { queryKey: getListCharactersQueryKey() } });
  const { data: allSimulations } = useListSimulations({ query: { queryKey: getListSimulationsQueryKey() } });

  // Compute active target ID
  const activeTargetId = useMemo(() => {
    if (targetId) return targetId;
    if (perspective === 'world') return allContents?.[0]?.id || "";
    if (perspective === 'population') return allPopulations?.[0]?.id || "";
    if (perspective === 'character' || perspective === 'lineage') return allCharacters?.[0]?.id || "";
    if (perspective === 'simulation') return allSimulations?.[0]?.id || "";
    return "";
  }, [targetId, perspective, allContents, allPopulations, allCharacters, allSimulations]);

  // Queries for activeTargetId
  const { data: content } = useGetContent(activeTargetId, { query: { enabled: perspective === "world" && !!activeTargetId, queryKey: getGetContentQueryKey(activeTargetId) } });
  const { data: pop } = useGetPopulation(activeTargetId, { query: { enabled: perspective === "population" && !!activeTargetId, queryKey: getGetPopulationQueryKey(activeTargetId) } });
  const { data: dim } = useListDimensions({ query: { enabled: perspective === "population" && !!activeTargetId, queryKey: getListDimensionsQueryKey() } });
  const { data: rul } = useListDependencyRules(activeTargetId, { query: { enabled: perspective === "population" && !!activeTargetId, queryKey: getListDependencyRulesQueryKey(activeTargetId) } });

  // The dimensions endpoint is a global registry; only show the dimensions
  // this population actually declares (Population.dimensions holds names/ids).
  const popDimensions = useMemo(() => {
    if (!dim || !pop) return dim || [];
    const declared = new Set(pop.dimensions);
    return dim.filter(d => declared.has(d.name) || declared.has(d.id));
  }, [dim, pop]);
  
  const { data: char } = useGetCharacter(activeTargetId, { query: { enabled: (perspective === "character" || perspective === "lineage") && !!activeTargetId, queryKey: getGetCharacterQueryKey(activeTargetId) } });
  const { data: charPop } = useGetPopulation(char?.provenance?.populationId || "", { query: { enabled: (perspective === "character" || perspective === "lineage") && !!char?.provenance?.populationId, queryKey: getGetPopulationQueryKey(char?.provenance?.populationId || "") } });
  const { data: allSnapshots } = useListSnapshots({ query: { enabled: perspective === "character" || perspective === "lineage", queryKey: getListSnapshotsQueryKey() } });
  const { data: samplingRuns } = useListSamplingRuns(char?.provenance?.populationId || "", { query: { enabled: perspective === "lineage" && !!char?.provenance?.populationId, queryKey: getListSamplingRunsQueryKey(char?.provenance?.populationId || "") } });
  const { data: allAgents } = useListAgents({ query: { enabled: perspective === "character" || perspective === "lineage" || perspective === "simulation", queryKey: getListAgentsQueryKey() } });
  
  const { data: sim } = useGetSimulation(activeTargetId, { query: { enabled: perspective === "simulation" && !!activeTargetId, queryKey: getGetSimulationQueryKey(activeTargetId) } });
  const { data: simEvents } = useListSimulationEvents(activeTargetId, { query: { enabled: perspective === "simulation" && !!activeTargetId, queryKey: getListSimulationEventsQueryKey(activeTargetId) } });
  const { data: evals } = useListEvaluations({}, { query: { enabled: perspective === "simulation" || perspective === "lineage", queryKey: getListEvaluationsQueryKey({}) } });

  // Compute graph based on perspective
  const { nodes, edges } = useMemo(() => {
    if (perspective === "world" && content) {
      return computeWorldLayout(content.entities, content.relationships);
    }
    
    if (perspective === "population" && pop && dim && rul && allCharacters) {
      const popChars = allCharacters.filter(c => c.provenance?.populationId === pop.id);
      return computePopulationLayout(pop, popDimensions, rul, popChars);
    }
    
    if (perspective === "character" && char) {
      const snaps = allSnapshots?.filter(s => s.characterId === char.id) || [];
      return computeCharacterLayout(char, charPop, snaps, allAgents || []);
    }
    
    if (perspective === "simulation" && sim && simEvents) {
      const simAgents = sim.participants;
      const simEvals = evals?.filter(e => e.simulationId === sim.id) || [];
      return computeSimulationLayout(sim, simAgents, simEvents, simEvals);
    }
    
    if (perspective === "lineage" && char && charPop) {
      // Build the provenance TREE strictly from recorded provenance fields.
      // MatrAIx source/import nodes only appear when the population really
      // originated from a MatrAIx import; all snapshots/agents/simulations/
      // evaluations descending from the character are shown, not just one.
      const lineageItems: { id: string; label: string; kind: string; parentId?: string | null; metadata?: Record<string, unknown> }[] = [];
      let popParent: string | null = null;
      if (charPop.provenance?.sourceType === 'matraix') {
        lineageItems.push({ id: 'matraix', label: 'MatrAIx Source', kind: 'MatrAIx' });
        lineageItems.push({ id: `import-${charPop.id}`, label: 'MatrAIx Import', kind: 'Import', parentId: 'matraix' });
        popParent = `import-${charPop.id}`;
      }
      lineageItems.push({ id: charPop.id, label: charPop.name, kind: 'Population', parentId: popParent });
      // A sampling run records the characters it produced (characterIds).
      const samplingRun = samplingRuns?.find(r => r.characterIds?.includes(char.id));
      let charParent: string = charPop.id;
      if (samplingRun) {
        lineageItems.push({ id: samplingRun.id, label: `Run ${samplingRun.strategy} · seed ${samplingRun.seed}`, kind: 'SamplingRun', parentId: charPop.id, metadata: { strategy: samplingRun.strategy, seed: samplingRun.seed } });
        charParent = samplingRun.id;
      }
      lineageItems.push({ id: char.id, label: char.name, kind: 'Character', parentId: charParent, metadata: { seed: char.provenance?.seed } });
      
      const snaps = allSnapshots?.filter(s => s.characterId === char.id) || [];
      const seenSims = new Set<string>();
      snaps.forEach(snap => {
        lineageItems.push({ id: snap.id, label: `Snapshot ${snap.id.substring(0, 8)}`, kind: 'CharacterSnapshot', parentId: char.id });
        const agentsForSnap = allAgents?.filter(a => a.snapshotId === snap.id) || [];
        agentsForSnap.forEach(ag => {
          lineageItems.push({ id: ag.id, label: ag.name, kind: 'Agent', parentId: snap.id });
          const simsForAg = allSimulations?.filter(s => s.participants.some(p => p.agentId === ag.id)) || [];
          simsForAg.forEach(simForAg => {
            if (!seenSims.has(simForAg.id)) {
              seenSims.add(simForAg.id);
              lineageItems.push({ id: simForAg.id, label: simForAg.name, kind: 'Simulation', parentId: ag.id });
              const evsForSim = evals?.filter(e => e.simulationId === simForAg.id) || [];
              evsForSim.forEach(ev => {
                lineageItems.push({ id: ev.id, label: `Evaluation ${ev.kind}`, kind: 'Evaluation', parentId: simForAg.id, metadata: { kind: ev.kind } });
              });
            }
          });
        });
      });
      return computeLineageLayout(lineageItems);
    }
    
    return { nodes: [], edges: [] };
  }, [perspective, content, pop, dim, popDimensions, rul, allCharacters, char, charPop, allSnapshots, allAgents, sim, simEvents, evals, allSimulations, allContents, samplingRuns]);

  // Handle right inspector panel based on selection
  const selectedNode = nodes.find(n => n.id === selectionId);
  const selectedEdge = edges.find(e => e.id === selectionId);

  // Dynamic legends
  const legendConfig = useMemo(() => {
    if (perspective === 'world') {
      return {
        nodes: [{ label: 'Entity', color: 'hsl(var(--card))' }],
        edges: [{ label: 'Semantic', strokeDasharray: '' }]
      };
    }
    if (perspective === 'population') {
      return {
        nodes: [
          { label: 'Population', color: 'hsl(var(--primary))' },
          { label: 'Dimension', color: 'hsl(var(--card))' },
          { label: 'Character', color: 'hsl(var(--secondary))' },
          { label: 'Character Cluster', color: 'hsl(var(--secondary))' }
        ],
        edges: [
          { label: 'Has Dimension', strokeDasharray: '' },
          { label: 'Dependency', strokeDasharray: '6 4' },
          { label: 'Sampled', strokeDasharray: '2 4' }
        ]
      };
    }
    if (perspective === 'character') {
      return {
        nodes: [
          { label: 'Population', color: 'hsl(var(--primary))' },
          { label: 'Character', color: 'hsl(var(--secondary))' },
          { label: 'Goal', color: 'hsl(var(--card))' },
          { label: 'Snapshot', color: 'hsl(var(--card))' },
          { label: 'Agent', color: 'hsl(var(--primary))' }
        ],
        edges: [
          { label: 'Has Goal', strokeDasharray: '' },
          { label: 'Provenance', strokeDasharray: '2 4' }
        ]
      };
    }
    if (perspective === 'simulation') {
      return {
        nodes: [
          { label: 'Simulation', color: 'hsl(var(--primary))' },
          { label: 'Agent', color: 'hsl(var(--secondary))' },
          { label: 'Event', color: 'hsl(var(--card))' },
          { label: 'Outcome', color: 'hsl(var(--card))' },
          { label: 'Evaluation', color: 'hsl(var(--chart-3))' }
        ],
        edges: [
          { label: 'Sequence', strokeDasharray: '' },
          { label: 'Performed By', strokeDasharray: '6 4' },
          { label: 'Evaluated', strokeDasharray: '2 4' }
        ]
      };
    }
    if (perspective === 'lineage') {
      return {
        nodes: [
          { label: 'MatrAIx Source', color: 'hsl(var(--secondary))' },
          { label: 'Lifecycle Stage', color: 'hsl(var(--card))' }
        ],
        edges: [
          { label: 'Provenance (derived from)', strokeDasharray: '2 4' }
        ]
      };
    }
    return { nodes: [], edges: [] };
  }, [perspective]);

  return (
    <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Graph Explorer" }]}>
      <div className="h-full flex flex-col overflow-hidden">
        
        {/* Perspectives Toggle & Selector */}
        <div className="h-14 border-b border-border bg-muted/20 flex items-center justify-between px-4 shrink-0">
          <div className="flex gap-2">
            <button onClick={() => { setPerspective("world"); setTargetId(""); setSelectionId(null); }} className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-widest border transition-colors ${perspective === 'world' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}>
              <Database className="h-3.5 w-3.5" /> World
            </button>
            <button onClick={() => { setPerspective("population"); setTargetId(""); setSelectionId(null); }} className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-widest border transition-colors ${perspective === 'population' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}>
              <Users className="h-3.5 w-3.5" /> Population
            </button>
            <button onClick={() => { setPerspective("character"); setTargetId(""); setSelectionId(null); }} className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-widest border transition-colors ${perspective === 'character' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}>
              <UserCircle className="h-3.5 w-3.5" /> Character
            </button>
            <button onClick={() => { setPerspective("simulation"); setTargetId(""); setSelectionId(null); }} className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-widest border transition-colors ${perspective === 'simulation' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}>
              <PlayCircle className="h-3.5 w-3.5" /> Simulation
            </button>
            <button onClick={() => { setPerspective("lineage"); setTargetId(""); setSelectionId(null); }} className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-widest border transition-colors ${perspective === 'lineage' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}>
              <GitMerge className="h-3.5 w-3.5" /> Lineage
            </button>
          </div>

          <div className="flex-1 flex justify-end">
            {perspective === 'world' && allContents && (
              <select className="bg-background border border-border px-3 py-1.5 text-sm font-mono focus:outline-none" value={activeTargetId} onChange={e => setTargetId(e.target.value)}>
                {allContents.map(c => <option key={c.id} value={c.id}>{c.title} (v{c.version})</option>)}
              </select>
            )}
            {perspective === 'population' && allPopulations && (
              <select className="bg-background border border-border px-3 py-1.5 text-sm font-mono focus:outline-none" value={activeTargetId} onChange={e => setTargetId(e.target.value)}>
                {allPopulations.map(p => <option key={p.id} value={p.id} title={p.name}>{formatDisplayName(p.name)} (v{p.version})</option>)}
              </select>
            )}
            {(perspective === 'character' || perspective === 'lineage') && allCharacters && (
              <select className="bg-background border border-border px-3 py-1.5 text-sm font-mono focus:outline-none" value={activeTargetId} onChange={e => setTargetId(e.target.value)}>
                {allCharacters.map(c => <option key={c.id} value={c.id} title={c.name}>{formatDisplayName(c.name)}</option>)}
              </select>
            )}
            {perspective === 'simulation' && allSimulations && (
              <select className="bg-background border border-border px-3 py-1.5 text-sm font-mono focus:outline-none" value={activeTargetId} onChange={e => setTargetId(e.target.value)}>
                {allSimulations.map(s => <option key={s.id} value={s.id} title={s.name}>{formatDisplayName(s.name)}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Graph Area */}
          <div className="flex-1 relative border-r border-border bg-background">
            <StableGraph 
              nodes={nodes}
              edges={edges}
              selectionId={selectionId}
              onSelectNode={(id) => setSelectionId(id)}
              onSelectEdge={(id) => setSelectionId(id)}
              onEmptyClick={() => setSelectionId(null)}
            />
            <GraphLegend 
              nodeTypes={legendConfig.nodes}
              relationshipTypes={legendConfig.edges}
            />
          </div>

          {/* Right Inspector */}
          <div className="w-[400px] bg-card flex flex-col shrink-0">
            <div className="h-14 border-b border-border bg-muted/30 flex items-center px-4 shrink-0">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">Inspector</h2>
            </div>
            <div className="flex-1 overflow-auto p-6 custom-scrollbar">
              {selectedNode ? (
                <div className="space-y-4 animate-in fade-in">
                  <div className="border border-border p-4 bg-muted/10">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest mb-1">Selected Node</div>
                    <div className="text-lg font-bold uppercase tracking-wider">{selectedNode.kind}</div>
                    <div className="text-2xl font-serif mt-2" title={selectedNode.fullLabel || selectedNode.label}>{selectedNode.label}</div>
                    {selectedNode.fullLabel && (
                      <div className="text-[10px] font-mono text-muted-foreground break-all mt-2">
                        Full name: {selectedNode.fullLabel}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="grid grid-cols-2 gap-y-2 border-b border-border pb-4">
                      {selectedNode.metadata && Object.entries(selectedNode.metadata)
                        .filter(([k]) => k !== 'stateBefore' && k !== 'stateAfter' && k !== 'characters')
                        .map(([k, v]) => (
                        <div key={k} className="col-span-2 sm:col-span-1">
                          <div className="text-[9px] font-mono uppercase tracking-widest">{k}</div>
                          <div className="font-semibold text-foreground truncate" title={String(v)}>{String(v)}</div>
                        </div>
                      ))}
                    </div>
                    
                    {selectedNode.metadata?.stateBefore && selectedNode.metadata?.stateAfter && (
                      <div className="border-b border-border pb-4 mt-4 space-y-2">
                        <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">State Changes</div>
                        {Object.entries(selectedNode.metadata.stateBefore).map(([category, keys]) => {
                          const changes = [];
                          for (const [key, valBefore] of Object.entries(keys as any)) {
                            const valAfter = (selectedNode.metadata.stateAfter as any)?.[category]?.[key];
                            if (valBefore !== valAfter) {
                              changes.push({ key, before: valBefore, after: valAfter });
                            }
                          }
                          if (changes.length === 0) return null;
                          return (
                            <div key={category} className="text-xs bg-muted/20 p-2 border border-border">
                              <div className="font-bold mb-1 capitalize">{category}</div>
                              {changes.map(c => (
                                <div key={c.key} className="flex items-center gap-2 font-mono text-[10px]">
                                  <span>{c.key}:</span>
                                  <span className="text-muted-foreground">{String(c.before)}</span>
                                  <span>→</span>
                                  <span className={Number(c.after) > Number(c.before) ? 'text-green-500' : 'text-red-500'}>{String(c.after)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {selectedNode.kind === 'characterCluster' && Array.isArray(selectedNode.metadata?.characters) && (
                      <div className="border-b border-border pb-4 mt-4">
                        <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary mb-2">
                          Characters in cluster ({selectedNode.metadata.characters.length})
                        </div>
                        <div className="max-h-72 overflow-auto custom-scrollbar space-y-1">
                          {selectedNode.metadata.characters.map((c: { id: string; name: string }) => (
                            <Link
                              key={c.id}
                              href={`/characters/${c.id}`}
                              className="block text-xs font-mono truncate text-foreground hover:text-primary hover:underline"
                              title={c.name}
                            >
                              {c.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="pt-2">Internal ID: <span className="font-mono">{selectedNode.id}</span></p>
                    
                    {(selectedNode.kind === 'population' || selectedNode.kind === 'character' || selectedNode.kind === 'simulation' || selectedNode.kind === 'agent') && (
                      <div className="pt-4 border-t border-border flex justify-end">
                        <Link href={`/${selectedNode.kind}s/${selectedNode.id}`} className="text-xs font-mono font-bold text-primary hover:underline">
                          Open details →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedEdge ? (
                <div className="space-y-4 animate-in fade-in">
                  <div className="border border-border p-4 bg-muted/10">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest mb-1">Relationship</div>
                    <div className="text-lg font-bold uppercase tracking-wider">{selectedEdge.type}</div>
                  </div>
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground">Source:</span>
                      <span className="font-mono truncate w-48 text-right" title={selectedEdge.source}>{selectedEdge.source}</span>
                    </div>
                    <div className="flex justify-between border-b border-border pb-2">
                      <span className="text-muted-foreground">Target:</span>
                      <span className="font-mono truncate w-48 text-right" title={selectedEdge.target}>{selectedEdge.target}</span>
                    </div>
                    
                    {selectedEdge.metadata && Object.entries(selectedEdge.metadata).map(([k, v]) => (
                      <div key={k} className="border-b border-border pb-2">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{k}</div>
                        <div className="font-mono text-xs">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Network className="h-8 w-8 mb-4 opacity-50" />
                  <div className="font-mono text-sm uppercase tracking-widest">Select an Item</div>
                  <div className="text-xs mt-2 max-w-xs">Click a node to inspect its meaning and relationships.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
