import { Layout } from "@/components/layout";
import { Link, useRoute } from "wouter";
import { 
  useGetSimulation, getGetSimulationQueryKey,
  useListSimulationEvents, getListSimulationEventsQueryKey
} from "@workspace/api-client-react";
import { 
  Loader2, Network, MessageSquare, ArrowRight, Zap, Target, Activity
} from "lucide-react";
import { format } from "date-fns";

export default function SimulationDetail() {
  const [, params] = useRoute("/simulations/:id");
  const id = params?.id || "";

  const { data: sim, isLoading } = useGetSimulation(id, { query: { enabled: !!id, queryKey: getGetSimulationQueryKey(id) } });
  const { data: events } = useListSimulationEvents(id, { query: { enabled: !!id, queryKey: getListSimulationEventsQueryKey(id) } });

  if (isLoading) {
    return (
      <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Simulations", href: "/simulations" }, { label: "Loading..." }]}>
        <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </Layout>
    );
  }

  if (!sim) {
    return (
      <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Simulations", href: "/simulations" }, { label: "Not Found" }]}>
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
          <div className="font-mono text-sm uppercase tracking-widest">Simulation not found</div>
          <p className="text-sm">This simulation does not exist or was deleted.</p>
        </div>
      </Layout>
    );
  }

  const contextHeader = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-serif">{sim.name}</h1>
        <Link href={`/explorer?perspective=simulation&id=${id}`} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-1.5 text-xs font-bold font-mono tracking-widest hover:bg-primary/90 transition-colors">
          <Network className="h-4 w-4" /> View Runtime Graph
        </Link>
      </div>
      <div className="flex gap-4 text-xs font-mono text-muted-foreground uppercase tracking-widest">
        <span>Topic: {sim.config.topic}</span>
        <span>Seed: {sim.seed}</span>
        <span>{sim.turnsExecuted} Turns</span>
        <span className={sim.status === 'completed' ? 'text-green-500' : 'text-destructive'}>Status: {sim.status}</span>
      </div>
    </div>
  );

  return (
    <Layout 
      breadcrumbs={[{ label: "ContentX" }, { label: "Simulations", href: "/simulations" }, { label: sim.name }]}
      contextHeader={contextHeader}
    >
      <div className="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Setup & Outcome */}
        <div className="lg:col-span-4 space-y-6">
          <div className="border border-border bg-card p-5">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest border-b border-border pb-2 mb-4 text-muted-foreground">Participants</h3>
            <div className="space-y-3">
              {sim.participants.map(p => (
                <div key={p.agentId} className="bg-muted/20 border border-border p-3">
                  <div className="font-bold text-sm">{p.name}</div>
                  <div className="text-[10px] font-mono text-secondary uppercase mt-1">{p.role}</div>
                </div>
              ))}
            </div>
          </div>

          {sim.outcome && (
            <div className="border border-border bg-card p-5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest border-b border-border pb-2 mb-4 text-muted-foreground">Simulation Outcome</h3>
              <div className="space-y-3 text-sm">
                <p className="leading-relaxed">{sim.outcome.summary}</p>
                <div className="flex justify-between items-center py-2 border-y border-border">
                  <span className="font-mono text-xs uppercase text-muted-foreground">Agreement</span>
                  <span className="font-bold">{sim.outcome.agreementReached ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="font-mono text-xs uppercase text-muted-foreground">Final Gap</span>
                  <span className="font-mono font-bold">{sim.outcome.finalGap.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Event Trace */}
        <div className="lg:col-span-8">
          <div className="border border-border bg-card h-full max-h-[800px] flex flex-col">
            <div className="p-4 border-b border-border bg-muted/30">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest">Behavior Trace</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {events?.map((ev) => {
                const actor = sim.participants.find(p => p.agentId === ev.actorId);
                
                let icon = <Zap className="h-4 w-4" />;
                if (ev.type === 'utterance') icon = <MessageSquare className="h-4 w-4" />;
                if (ev.type === 'decision') icon = <Target className="h-4 w-4" />;

                return (
                  <div key={ev.id} className="flex gap-4">
                    <div className="w-12 pt-1 font-mono text-[10px] text-muted-foreground text-right shrink-0">
                      T{ev.turn}.{ev.sequence}
                    </div>
                    <div className="flex-1 border border-border bg-background p-4 relative group">
                      <div className="flex items-center gap-2 mb-2">
                        {icon}
                        <span className="font-bold text-sm">{actor?.name || "System"}</span>
                        <span className="text-[9px] font-mono bg-muted px-1 border uppercase text-muted-foreground">{ev.type}</span>
                      </div>
                      
                      {ev.type === 'utterance' && Boolean(ev.payload.text) && (
                        <div className="text-sm font-serif italic border-l-2 border-secondary pl-3 text-muted-foreground">
                          "{String(ev.payload.text)}"
                        </div>
                      )}
                      
                      {ev.type === 'action' && Boolean(ev.payload.description) && (
                        <div className="text-sm text-foreground">
                          {String(ev.payload.description)}
                        </div>
                      )}
                      
                      {ev.type === 'decision' && (
                        <div className="bg-primary/5 border border-primary/20 p-2 text-xs font-mono">
                          <span className="text-primary font-bold">DECISION:</span> {JSON.stringify(ev.payload)}
                        </div>
                      )}
                      
                      {ev.stateBefore && ev.stateAfter && (
                        <div className="mt-4 pt-3 border-t border-border grid gap-2">
                          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary flex items-center gap-1">
                            <Activity className="h-3 w-3" /> State Changes ({actor?.name || "Agent"})
                          </div>
                          {Object.entries(ev.stateBefore).map(([category, keys]) => {
                            const changes = [];
                            for (const [key, valBefore] of Object.entries(keys as any)) {
                              const valAfter = (ev.stateAfter as any)?.[category]?.[key];
                              if (valBefore !== valAfter) {
                                changes.push({ key, before: valBefore, after: valAfter });
                              }
                            }
                            if (changes.length === 0) return null;
                            return (
                              <div key={category} className="text-xs bg-muted/20 p-2 border border-border">
                                <div className="font-bold mb-1 capitalize text-[10px]">{category}</div>
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
                    </div>
                  </div>
                );
              })}
              
              {(!events || events.length === 0) && (
                <div className="text-center text-muted-foreground p-8 font-mono text-sm">
                  No trace events recorded.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
