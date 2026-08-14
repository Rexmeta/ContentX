import { Layout } from "@/components/layout";
import { Link, useRoute } from "wouter";
import { useGetEvaluation, getGetEvaluationQueryKey } from "@workspace/api-client-react";
import { Loader2, PlayCircle, UserCircle } from "lucide-react";

export default function EvaluationDetail() {
  const [, params] = useRoute("/evaluations/:id");
  const id = params?.id || "";

  const { data: evaluation, isLoading } = useGetEvaluation(id, { query: { enabled: !!id, queryKey: getGetEvaluationQueryKey(id) } });

  if (isLoading) {
    return (
      <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Evaluations", href: "/evaluations" }, { label: "Loading..." }]}>
        <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </Layout>
    );
  }

  if (!evaluation) {
    return (
      <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Evaluations", href: "/evaluations" }, { label: "Not Found" }]}>
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
          <div className="font-mono text-sm uppercase tracking-widest">Evaluation not found</div>
          <p className="text-sm">This evaluation does not exist or was deleted.</p>
        </div>
      </Layout>
    );
  }

  const contextHeader = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-serif uppercase tracking-wider">{evaluation.kind} Evaluation</h1>
        <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 font-mono font-bold">
          {evaluation.provenance.evaluator} v{evaluation.provenance.evaluatorVersion}
        </div>
      </div>
      <div className="flex gap-4 text-xs font-mono text-muted-foreground uppercase tracking-widest">
        <span>Simulation: {evaluation.simulationId}</span>
        <span>Events Analysed: {evaluation.provenance.traceEventCount}</span>
      </div>
    </div>
  );

  return (
    <Layout 
      breadcrumbs={[{ label: "ContentX" }, { label: "Evaluations", href: "/evaluations" }, { label: evaluation.id }]}
      contextHeader={contextHeader}
    >
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        
        {/* Subject Context */}
        <div className="border border-border bg-card p-4 flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Subject:</span>
          {evaluation.subjectType === 'simulation' ? (
            <Link href={`/simulations/${evaluation.subjectId}`} className="text-sm font-bold flex items-center gap-1.5 hover:text-primary transition-colors">
              <PlayCircle className="h-4 w-4" /> {evaluation.subjectId}
            </Link>
          ) : (
            <Link href={`/agents/${evaluation.subjectId}`} className="text-sm font-bold flex items-center gap-1.5 hover:text-primary transition-colors">
              <UserCircle className="h-4 w-4" /> {evaluation.subjectId}
            </Link>
          )}
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(evaluation.scores).map(([dimension, score]) => (
            <div key={dimension} className="border border-border bg-card p-4 text-center">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3 truncate">{dimension}</div>
              <div className={`text-4xl font-mono font-bold ${(score as number) > 0.7 ? 'text-primary' : 'text-orange-500'}`}>
                {(score as number).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Findings Log */}
        <div className="border border-border bg-card">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest">Evaluation Findings</h3>
          </div>
          <div className="p-6">
            <pre className="text-xs font-mono bg-background border border-border p-4 overflow-auto max-h-[400px] text-muted-foreground leading-relaxed custom-scrollbar">
              {JSON.stringify(evaluation.findings, null, 2)}
            </pre>
          </div>
        </div>

      </div>
    </Layout>
  );
}
