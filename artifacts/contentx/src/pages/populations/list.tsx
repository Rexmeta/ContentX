import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useListPopulations, getListPopulationsQueryKey } from "@workspace/api-client-react";
import { Users, Loader2, FileText } from "lucide-react";
import { format } from "date-fns";
import { formatDisplayName } from "@/lib/display-name";

export default function PopulationsList() {
  const { data: populations, isLoading } = useListPopulations();

  return (
    <Layout 
      breadcrumbs={[{ label: "ContentX" }, { label: "Populations" }]}
      title={<div className="font-bold text-lg">Populations</div>}
    >
      <div className="p-6 max-w-5xl mx-auto space-y-6">
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
                className="block border border-border bg-card p-4 hover:border-primary transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-[10px] font-mono text-primary uppercase tracking-widest mb-1">{pop.domain}</div>
                    <div className="font-bold text-lg group-hover:text-primary transition-colors" title={pop.name}>{formatDisplayName(pop.name)}</div>
                  </div>
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 border font-mono">v{pop.version}</span>
                </div>
                
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                  <span>{pop.dimensions.length} DIMENSIONS</span>
                  <span>UPDATED {format(new Date(pop.updatedAt), "MM/dd")}</span>
                </div>
              </Link>
            ))}
            
            {populations?.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center border border-dashed border-border p-12 text-center text-muted-foreground bg-muted/10">
                <Users className="h-8 w-8 mb-3 opacity-50" />
                <h3 className="font-bold mb-1">No Populations</h3>
                <p className="text-xs max-w-sm">Import a MatrAIx dataset to create populations.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
