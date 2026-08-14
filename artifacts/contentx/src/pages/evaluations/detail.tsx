import { Layout } from "@/components/layout";
import { Link, useRoute } from "wouter";
import {
  useGetEvaluation, getGetEvaluationQueryKey,
  useGetEvaluationLineage, getGetEvaluationLineageQueryKey,
} from "@workspace/api-client-react";
import type { AgentLineage } from "@workspace/api-client-react";
import { Loader2, PlayCircle, UserCircle, GitMerge, ArrowRight, CheckCircle2 } from "lucide-react";

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
        {/* Origin label — derived from a real evaluation record. */}
        <span className="text-primary">Origin: Evaluated</span>
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

        {/* Lineage (trust layer) */}
        <LineageSection evaluationId={id} />

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

// --- LINEAGE ---

interface LineageHopProps {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  testId: string;
}

function LineageHop({ label, value, sub, href, testId }: LineageHopProps) {
  const inner = (
    <div className="border border-border bg-card px-3 py-2 min-w-[140px] hover:border-primary transition-colors">
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold truncate max-w-[200px]" title={value}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-primary mt-0.5">{sub}</div>}
    </div>
  );
  if (href) {
    return <Link href={href} className="block" data-testid={testId}>{inner}</Link>;
  }
  return <div data-testid={testId}>{inner}</div>;
}

function AgentLineageChain({ agent, simulationId, simulationSeed, evaluationId, index }: {
  agent: AgentLineage;
  simulationId: string;
  simulationSeed: number;
  evaluationId: string;
  index: number;
}) {
  const reproducible =
    agent.populationVersion !== null && agent.seed !== null && simulationSeed !== null && simulationSeed !== undefined;

  const sourceValue = agent.sourceUri || agent.matraixId || "Unknown source";

  const hops: (LineageHopProps | null)[] = [
    {
      label: "Source",
      value: sourceValue,
      sub: agent.matraixId ? `MatrAIx ${agent.matraixId}` : undefined,
      testId: `hop-source-${index}`,
    },
    agent.importId
      ? { label: "Import", value: agent.importId, testId: `hop-import-${index}` }
      : null,
    {
      label: "Population",
      value: agent.populationId ?? "—",
      sub: agent.populationVersion !== null ? `Population v${agent.populationVersion}` : undefined,
      href: agent.populationId ? `/populations/${agent.populationId}` : undefined,
      testId: `hop-population-${index}`,
    },
    agent.samplingRunId
      ? {
          label: "Sampling Run",
          value: agent.samplingRunId,
          sub: agent.seed !== null ? `Seed ${agent.seed}` : undefined,
          testId: `hop-sampling-${index}`,
        }
      : null,
    {
      label: "Character",
      value: agent.characterId,
      href: `/characters/${agent.characterId}`,
      testId: `hop-character-${index}`,
    },
    {
      label: "Snapshot",
      value: agent.snapshotId,
      testId: `hop-snapshot-${index}`,
    },
    {
      label: "Agent",
      value: agent.agentId,
      href: `/agents/${agent.agentId}`,
      testId: `hop-agent-${index}`,
    },
    {
      label: "Simulation",
      value: simulationId,
      sub: `Seed ${simulationSeed}`,
      href: `/simulations/${simulationId}`,
      testId: `hop-simulation-${index}`,
    },
    {
      label: "Evaluation",
      value: evaluationId,
      href: `/evaluations/${evaluationId}`,
      testId: `hop-evaluation-${index}`,
    },
  ];

  const visibleHops = hops.filter((h): h is LineageHopProps => h !== null);

  return (
    <div className="border border-border bg-muted/10 p-4 space-y-3" data-testid={`lineage-agent-${index}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
          Agent {agent.agentId}
        </div>
        {reproducible && (
          <span
            className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-widest text-green-600 dark:text-green-500 border border-green-600/40 dark:border-green-500/40 px-2 py-0.5"
            data-testid={`badge-reproducible-${index}`}
          >
            <CheckCircle2 className="h-3 w-3" /> Reproducible
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {visibleHops.map((hop, i) => (
          <div key={hop.testId} className="flex items-center gap-2">
            <LineageHop {...hop} />
            {i < visibleHops.length - 1 && (
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LineageSection({ evaluationId }: { evaluationId: string }) {
  const { data: lineage, isLoading, error } = useGetEvaluationLineage(evaluationId, {
    query: { enabled: !!evaluationId, queryKey: getGetEvaluationLineageQueryKey(evaluationId), retry: false },
  });

  return (
    <div className="border border-border bg-card" data-testid="section-lineage">
      <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-2">
        <GitMerge className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest">Lineage</h3>
        <span className="text-[10px] text-muted-foreground font-mono ml-2">
          Real persisted provenance — source to evaluation
        </span>
      </div>
      <div className="p-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Resolving lineage...
          </div>
        ) : error ? (
          <div className="border border-destructive/50 bg-destructive/5 p-4 text-sm" data-testid="text-lineage-error">
            <div className="font-bold text-destructive mb-1">
              {(error as { status?: number }).status === 409 ? "Lineage broken" : "Lineage unavailable"}
            </div>
            <p className="text-muted-foreground text-xs font-mono">
              {(error as { data?: { error?: string } }).data?.error ||
                (error as Error).message ||
                "Unable to resolve lineage."}
            </p>
          </div>
        ) : lineage ? (
          <>
            {lineage.agents.map((agent, i) => (
              <AgentLineageChain
                key={agent.agentId}
                agent={agent}
                simulationId={lineage.simulationId}
                simulationSeed={lineage.simulationSeed}
                evaluationId={lineage.evaluationId}
                index={i}
              />
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
