import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useListCharacters, useListPopulations } from "@workspace/api-client-react";
import { UserCircle, Loader2, Eye } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatDisplayName } from "@/lib/display-name";

export default function CharactersList() {
  const { data: characters, isLoading } = useListCharacters({});
  const { data: populations } = useListPopulations();

  const popMap = new Map(populations?.map(p => [p.id, p.name]) || []);

  return (
    <Layout 
      breadcrumbs={[{ label: "ContentX" }, { label: "Characters" }]}
      title={<div className="font-bold text-lg">Characters</div>}
    >
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <p className="text-muted-foreground text-sm">
          A Character represents a persistent identity sampled from a Population. 
          When a simulation runs, it uses an immutable CharacterSnapshot to instantiate a runtime Agent.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {characters?.map(char => (
              <Link 
                key={char.id} 
                href={`/characters/${char.id}`}
                className="block border border-border bg-card hover:border-primary transition-colors cursor-pointer group flex flex-col"
              >
                <div className="p-4 border-b border-border flex-1">
                  <div className="font-bold text-lg group-hover:text-primary transition-colors mb-2" title={char.name}>{formatDisplayName(char.name)}</div>
                  
                  {char.provenance?.populationId && (
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <UserCircle className="h-3 w-3" />
                      <span title={popMap.get(char.provenance.populationId)}>POP: {formatDisplayName(popMap.get(char.provenance.populationId)) || "Unknown"}</span>
                    </div>
                  )}
                </div>
                <div className="bg-muted/10 p-3 text-xs font-mono text-muted-foreground flex justify-between items-center">
                  <span>SEED: {char.provenance?.seed || 'N/A'}</span>
                  <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Eye className="h-3 w-3" /> View Profile
                  </span>
                </div>
              </Link>
            ))}
            
            {characters?.length === 0 && (
              <EmptyState
                icon={UserCircle}
                hint="캐릭터(가상 고객)는 제품 반응 시뮬레이션 워크플로의 '가상 고객 만들기' 단계에서 생성돼요."
              />
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
