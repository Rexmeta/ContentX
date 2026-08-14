import { Layout } from "@/components/layout";
import { Link, useRoute } from "wouter";
import { 
  useGetAgent, getGetAgentQueryKey,
  useListSimulations, getListSimulationsQueryKey
} from "@workspace/api-client-react";
import { Terminal, CheckCircle, BrainCircuit, Activity, Heart, Users, Target, Book } from "lucide-react";
import { format } from "date-fns";
import { useMemo } from "react";
import { formatDisplayName } from "@/lib/display-name";

export default function AgentDetail() {
  const [, params] = useRoute("/agents/:id");
  const id = params?.id || "";

  const { data: agent, isLoading } = useGetAgent(id, { query: { enabled: !!id, queryKey: getGetAgentQueryKey(id) } });
  const { data: allSimulations } = useListSimulations({ query: { enabled: !!id, queryKey: getListSimulationsQueryKey() } });

  const simulations = useMemo(() => {
    if (!allSimulations || !id) return [];
    return allSimulations.filter(s => s.participants?.some(p => p.agentId === id));
  }, [allSimulations, id]);

  if (isLoading) {
    return (
      <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Agents", href: "/agents" }, { label: "Loading..." }]}>
        <div className="flex h-full items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!agent) {
    return (
      <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Agents", href: "/agents" }, { label: "Not Found" }]}>
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-muted-foreground">Agent not found.</div>
        </div>
      </Layout>
    );
  }

  const contextHeader = (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold font-serif flex items-center gap-2" title={agent.name}>
          <Terminal className="h-6 w-6 text-primary" />
          {formatDisplayName(agent.name)}
        </h1>
        <div className="text-sm text-muted-foreground font-mono">ID: {agent.id}</div>
      </div>
    </div>
  );

  return (
    <Layout 
      breadcrumbs={[
        { label: "ContentX" }, 
        { label: "Agents", href: "/agents" }, 
        { label: formatDisplayName(agent.name) }
      ]}
      contextHeader={contextHeader}
    >
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-8">
            
            <section className="space-y-4">
              <h2 className="text-sm font-mono font-bold uppercase tracking-widest border-b border-border pb-2">Goals & Constraints</h2>
              <div className="space-y-4">
                {agent.goals?.map((goal, i) => (
                  <div key={i} className="border border-border p-4 bg-card">
                    <div className="font-bold flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-primary" /> Goal
                    </div>
                    <div className="text-sm">{goal.objective}</div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-2">PRIORITY: {goal.priority}</div>
                  </div>
                ))}
                
                {agent.constraints?.length > 0 && (
                  <div className="mt-6">
                    <div className="font-mono text-xs uppercase text-muted-foreground mb-2">Constraints</div>
                    <ul className="space-y-2">
                      {agent.constraints.map((c, i) => (
                        <li key={i} className="text-sm flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-destructive" />
                          <span className="font-bold">{c.type}:</span> {c.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-mono font-bold uppercase tracking-widest border-b border-border pb-2">AgentState (Mutable Runtime State)</h2>
              {agent.state ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Affective", key: "affective", icon: Heart },
                    { label: "Relational", key: "relational", icon: Users },
                    { label: "Motivational", key: "motivational", icon: Target },
                    { label: "Cognitive", key: "cognitive", icon: BrainCircuit },
                    { label: "Behavioral", key: "behavioral", icon: Activity }
                  ].map(({ label, key, icon: Icon }) => {
                    const stateObj = (agent.state as any)?.[key];
                    if (!stateObj) return null;
                    
                    return (
                      <div key={key} className="border border-border bg-card overflow-hidden">
                        <div className="bg-muted/30 px-3 py-2 border-b border-border flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            {label}
                          </div>
                          <div className="text-[9px] font-mono text-muted-foreground">v{stateObj.version}</div>
                        </div>
                        <div className="p-3 space-y-2">
                          {Object.entries(stateObj.values || {}).length > 0 ? (
                            Object.entries(stateObj.values).map(([vk, vv]) => (
                              <div key={vk} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground font-mono text-xs">{vk}</span>
                                <span className="font-mono font-bold">{String(vv)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground italic">No values</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic border border-border p-4 bg-card text-center">
                  State is uninitialized.
                </div>
              )}
            </section>
            
            <section className="space-y-4">
              <h2 className="text-sm font-mono font-bold uppercase tracking-widest border-b border-border pb-2">Memory</h2>
              <div className="border border-border bg-card p-4">
                {agent.memory?.length > 0 ? (
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                    {JSON.stringify(agent.memory, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm text-muted-foreground flex items-center gap-2 justify-center py-4">
                    <Book className="h-4 w-4" /> No memory entries.
                  </div>
                )}
              </div>
            </section>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="border border-border bg-card p-4">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-4">Provenance</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Character (Identity)</div>
                  {agent.provenance?.characterId ? (
                    <Link href={`/characters/${agent.provenance.characterId}`} className="text-sm font-mono text-primary hover:underline truncate block">
                      {agent.provenance.characterId}
                    </Link>
                  ) : <span className="text-sm text-muted-foreground">Unknown</span>}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Snapshot (Immutable State)</div>
                  <div className="text-sm font-mono truncate">{agent.provenance?.snapshotId || 'Unknown'}</div>
                </div>
              </div>
            </div>

            <div className="border border-border bg-card p-4">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-4">Configuration</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Policy</div>
                  <pre className="text-[10px] font-mono bg-muted/20 p-2 border border-border overflow-auto max-h-40">
                    {JSON.stringify(agent.policy, null, 2) || 'None'}
                  </pre>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Runtime Config</div>
                  <pre className="text-[10px] font-mono bg-muted/20 p-2 border border-border overflow-auto max-h-40">
                    {JSON.stringify(agent.runtimeConfig, null, 2) || 'None'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="border border-border bg-card p-4">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-4">Associated Simulations ({simulations.length})</h3>
              <div className="space-y-2">
                {simulations.length > 0 ? (
                  simulations.map(sim => (
                    <Link key={sim.id} href={`/simulations/${sim.id}`} className="block p-2 border border-border bg-muted/20 hover:border-primary transition-colors">
                      <div className="text-sm font-bold truncate" title={sim.name}>{formatDisplayName(sim.name)}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">Turns: {sim.turnsExecuted}</div>
                    </Link>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground italic">No simulations yet.</div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </Layout>
  );
}