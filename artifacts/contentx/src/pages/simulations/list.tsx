import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useListSimulations } from "@workspace/api-client-react";
import { PlayCircle, Loader2, CheckCircle, XCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { format } from "date-fns";
import { formatDisplayName } from "@/lib/display-name";

export default function SimulationsList() {
  const { data: simulations, isLoading } = useListSimulations();

  return (
    <Layout 
      breadcrumbs={[{ label: "ContentX" }, { label: "Simulations" }]}
      title={<div className="font-serif text-xl">Simulations</div>}
    >
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <p className="text-muted-foreground text-sm">
          A Simulation is an execution environment where runtime Agents (derived from CharacterSnapshots) 
          interact according to policies, taking turns and producing a Behavior Trace.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {simulations?.map(sim => (
              <Link 
                key={sim.id} 
                href={`/simulations/${sim.id}`}
                className="block border border-border bg-card rounded-xl overflow-hidden hover:border-primary transition-colors cursor-pointer flex flex-col group"
              >
                <div className="p-4 border-b border-border">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="font-bold text-lg group-hover:text-primary transition-colors" title={sim.name}>{formatDisplayName(sim.name)}</div>
                    {sim.status === 'completed' ? (
                      <span className="flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest shrink-0">
                        <CheckCircle className="h-3 w-3" /> Completed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest shrink-0">
                        <XCircle className="h-3 w-3" /> Failed
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-muted-foreground uppercase">{sim.config.topic}</div>
                </div>
                <div className="p-3 bg-muted/10 flex justify-between items-center text-xs font-mono text-muted-foreground">
                  <span>{sim.participants.length} AGENTS</span>
                  <span>{sim.turnsExecuted} TURNS</span>
                  <span>{format(new Date(sim.createdAt), "MM/dd HH:mm")}</span>
                </div>
              </Link>
            ))}
            
            {simulations?.length === 0 && (
              <EmptyState
                icon={PlayCircle}
                hint="시뮬레이션은 제품 반응 시뮬레이션 워크플로를 끝까지 실행하면 만들어져요."
              />
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
