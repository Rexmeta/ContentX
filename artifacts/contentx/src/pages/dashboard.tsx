import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  useListContent, 
  useGetDashboardSummary, 
  useCreateContent, 
  useDeleteContent,
  useDraftScenario
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
  Terminal,
  CheckCircle,
  ChevronDown,
  Wand2,
  Save,
  RotateCcw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: contents, isLoading: isContentsLoading, refetch: refetchContents } = useListContent();
  const createContent = useCreateContent();
  const deleteContent = useDeleteContent();
  const draftScenario = useDraftScenario();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [step, setStep] = useState<'IDEA' | 'SCENARIO'>('IDEA');
  const [draft, setDraft] = useState<any>(null);

  const handleAmplify = (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    draftScenario.mutate(
      { data: { prompt, title: title.trim() || undefined } },
      {
        onSuccess: (res) => {
          setDraft(res);
          setStep('SCENARIO');
          window.scrollTo(0, 0);
        },
        onError: (err) => {
          toast({ 
            title: "Failed to amplify idea", 
            description: err.message, 
            variant: "destructive" 
          });
        }
      }
    );
  };

  const handleConfirmGraph = () => {
    if (!draft) return;
    createContent.mutate(
      { data: { prompt, title: draft.title || title.trim(), scenario: draft } },
      {
        onSuccess: (newGraph) => {
          toast({ title: "Content graph generated successfully" });
          refetchContents();
          refetchSummary();
          setLocation(`/content/${newGraph.id}`);
        },
        onError: (err) => {
          toast({ 
            title: "Failed to generate graph", 
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
            refetchSummary();
          }
        }
      );
    }
  };

  const handleDraftChange = (field: string, value: string) => {
    setDraft((prev: any) => prev ? { ...prev, [field]: value } : prev);
  };

  if (step === 'SCENARIO' && draft) {
    return (
      <div className="min-h-screen bg-background relative selection:bg-primary/20 text-foreground pb-24">
        <div className="fixed inset-0 bg-noise z-0"></div>
        
        <header className="relative z-10 border-b border-border bg-card/80 backdrop-blur-sm h-16 flex items-center px-6">
          <div className="flex items-center gap-3 text-primary">
            <Terminal className="h-6 w-6" />
            <h1 className="text-xl font-bold tracking-tight">CONTENT<span className="text-foreground">X</span></h1>
          </div>
        </header>

        <main className="relative z-10 max-w-7xl mx-auto p-6 space-y-6">
          {/* Stepper */}
          <div className="flex items-center gap-4 text-xs font-mono uppercase tracking-widest border border-border bg-card p-4">
            <span className="text-muted-foreground flex items-center gap-2"><CheckCircle className="h-4 w-4" /> 1. IDEA</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-bold text-primary flex items-center gap-2"><Activity className="h-4 w-4" /> 2. SCENARIO DRAFT</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground flex items-center gap-2"><Network className="h-4 w-4" /> 3. GRAPH GENERATION</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Editable Core Structure */}
            <div className="space-y-6">
              <div className="border border-border bg-card p-6 shadow-sm space-y-4">
                <h2 className="text-sm font-mono font-bold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2 flex items-center gap-2">
                  <Wand2 className="h-4 w-4" /> Core Scenario
                </h2>
                
                <div>
                  <label className="block text-xs font-semibold mb-1 uppercase text-muted-foreground">Title</label>
                  <input 
                    type="text" 
                    value={draft.title || ""}
                    onChange={(e) => handleDraftChange('title', e.target.value)}
                    className="w-full bg-background border border-border px-3 py-2 text-lg font-bold focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold mb-1 uppercase text-muted-foreground">Logline</label>
                  <textarea 
                    value={draft.logline || ""}
                    onChange={(e) => handleDraftChange('logline', e.target.value)}
                    rows={2}
                    className="w-full bg-background border border-border px-3 py-2 text-sm font-medium focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 uppercase text-muted-foreground">Synopsis</label>
                  <textarea 
                    value={draft.synopsis || ""}
                    onChange={(e) => handleDraftChange('synopsis', e.target.value)}
                    rows={6}
                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1 uppercase text-muted-foreground">Theme</label>
                    <input 
                      type="text" 
                      value={draft.theme || ""}
                      onChange={(e) => handleDraftChange('theme', e.target.value)}
                      className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 uppercase text-muted-foreground">Stakes</label>
                    <input 
                      type="text" 
                      value={draft.stakes || ""}
                      onChange={(e) => handleDraftChange('stakes', e.target.value)}
                      className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 uppercase text-muted-foreground">Twist</label>
                  <textarea 
                    value={draft.twist || ""}
                    onChange={(e) => handleDraftChange('twist', e.target.value)}
                    rows={2}
                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Acts and Characters */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                  Structural Beats (Read-only)
                </h3>
                {draft.acts?.map((act: any, i: number) => (
                  <details key={i} className="group border border-border bg-card open:bg-muted/10 transition-colors">
                    <summary className="cursor-pointer p-4 font-bold uppercase tracking-wider text-sm flex items-center justify-between hover:bg-muted/50 transition-colors">
                      {act.name}
                      <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="p-4 border-t border-border space-y-4 bg-background/50">
                      <p className="text-sm font-medium leading-relaxed">{act.summary}</p>
                      <ul className="list-disc pl-4 space-y-2 text-sm text-muted-foreground">
                        {act.beats?.map((beat: string, j: number) => <li key={j}>{beat}</li>)}
                      </ul>
                    </div>
                  </details>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                  Characters
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {draft.characters?.map((char: any, i: number) => (
                    <div key={i} className="border border-border p-4 bg-card">
                      <div className="font-bold text-base mb-1">{char.name}</div>
                      <div className="text-[10px] text-primary font-mono mb-3 uppercase tracking-widest">{char.role}</div>
                      <div className="text-sm text-muted-foreground line-clamp-3" title={char.motivation}>{char.motivation}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Floating Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-md border-t border-border z-50 flex items-center justify-between px-6">
          <button 
            onClick={() => setStep('IDEA')} 
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            <ArrowRight className="h-4 w-4 rotate-180" /> Back to Idea
          </button>
          
          <div className="flex gap-4">
            <button 
              onClick={handleAmplify} 
              disabled={draftScenario.isPending}
              className="flex items-center justify-center gap-2 bg-muted text-foreground border border-border h-10 px-6 font-semibold text-sm transition-colors hover:bg-muted/80 disabled:opacity-50"
            >
              {draftScenario.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Re-Amplify
            </button>
            <button 
              onClick={handleConfirmGraph}
              disabled={createContent.isPending}
              className="flex items-center justify-center gap-2 bg-primary text-primary-foreground h-10 px-8 font-semibold text-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {createContent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Confirm & Build Graph
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            
            {/* Stepper for Idea Phase */}
            <div className="flex flex-col gap-2 mb-6 text-[10px] font-mono uppercase tracking-widest text-muted-foreground bg-muted/30 p-3 border border-border">
               <div className="flex items-center gap-1.5 font-bold text-primary"><CheckCircle className="h-3 w-3" /> 1. IDEA</div>
               <div className="flex items-center gap-1.5"><ArrowRight className="h-3 w-3 opacity-50" /> 2. SCENARIO DRAFT</div>
               <div className="flex items-center gap-1.5"><ArrowRight className="h-3 w-3 opacity-50" /> 3. GRAPH GENERATION</div>
            </div>

            <form onSubmit={handleAmplify} className="space-y-4">
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
                <label htmlFor="prompt" className="block text-xs font-semibold mb-1">Raw Idea</label>
                <textarea 
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe a core concept. We'll amplify it into a full dramatic scenario..."
                  rows={5}
                  required
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none font-mono"
                />
              </div>
              <button 
                type="submit"
                disabled={draftScenario.isPending || !prompt.trim()}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground h-10 px-4 font-semibold text-sm transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {draftScenario.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Amplify to Scenario
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
