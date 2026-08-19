import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useListPopulations, getListPopulationsQueryKey } from "@workspace/api-client-react";
import { Users, Loader2, FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { format } from "date-fns";
import { formatDisplayName } from "@/lib/display-name";

export default function PopulationsList() {
  const { data: populations, isLoading } = useListPopulations();

  return (
    <Layout 
      breadcrumbs={[{ label: "ContentX" }, { label: "Populations" }]}
      title={<div className="font-serif text-xl">Populations</div>}
    >
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <p className="text-muted-foreground text-sm">
          A Population is a statistical / generative definition of a group. It defines the probability distributions 
          and dependency rules that guide the sampling of specific Characters.
        </p>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {populations?.map(pop => (
              <Link 
                key={pop.id} 
                href={`/populations/${pop.id}`}
                className="block border border-border bg-card rounded-xl p-4 hover:border-primary transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div>
                    <div className="tech-label text-primary mb-1">{pop.domain}</div>
                    <div className="font-bold text-lg group-hover:text-primary transition-colors" title={pop.name}>{formatDisplayName(pop.name)}</div>
                  </div>
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full border border-border font-mono shrink-0">v{pop.version}</span>
                </div>
                
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                  <span>{pop.dimensions.length} DIMENSIONS</span>
                  <span>UPDATED {format(new Date(pop.updatedAt), "MM/dd")}</span>
                </div>
              </Link>
            ))}
            
            {populations?.length === 0 && (
              <EmptyState
                icon={Users}
                hint="가상 인구는 제품 반응 시뮬레이션 워크플로를 실행하면 자동으로 만들어져요."
              />
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
