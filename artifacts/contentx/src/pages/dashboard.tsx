import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useListContent, 
  useGetDashboardSummary, 
  useCreateContent, 
  useDeleteContent 
} from "@workspace/api-client-react";
import { 
  Database, 
  Network, 
  Activity, 
  Box, 
  Trash2, 
  Plus, 
  ArrowRight,
  Loader2,
  Terminal
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: contents, isLoading: isContentsLoading, refetch: refetchContents } = useListContent();
  const createContent = useCreateContent();
  const deleteContent = useDeleteContent();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    createContent.mutate(
      { data: { prompt, title: title.trim() || undefined } },
      {
        onSuccess: (newGraph) => {
          toast({ title: "Content graph generated successfully" });
          setLocation(`/content/${newGraph.id}`);
        },
        onError: (err) => {
          toast({ 
            title: "Failed to generate content", 
            description: err.message, 
            variant: "destructive" 
          });
        }
      }
    );
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this content graph? This action is irreversible.")) {
      deleteContent.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: "Content deleted successfully" });
            refetchContents();
          }
        }
      );
    }
  };

  return (
    <div className="min-h-screen bg-background relative selection:bg-primary/20">
      {/* Background Texture */}
      <div className="fixed inset-0 bg-noise z-0"></div>
      
      {/* Header */}
      <header className="relative z-10 border-b border-border bg-card/80 backdrop-blur-sm h-16 flex items-center px-6">
        <div className="flex items-center gap-3 text-primary">
          <Terminal className="h-6 w-6" />
          <h1 className="text-xl font-bold tracking-tight">CONTENT<span className="text-foreground">X</span></h1>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Generator & Stats */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Generator Panel */}
          <div className="border border-border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">
              Generate Structure
            </h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-xs font-semibold mb-1">Title (Optional)</label>
                <input 
                  id="title"
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Project Orion"
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <div>
                <label htmlFor="prompt" className="block text-xs font-semibold mb-1">Source Prompt</label>
                <textarea 
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the narrative, constraints, or relationships..."
                  rows={5}
                  required
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none font-mono"
                />
              </div>
              <button 
                type="submit"
                disabled={createContent.isPending || !prompt.trim()}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground h-10 px-4 font-semibold text-sm transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createContent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Generate Graph
              </button>
            </form>
          </div>

          {/* Stats Panel */}
          <div className="border border-border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">
              System Telemetry
            </h2>
            {isSummaryLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : summary ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-background border border-border">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                    <Database className="h-3 w-3" /> Graphs
                  </div>
                  <div className="text-2xl font-bold font-mono">{summary.contentCount}</div>
                </div>
                <div className="p-4 bg-background border border-border">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                    <Box className="h-3 w-3" /> Entities
                  </div>
                  <div className="text-2xl font-bold font-mono">{summary.entityCount}</div>
                </div>
                <div className="p-4 bg-background border border-border">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                    <Network className="h-3 w-3" /> Relations
                  </div>
                  <div className="text-2xl font-bold font-mono">{summary.relationshipCount}</div>
                </div>
                <div className="p-4 bg-background border border-border">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Versions
                  </div>
                  <div className="text-2xl font-bold font-mono">{summary.versionCount}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No telemetry available.</div>
            )}
          </div>
        </div>

        {/* Right Column: Library */}
        <div className="lg:col-span-2">
          <div className="border border-border bg-card flex flex-col h-full min-h-[600px] shadow-sm">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider">
                Content Library
              </h2>
              <span className="text-xs font-mono bg-muted px-2 py-1 text-muted-foreground border border-border">
                {contents?.length || 0} RECORDS
              </span>
            </div>
            
            <div className="flex-1 overflow-auto bg-background/50">
              {isContentsLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <span className="font-mono text-sm">Fetching records...</span>
                </div>
              ) : contents && contents.length > 0 ? (
                <div className="divide-y divide-border">
                  {contents.map((item) => (
                    <Link key={item.id} href={`/content/${item.id}`} className="block group">
                      <div className="p-6 transition-colors hover:bg-muted hover:border-l-4 hover:border-l-primary hover:-ml-[1px] cursor-pointer">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{item.title}</h3>
                          <button 
                            onClick={(e) => handleDelete(item.id, e)}
                            className="text-muted-foreground hover:text-destructive p-2 -mr-2 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Graph"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {item.sourcePrompt && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 font-serif italic">
                            "{item.sourcePrompt}"
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Box className="h-3 w-3"/> {item.entityCount}</span>
                          <span className="flex items-center gap-1.5"><Network className="h-3 w-3"/> {item.relationshipCount}</span>
                          <span className="flex items-center gap-1.5 bg-border/50 px-1.5 py-0.5">v{item.version}</span>
                          <span>{format(new Date(item.updatedAt), "yyyy-MM-dd HH:mm")}</span>
                          
                          <div className="ml-auto flex items-center text-primary opacity-0 group-hover:opacity-100 transition-opacity font-sans font-semibold">
                            Enter Workspace <ArrowRight className="ml-1 h-3 w-3" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
                  <div className="w-16 h-16 border-2 border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground mb-4">
                    <Database className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Library is Empty</h3>
                  <p className="text-muted-foreground text-sm max-w-md mb-6">
                    The intelligence platform requires input to construct its first narrative graph. 
                    Use the generator panel to initialize structural content.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
