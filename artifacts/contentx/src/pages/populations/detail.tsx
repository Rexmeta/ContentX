import { Layout } from "@/components/layout";
import { Link, useRoute } from "wouter";
import { 
  useGetPopulation, getGetPopulationQueryKey,
  useListDimensions, getListDimensionsQueryKey,
  useListDependencyRules, getListDependencyRulesQueryKey,
  useListCharacters, getListCharactersQueryKey
} from "@workspace/api-client-react";
import { 
  Users, Loader2, ArrowRight, GitBranch, TableProperties, Network
} from "lucide-react";
import { format } from "date-fns";
import { StableGraph, GraphNode, GraphEdge } from "@/components/stable-graph";
import { computePopulationLayout } from "@/lib/graph-layout";
import { useMemo, useState } from "react";

export default function PopulationDetail() {
  const [, params] = useRoute("/populations/:id");
  const id = params?.id || "";

  const { data: pop, isLoading: isPopLoading } = useGetPopulation(id, { query: { enabled: !!id, queryKey: getGetPopulationQueryKey(id) } });
  const { data: allDimensions } = useListDimensions({ query: { enabled: !!id, queryKey: getListDimensionsQueryKey() } });
  const { data: rules } = useListDependencyRules(id, { query: { enabled: !!id, queryKey: getListDependencyRulesQueryKey(id) } });
  const { data: allCharacters } = useListCharacters({ query: { enabled: !!id, queryKey: getListCharactersQueryKey() } });
  
  const characters = useMemo(() => allCharacters?.filter(c => c.provenance?.populationId === id) || [], [allCharacters, id]);

  // The dimensions endpoint is a global registry; scope it to the dimensions
  // this population actually declares (Population.dimensions holds names/ids).
  const dimensions = useMemo(() => {
    if (!allDimensions || !pop) return allDimensions;
    const declared = new Set(pop.dimensions);
    return allDimensions.filter(d => declared.has(d.name) || declared.has(d.id));
  }, [allDimensions, pop]);

  const { nodes, edges } = useMemo(() => {
    if (!pop || !dimensions || !rules || !characters) return { nodes: [], edges: [] };
    return computePopulationLayout(pop, dimensions, rules, characters);
  }, [pop, dimensions, rules, characters]);

  const [selectionId, setSelectionId] = useState<string | null>(null);
  const selectedNode = nodes.find(n => n.id === selectionId);
  const selectedCluster = selectedNode?.kind === 'characterCluster' && Array.isArray((selectedNode as any).metadata?.characters)
    ? selectedNode as GraphNode & { metadata: { count: number; characters: { id: string; name: string }[] } }
    : null;

  if (!isPopLoading && !pop) {
    return (
      <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Populations", href: "/populations" }, { label: "Not Found" }]}>
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
          <div className="font-mono text-sm uppercase tracking-widest">Population not found</div>
          <p className="text-sm">This population does not exist or was deleted.</p>
        </div>
      </Layout>
    );
  }

  if (isPopLoading || !pop) {
    return (
      <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Populations", href: "/populations" }, { label: "Loading..." }]}>
        <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </Layout>
    );
  }

  const contextHeader = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-serif">{pop.name}</h1>
        <Link href={`/explorer?perspective=population&id=${id}`} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-1.5 text-xs font-bold font-mono tracking-widest hover:bg-primary/90 transition-colors">
          <Network className="h-4 w-4" /> View in Explorer
        </Link>
      </div>
      <div className="flex gap-4 text-xs font-mono text-muted-foreground uppercase tracking-widest">
        <span>MatrAIx Source</span>
        <span>Version {pop.version}</span>
        <span>{dimensions?.length || 0} Dimensions</span>
        <span>{rules?.length || 0} Dependency Rules</span>
        <span>{characters?.length || 0} Sampled Characters</span>
      </div>
    </div>
  );

  return (
    <Layout 
      breadcrumbs={[{ label: "ContentX" }, { label: "Populations", href: "/populations" }, { label: pop.name }]}
      contextHeader={contextHeader}
    >
      <div className="h-full flex overflow-hidden">
        {/* Simplified preview graph taking up 60% of the screen */}
        <div className="flex-1 relative border-r border-border bg-background">
          <StableGraph 
            nodes={nodes} 
            edges={edges}
            selectionId={selectionId}
            onSelectNode={(nodeId) => setSelectionId(nodeId)}
            onEmptyClick={() => setSelectionId(null)}
          />
        </div>
        
        {/* Right side inspector content lists */}
        <div className="w-[450px] flex flex-col bg-card overflow-auto custom-scrollbar">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest flex items-center gap-2">
              <TableProperties className="h-4 w-4" /> Dimensions & Rules
            </h3>
          </div>
          
          <div className="p-4 space-y-4">
            {dimensions?.map(dim => (
              <div key={dim.id} className="border border-border p-3 text-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold">{dim.name}</div>
                  <span className="text-[10px] font-mono bg-muted px-1 border uppercase">{dim.dataType}</span>
                </div>
                <div className="text-xs text-muted-foreground mb-2">{dim.category}</div>
                
                {/* Find rules affecting this dimension */}
                {rules?.filter(r => r.targetDimension === dim.id).map(rule => {
                  const srcDim = dimensions.find(d => d.id === rule.sourceDimension);
                  return (
                    <div key={rule.id} className="mt-2 bg-muted/20 border-l-2 border-secondary pl-2 py-1 text-xs font-mono text-muted-foreground flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3 text-secondary" /> 
                        <span className="text-foreground">{srcDim?.name}</span> influences <span className="text-foreground">{dim.name}</span>
                      </div>
                      <div className="pl-4 opacity-70">
                         {JSON.stringify(rule.conditions)} → {JSON.stringify(rule.effect)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {selectedCluster && (
            <>
              <div className="p-4 border-y border-border bg-muted/30">
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-primary">
                  Selected Cluster · {selectedCluster.metadata.characters.length} Characters
                </h3>
              </div>
              <div className="p-4 max-h-80 overflow-auto custom-scrollbar space-y-1">
                {selectedCluster.metadata.characters.map(c => (
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
            </>
          )}

          <div className="p-4 border-y border-border bg-muted/30 mt-auto">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest">Sampled Characters</h3>
          </div>
          
          <div className="p-4 space-y-2">
            {characters?.slice(0, 5).map(char => (
              <Link key={char.id} href={`/characters/${char.id}`} className="block border border-border p-2 hover:border-primary transition-colors text-sm font-semibold">
                {char.name}
              </Link>
            ))}
            {(characters?.length || 0) > 5 && (
              <Link href="/characters" className="block text-xs font-mono text-primary hover:underline text-center pt-2">
                View all {characters?.length} characters →
              </Link>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
