import { Layout } from "@/components/layout";
import { Link, useRoute } from "wouter";
import { 
  useGetCharacter, getGetCharacterQueryKey,
  useListSnapshots, getListSnapshotsQueryKey,
  useListAgents, getListAgentsQueryKey,
  useGetPopulation, getGetPopulationQueryKey
} from "@workspace/api-client-react";
import { 
  Loader2, Network, UserCircle, ShieldAlert, Terminal, Lock
} from "lucide-react";
import { format } from "date-fns";

export default function CharacterDetail() {
  const [, params] = useRoute("/characters/:id");
  const id = params?.id || "";

  const { data: character, isLoading } = useGetCharacter(id, { query: { enabled: !!id, queryKey: getGetCharacterQueryKey(id) } });
  
  const popId = character?.provenance?.populationId;
  const { data: pop } = useGetPopulation(popId || "", { query: { enabled: !!popId, queryKey: getGetPopulationQueryKey(popId || "") } });
  
  const { data: allSnapshots } = useListSnapshots({ query: { enabled: !!id, queryKey: getListSnapshotsQueryKey() } });
  const { data: allAgents } = useListAgents({ query: { enabled: !!id, queryKey: getListAgentsQueryKey() } });
  
  const snapshots = allSnapshots?.filter(s => s.characterId === id) || [];
  const agents = allAgents?.filter(a => a.provenance?.characterId === id) || [];

  if (isLoading) {
    return (
      <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Characters", href: "/characters" }, { label: "Loading..." }]}>
        <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </Layout>
    );
  }

  if (!character) {
    return (
      <Layout breadcrumbs={[{ label: "ContentX" }, { label: "Characters", href: "/characters" }, { label: "Not Found" }]}>
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
          <div className="font-mono text-sm uppercase tracking-widest">Character not found</div>
          <p className="text-sm">This character does not exist or was deleted.</p>
        </div>
      </Layout>
    );
  }

  const contextHeader = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-serif">{character.name}</h1>
        <Link href={`/explorer?perspective=character&id=${id}`} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-1.5 text-xs font-bold font-mono tracking-widest hover:bg-primary/90 transition-colors">
          <Network className="h-4 w-4" /> View in Explorer
        </Link>
      </div>
      <div className="flex gap-4 text-xs font-mono text-muted-foreground uppercase tracking-widest">
        <span>Identity Record</span>
        <span>Population: {pop?.name || "Unknown"}</span>
        <span>Seed: {character.provenance.seed || "N/A"}</span>
      </div>
    </div>
  );

  return (
    <Layout 
      breadcrumbs={[{ label: "ContentX" }, { label: "Characters", href: "/characters" }, { label: character.name }]}
      contextHeader={contextHeader}
    >
      <div className="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Identity & Demographics */}
        <div className="lg:col-span-8 space-y-6">
          <div className="border border-border bg-card p-6">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest border-b border-border pb-2 mb-4 text-muted-foreground">Demographics & Attributes</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(character.attributes.identity || {}).map(([k, v]) => (
                <div key={k} className="bg-muted/10 p-3 border border-border">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">{k}</div>
                  <div className="text-sm font-semibold truncate" title={String(v)}>{String(v)}</div>
                </div>
              ))}
              {Object.entries(character.attributes.professional || {}).map(([k, v]) => (
                <div key={k} className="bg-muted/10 p-3 border border-border">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">{k}</div>
                  <div className="text-sm font-semibold truncate" title={String(v)}>{String(v)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card p-6">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest border-b border-border pb-2 mb-4 text-muted-foreground">Behavioral Profile</h3>
            
            <div className="space-y-4">
              {character.attributes.goals && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase mb-2">Goals</div>
                  <ul className="list-disc pl-4 space-y-1 text-sm">
                    {character.attributes.goals.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
              )}
              
              {character.attributes.constraints && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase mb-2">Constraints</div>
                  <ul className="list-disc pl-4 space-y-1 text-sm text-secondary">
                    {character.attributes.constraints.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Snapshots & Agents */}
        <div className="lg:col-span-4 space-y-6">
          <div className="border border-border bg-card">
            <div className="p-4 border-b border-border bg-muted/30">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" /> CharacterSnapshots
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">Immutable resolved states for simulation.</p>
            </div>
            <div className="p-4 space-y-3">
              {snapshots?.map((snap, i) => (
                <div key={snap.id} className="border border-border p-3 text-xs bg-muted/10 font-mono">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-foreground">v{snapshots.length - i}</span>
                    <span className="text-muted-foreground">{format(new Date(snap.createdAt), "MM/dd HH:mm")}</span>
                  </div>
                  <div className="text-muted-foreground truncate">{snap.id}</div>
                </div>
              ))}
              {(!snapshots || snapshots.length === 0) && (
                <div className="text-xs text-muted-foreground text-center py-4">No snapshots taken yet.</div>
              )}
            </div>
          </div>

          <div className="border border-border bg-card">
            <div className="p-4 border-b border-border bg-muted/30">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest flex items-center gap-2">
                <Terminal className="h-4 w-4 text-secondary" /> Runtime Agents
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">Actors instantiated from snapshots.</p>
            </div>
            <div className="p-4 space-y-3">
              {agents?.map(agent => (
                <div key={agent.id} className="border border-secondary/30 p-3 text-xs bg-secondary/5 font-mono">
                  <div className="font-bold text-secondary mb-1 truncate">{agent.name}</div>
                  <div className="text-muted-foreground truncate" title={agent.id}>{agent.id}</div>
                </div>
              ))}
              {(!agents || agents.length === 0) && (
                <div className="text-xs text-muted-foreground text-center py-4">No agents active.</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
