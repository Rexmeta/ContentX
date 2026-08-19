import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useListEvaluations } from "@workspace/api-client-react";
import { BarChart, Loader2, PlayCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { format } from "date-fns";

export default function EvaluationsList() {
  const { data: evaluations, isLoading } = useListEvaluations({});

  return (
    <Layout 
      breadcrumbs={[{ label: "ContentX" }, { label: "Evaluations" }]}
      title={<div className="font-serif text-xl">Evaluations</div>}
    >
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <p className="text-muted-foreground text-sm">
          An Evaluation is an automated assessment of behavior, outcome, or persona fidelity for a simulation run.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {evaluations?.map(ev => {
              const avgScore = Object.values(ev.scores).reduce((a, b) => a + b, 0) / (Object.values(ev.scores).length || 1);
              const isGood = avgScore > 0.7;
              
              return (
                <Link 
                  key={ev.id} 
                  href={`/evaluations/${ev.id}`}
                  className="block border border-border bg-card rounded-xl p-4 hover:border-primary transition-colors cursor-pointer group flex flex-col"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-primary text-primary-foreground text-[9px] font-mono rounded-full px-2 py-0.5 uppercase tracking-widest">
                      {ev.kind}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{format(new Date(ev.createdAt), "MM/dd")}</span>
                  </div>
                  
                  <div className="mt-auto">
                    <div className="flex items-end gap-2 mb-2">
                      <span className={`text-3xl font-mono font-bold leading-none ${isGood ? 'text-primary' : 'text-amber-500'}`}>
                        {avgScore.toFixed(2)}
                      </span>
                      <span className="tech-label text-muted-foreground mb-1">Avg Score</span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground truncate border-t border-border pt-2 flex items-center gap-1.5">
                      <PlayCircle className="h-3 w-3" /> {ev.simulationId}
                    </div>
                  </div>
                </Link>
              );
            })}
            
            {evaluations?.length === 0 && (
              <EmptyState
                icon={BarChart}
                hint="결과 분석은 시뮬레이션이 완료된 뒤 만들어져요. 워크플로의 '결과 분석 보기' 단계에서 확인할 수 있어요."
              />
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
