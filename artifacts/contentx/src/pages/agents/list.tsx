import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useListAgents, getListAgentsQueryKey } from "@workspace/api-client-react";
import { Terminal, Users, Database } from "lucide-react";
import { format } from "date-fns";
import { formatDisplayName } from "@/lib/display-name";
import { EmptyState } from "@/components/empty-state";

export default function AgentsList() {
  const { data: agents, isLoading } = useListAgents({ query: { queryKey: getListAgentsQueryKey() } });

  const header = (
    <div className="space-y-1">
      <h1 className="text-xl font-bold font-serif flex items-center gap-2">
        <Terminal className="h-5 w-5 text-primary" />
        Runtime Agents
      </h1>
      <p className="text-sm text-muted-foreground">
        An Agent is a runtime actor instantiated from an immutable CharacterSnapshot; its mutable runtime state is the AgentState.
      </p>
    </div>
  );

  return (
    <Layout 
      breadcrumbs={[{ label: "ContentX" }, { label: "Agents" }]}
      contextHeader={header}
    >
      <div className="p-8 max-w-5xl mx-auto">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !agents || agents.length === 0 ? (
          <EmptyState
            icon={Terminal}
            hint="에이전트는 시뮬레이션이 시작될 때 자동으로 준비돼요. 제품 반응 시뮬레이션 워크플로를 실행해보세요."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Link key={agent.id} href={`/agents/${agent.id}`}>
                <div className="border border-border bg-card hover:border-primary transition-colors cursor-pointer flex flex-col h-full">
                  <div className="p-4 border-b border-border bg-muted/20">
                    <div className="font-bold text-lg" title={agent.name}>{formatDisplayName(agent.name)}</div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                      Goals: {agent.goals?.length || 0}
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 space-y-4">
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground mb-1">PROVENANCE</div>
                      <div className="text-sm border-l-2 border-primary pl-2 space-y-1">
                        <div className="truncate" title={agent.provenance?.snapshotId}>
                          <span className="text-muted-foreground">Snapshot:</span> <span className="font-mono text-xs">{agent.provenance?.snapshotId?.substring(0,8)}...</span>
                        </div>
                        <div className="truncate" title={agent.provenance?.characterId}>
                          <span className="text-muted-foreground">Character:</span> <span className="font-mono text-xs">{agent.provenance?.characterId?.substring(0,8)}...</span>
                        </div>
                      </div>
                    </div>
                    
                    {agent.createdAt && (
                      <div className="text-xs text-muted-foreground mt-auto pt-4">
                        Instantiated: {format(new Date(agent.createdAt), "PPp")}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}