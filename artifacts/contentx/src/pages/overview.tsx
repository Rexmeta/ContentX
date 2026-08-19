import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { 
  useGetDashboardSummary, 
  useListPopulations,
  useListDimensions,
  useListDependencyRules, getListDependencyRulesQueryKey,
  useListCharacters,
  useListSnapshots,
  useListAgents,
  useListSimulations,
  useListEvaluations
} from "@workspace/api-client-react";
import { 
  Database, Users, UserCircle, PlayCircle, BarChart, 
  ArrowRight, Terminal, Activity, FileText
} from "lucide-react";
import { useMemo } from "react";

export default function Overview() {
  const { data: summary } = useGetDashboardSummary();
  const { data: pops } = useListPopulations();
  const { data: dims } = useListDimensions();
  const firstPopId = pops?.[0]?.id || "";
  const { data: rules1 } = useListDependencyRules(firstPopId, { query: { enabled: !!firstPopId, queryKey: getListDependencyRulesQueryKey(firstPopId) } });
  const { data: chars } = useListCharacters();
  const { data: snaps } = useListSnapshots();
  const { data: agents } = useListAgents();
  const { data: sims } = useListSimulations();
  const { data: evals } = useListEvaluations({});

  const evalStats = useMemo(() => {
    if (!evals || evals.length === 0) return [];
    const kinds = Array.from(new Set(evals.map(e => e.kind)));
    return kinds.map(kind => {
      const kindEvals = evals.filter(e => e.kind === kind);
      let totalScore = 0;
      let count = 0;
      kindEvals.forEach(ev => {
        const scores = Object.values(ev.scores);
        if (scores.length > 0) {
          totalScore += scores.reduce((a, b) => a + b, 0) / scores.length;
          count++;
        }
      });
      return {
        label: `${kind} Avg`,
        value: count > 0 ? (totalScore / count).toFixed(2) : "0.00"
      };
    });
  }, [evals]);

  // BEHAVIOR aggregate: prefer explicit interaction counts, otherwise the
  // turns executed across simulations. Both are real values from the
  // simulations list — never synthesized.
  const totalTurns = useMemo(
    () => sims?.reduce((acc, s) => acc + s.turnsExecuted, 0) || 0,
    [sims]
  );

  const stages = [
    {
      id: "source",
      title: "SOURCE",
      name: "MatrAIx or another source",
      icon: Database,
      href: "/world",
      metrics: [
        { label: "Content Graphs", value: summary?.contentCount || 0 },
        { label: "Entities", value: summary?.entityCount || 0 },
      ]
    },
    {
      id: "population",
      title: "POPULATION",
      name: "Populations",
      icon: Users,
      href: "/populations",
      metrics: [
        { label: "Populations", value: pops?.length || 0 },
        { label: "Dimensions", value: dims?.length || 0 },
        { label: "Rules (1st Pop)", value: rules1?.length || 0 },
      ]
    },
    {
      id: "character",
      title: "CHARACTERS",
      name: "Characters",
      icon: UserCircle,
      href: "/characters",
      metrics: [
        { label: "Characters", value: chars?.length || 0 },
        { label: "Snapshots", value: snaps?.length || 0 },
      ]
    },
    {
      id: "agent",
      title: "AGENTS",
      name: "Runtime Agents",
      icon: Terminal,
      href: "/agents",
      metrics: [
        { label: "Active Instances", value: agents?.length || 0 },
      ]
    },
    {
      id: "simulation",
      title: "SIMULATION",
      name: "Simulations",
      icon: PlayCircle,
      href: "/simulations",
      metrics: [
        { label: "Simulations Run", value: sims?.length || 0 },
        { label: "Turns Executed", value: totalTurns }
      ]
    },
    {
      id: "behavior",
      title: "BEHAVIOR",
      name: "Interaction Traces",
      icon: Activity,
      href: "/simulations",
      metrics: [
        { label: "Turns Executed", value: totalTurns },
        { label: "Completed Runs", value: sims?.filter((s) => s.status === "completed").length || 0 }
      ]
    },
    {
      id: "evaluation",
      title: "EVALUATION",
      name: "Evaluations",
      icon: BarChart,
      href: "/evaluations",
      metrics: [
        { label: "Total Evals", value: evals?.length || 0 },
        ...evalStats
      ]
    },
    {
      id: "content",
      title: "CONTENT",
      name: "Projection Targets",
      icon: FileText,
      href: "/world",
      metrics: [
        { label: "Roleplay", value: "Available" },
        { label: "Novel", value: "Available" },
        { label: "Business Scenario", value: "Available" }
      ]
    }
  ];

  const trustSteps = [
    "SOURCE",
    "STRUCTURED DATA",
    "VALIDATION",
    "TRANSFORMATION",
    "SIMULATION",
    "EVALUATION",
  ];

  const header = (
    <div className="space-y-1">
      <h1 className="headline-lg">ContentX Journey</h1>
      <p className="text-xs md:text-sm font-mono text-muted-foreground break-words">
        SOURCE → POPULATION → CHARACTERS → AGENTS → SIMULATION → BEHAVIOR → EVALUATION → CONTENT
      </p>
    </div>
  );

  return (
    <Layout 
      breadcrumbs={[{ label: "ContentX" }, { label: "Overview" }]}
      contextHeader={header}
    >
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 md:space-y-10">

        {/* What is ContentX? */}
        <div className="border border-border bg-card rounded-xl p-5 md:p-6" data-testid="text-product-statement">
          <div className="tech-label text-primary mb-2">
            What is ContentX?
          </div>
          <h2 className="headline-lg mb-3">AI-native World &amp; Content Intelligence Engine</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            ContentX is an AI-native World &amp; Content Intelligence Engine that represents people
            and worlds as structured data, simulates behavior, evaluates outcomes, and transforms
            the result into multiple forms of content.
          </p>
        </div>

        {/* Trust strip */}
        <div className="border border-border bg-muted/20 rounded-xl p-4" data-testid="strip-trust">
          <div className="tech-label text-muted-foreground mb-3">
            Trust
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {trustSteps.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider border border-border bg-card rounded-full px-2.5 py-1">
                  {step}
                </span>
                {i < trustSteps.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Every artifact is traceable from its source through structured data, validation, and
            transformation to simulated behavior and its evaluation.
          </p>
        </div>

        <div className="relative">
          {/* Vertical connecting line (desktop only) */}
          <div className="hidden md:block absolute left-8 top-12 bottom-12 w-px bg-border"></div>

          <div className="space-y-6 md:space-y-12">
            {stages.map((stage) => {
              const Icon = stage.icon;
              return (
                <div key={stage.id} className="relative flex items-start gap-4 md:gap-8 group">
                  <div className="relative z-10 hidden md:flex h-16 w-16 shrink-0 items-center justify-center border rounded-xl bg-card group-hover:border-primary transition-colors">
                    <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  
                  <Link href={stage.href} className="flex-1 block min-w-0" data-testid={`link-stage-${stage.id}`}>
                    <div className="border border-border bg-card rounded-xl p-5 md:p-6 hover:border-primary hover:shadow-sm transition-all cursor-pointer">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3">
                          <div className="md:hidden mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border rounded-lg bg-muted/40">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="tech-label text-primary mb-1">
                              {stage.title}
                            </div>
                            <h2 className="text-lg md:text-xl font-serif">{stage.name}</h2>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all translate-x-2 group-hover:translate-x-0" />
                      </div>
                      
                      <div className="flex flex-wrap gap-x-8 md:gap-x-12 gap-y-4">
                        {stage.metrics.map((m, i) => (
                          <div key={i} className="space-y-1">
                            <div className="text-2xl font-mono font-medium">{m.value}</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
