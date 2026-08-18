import { Layout } from "@/components/layout";
import { IntentSelector } from "@/components/intent-selector";
import { useListWorkflows } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowRight, Clock, Workflow } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

export default function Home() {
  const { data: workflows, isLoading } = useListWorkflows();

  const activeWorkflows = workflows?.filter(w => w.status === 'running' || w.status === 'draft').slice(0, 3) || [];

  return (
    <Layout breadcrumbs={[{ label: "홈", href: "/" }]}>
      <div className="min-h-full flex flex-col">
        <IntentSelector isHome />
        
        {activeWorkflows.length > 0 && (
          <div className="w-full max-w-4xl mx-auto px-6 pb-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-muted-foreground">이어서 작업하기</h2>
              <Link href="/workflows" className="text-xs text-primary hover:underline flex items-center gap-1">
                전체 보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeWorkflows.map(workflow => (
                <Link key={workflow.id} href={`/workflows/${workflow.id}`}>
                  <div className="border bg-card p-4 hover:border-primary/50 transition-colors h-full flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono px-2 py-0.5 bg-muted rounded-sm text-muted-foreground">
                        {workflow.intent.outputType || "custom"}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true, locale: ko })}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm mb-1 truncate">{workflow.title}</h3>
                    <div className="mt-auto pt-4 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        진행 중
                      </div>
                      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ 
                            width: `${(workflow.steps.filter(s => s.status === 'complete').length / Math.max(workflow.steps.length, 1)) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
