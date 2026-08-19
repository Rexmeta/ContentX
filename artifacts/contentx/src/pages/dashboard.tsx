import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { 
  useListContent, 
  useGetDashboardSummary, 
  useCreateContent, 
  useDeleteContent,
  useDraftScenario,
  useListScenarios,
  useCreateScenario,
  useUpdateScenario,
  useDeleteScenario,
  useListCategories,
  useClassifyScenario,
  useReclassifyScenarios,
  useListSimilarScenarios,
  useSynthesizeScenario,
  getListScenariosQueryKey,
  getListCategoriesQueryKey,
  ScenarioRecord,
  Lineage
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
  RotateCcw,
  BookOpen,
  FileText,
  Tag,
  Search,
  Filter,
  RefreshCw,
  GitMerge
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LineageTree from "@/components/lineage-tree";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: contents, isLoading: isContentsLoading, refetch: refetchContents } = useListContent();
  const { data: scenarios, isLoading: isScenariosLoading, refetch: refetchScenarios } = useListScenarios();
  const { data: categories, isLoading: isCategoriesLoading, refetch: refetchCategories } = useListCategories();
  
  const createContent = useCreateContent();
  const deleteContent = useDeleteContent();
  const draftScenario = useDraftScenario();
  const createScenario = useCreateScenario();
  const updateScenario = useUpdateScenario();
  const deleteScenario = useDeleteScenario();
  const classifyScenario = useClassifyScenario();
  const reclassifyScenarios = useReclassifyScenarios();
  const synthesizeScenario = useSynthesizeScenario();
  
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [step, setStep] = useState<'IDEA' | 'SCENARIO'>('IDEA');
  const [draft, setDraft] = useState<any>(null);
  const [draftLineage, setDraftLineage] = useState<Lineage | null>(null);
  
  // currentScenario hold the entire ScenarioRecord when opened from library
  const [currentScenario, setCurrentScenario] = useState<ScenarioRecord | null>(null);
  const currentScenarioId = currentScenario?.id || null;

  // Synthesize mode state
  const [isSynthesizeMode, setIsSynthesizeMode] = useState(false);
  const [selectedForSynthesis, setSelectedForSynthesis] = useState<string[]>([]);
  const [isSynthesisPanelOpen, setIsSynthesisPanelOpen] = useState(false);
  const [synthesisElements, setSynthesisElements] = useState<Record<string, ("characters"|"conflict"|"setting"|"twist"|"structure"|"relationship"|"goal"|"event"|"ending")[]>>({});
  const [synthesisInstruction, setSynthesisInstruction] = useState("");

  // Re-roll & candidate comparison state
  type SynthesisElement = "characters"|"conflict"|"setting"|"twist"|"structure"|"relationship"|"goal"|"event"|"ending";
  const [synthesisRecipe, setSynthesisRecipe] = useState<{ sources: { scenarioId: string, elements: SynthesisElement[] }[], instruction?: string } | null>(null);
  const [candidates, setCandidates] = useState<{ scenario: any, lineage: Lineage }[]>([]);
  const [activeCandidate, setActiveCandidate] = useState(0);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const clearCandidates = () => {
    setSynthesisRecipe(null);
    setCandidates([]);
    setActiveCandidate(0);
    setIsCompareOpen(false);
  };
  
  // State for manual classification overrides in step-2
  const [editedClassification, setEditedClassification] = useState<{domain: string, conflictType: string, tone: string, tags: string}>({ domain: "", conflictType: "", tone: "", tags: "" });

  const [activeTab, setActiveTab] = useState<'CONTENT' | 'SCENARIOS' | 'LINEAGE'>('CONTENT');

  // Filtering state
  const [filterDomain, setFilterDomain] = useState("All");
  const [filterConflict, setFilterConflict] = useState("All");
  const [filterTone, setFilterTone] = useState("All");

  const filteredScenarios = useMemo(() => {
    if (!scenarios) return [];
    return scenarios.filter(s => {
      const cls = s.classification;
      if (filterDomain !== "All" && (!cls || cls.domain !== filterDomain)) return false;
      if (filterConflict !== "All" && (!cls || cls.conflictType !== filterConflict)) return false;
      if (filterTone !== "All" && (!cls || cls.tone !== filterTone)) return false;
      return true;
    });
  }, [scenarios, filterDomain, filterConflict, filterTone]);

  const uniqueDomains = useMemo(() => Array.from(new Set(categories?.filter(c => c.axis === 'domain').map(c => c.name) || [])), [categories]);
  const uniqueConflicts = useMemo(() => Array.from(new Set(categories?.filter(c => c.axis === 'conflictType').map(c => c.name) || [])), [categories]);
  const uniqueTones = useMemo(() => Array.from(new Set(categories?.filter(c => c.axis === 'tone').map(c => c.name) || [])), [categories]);

  const parsedTags = useMemo(() => editedClassification.tags.split(',').map(t => t.trim()).filter(Boolean), [editedClassification.tags]);
  const isFullyClassified = Boolean(
    editedClassification.domain && 
    editedClassification.conflictType && 
    editedClassification.tone && 
    parsedTags.length > 0
  );
  const showClassificationHint = !isFullyClassified && Boolean(
    editedClassification.domain || 
    editedClassification.conflictType || 
    editedClassification.tone || 
    editedClassification.tags.trim()
  );

  const handleAmplify = (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    draftScenario.mutate(
      { data: { prompt, title: title.trim() || undefined } },
      {
        onSuccess: (res) => {
          setDraft(res);
          setDraftLineage(null);
          clearCandidates();
          // Initialize classification state if it was null
          setEditedClassification({ domain: "", conflictType: "", tone: "", tags: "" });
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

  const handleSaveToLibrary = () => {
    if (!draft) return;
    
    const classificationPayload = isFullyClassified ? {
      domain: editedClassification.domain,
      conflictType: editedClassification.conflictType,
      tone: editedClassification.tone,
      tags: parsedTags
    } : undefined;

    if (currentScenarioId) {
      updateScenario.mutate(
        { id: currentScenarioId, data: { scenario: draft, classification: classificationPayload } },
        {
          onSuccess: (updatedRecord) => {
            toast({ title: "Scenario changes saved" });
            setCurrentScenario(updatedRecord);
            refetchScenarios();
            refetchCategories();
          },
          onError: (err) => {
            toast({ title: "Failed to save scenario", description: err.message, variant: "destructive" });
          }
        }
      );
    } else {
      // NOTE: Create scenario endpoint only takes idea and scenario currently, classification happens auto on backend.
      // If we need to pass manual override to create, it's not in the schema yet, so backend auto-classifies.
      createScenario.mutate(
        { data: { idea: prompt, scenario: draft, lineage: draftLineage || undefined } },
        {
          onSuccess: (res) => {
            toast({ title: "Scenario saved to library & auto-classified" });
            setCurrentScenario(res);
            clearCandidates();
            refetchScenarios();
            refetchCategories();
            setActiveTab('SCENARIOS');
            // Populate our edit form with whatever the backend classified it as
            if (res.classification) {
              setEditedClassification({
                domain: res.classification.domain,
                conflictType: res.classification.conflictType,
                tone: res.classification.tone,
                tags: res.classification.tags.join(', ')
              });
            }
          },
          onError: (err) => {
            toast({ title: "Failed to save scenario", description: err.message, variant: "destructive" });
          }
        }
      );
    }
  };

  const handleConfirmGraph = () => {
    if (!draft) return;
    createContent.mutate(
      { data: { prompt, title: draft.title || title.trim(), scenario: draft, lineage: (currentScenario?.lineage || draftLineage) || undefined } },
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

  const handleDeleteContent = (id: string, e: React.MouseEvent) => {
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

  const handleDeleteScenario = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this scenario?")) {
      deleteScenario.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: "Scenario deleted successfully" });
            refetchScenarios();
            refetchCategories();
            if (currentScenarioId === id) {
              setStep('IDEA');
              setDraft(null);
              setDraftLineage(null);
              setCurrentScenario(null);
            }
          }
        }
      );
    }
  };

  const handleOpenScenario = (record: ScenarioRecord) => {
    setPrompt(record.idea);
    setTitle(record.title);
    setDraft(record.scenario);
    setDraftLineage(null);
    setCurrentScenario(record);
    clearCandidates();
    
    if (record.classification) {
      setEditedClassification({
        domain: record.classification.domain,
        conflictType: record.classification.conflictType,
        tone: record.classification.tone,
        tags: record.classification.tags.join(', ')
      });
    } else {
      setEditedClassification({ domain: "", conflictType: "", tone: "", tags: "" });
    }
    
    setStep('SCENARIO');
    window.scrollTo(0, 0);
  };

  const handleReclassifySingle = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    classifyScenario.mutate({ id }, {
      onSuccess: (updated) => {
        toast({ title: "Reclassified successfully" });
        refetchScenarios();
        refetchCategories();
        if (currentScenarioId === id) {
          setCurrentScenario(updated);
          if (updated.classification) {
             setEditedClassification({
                domain: updated.classification.domain,
                conflictType: updated.classification.conflictType,
                tone: updated.classification.tone,
                tags: updated.classification.tags.join(', ')
             });
          }
        }
      },
      onError: (err) => {
        toast({ title: "Reclassification failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleReclassifyAll = () => {
    if (!confirm("Are you sure? This will trigger LLM analysis for all unclassified or existing scenarios. It may take some time.")) return;
    reclassifyScenarios.mutate(undefined, {
      onSuccess: (res) => {
        toast({ title: "Bulk reclassification complete", description: `${res.classified} classified, ${res.failed} failed.` });
        refetchScenarios();
        refetchCategories();
      },
      onError: (err) => {
        toast({ title: "Bulk reclassification failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleSynthesize = () => {
    const sources = selectedForSynthesis.map(id => ({
      scenarioId: id,
      elements: synthesisElements[id] || []
    })).filter(s => s.elements.length > 0);

    if (sources.length < 2) {
      toast({ title: "Validation Error", description: "Select elements from at least two sources", variant: "destructive" });
      return;
    }

    const recipe = {
      sources,
      instruction: synthesisInstruction.trim() || undefined
    };

    synthesizeScenario.mutate({
      data: recipe
    }, {
      onSuccess: (res) => {
        toast({ title: "Synthesis complete" });
        setSynthesisRecipe(recipe);
        setCandidates([{ scenario: res.scenario, lineage: res.lineage }]);
        setActiveCandidate(0);
        setIsCompareOpen(false);
        setDraft(res.scenario);
        setDraftLineage(res.lineage);
        setCurrentScenario(null);
        setEditedClassification({ domain: "", conflictType: "", tone: "", tags: "" });
        
        const parentTitles = res.lineage.parents.map(p => p.title).join(", ");
        setPrompt(`Synthesis of: ${parentTitles}`);
        setTitle(`Synthesis: ${parentTitles}`);
        
        setIsSynthesisPanelOpen(false);
        setIsSynthesizeMode(false);
        setSelectedForSynthesis([]);
        setSynthesisElements({});
        setSynthesisInstruction("");
        
        setStep('SCENARIO');
        window.scrollTo(0, 0);
      },
      onError: (err) => {
        toast({ title: "Synthesis failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleReroll = () => {
    if (!synthesisRecipe || synthesizeScenario.isPending) return;
    synthesizeScenario.mutate({ data: synthesisRecipe }, {
      onSuccess: (res) => {
        toast({ title: "Re-run complete", description: `Candidate ${candidates.length + 1} added.` });
        const newIndex = candidates.length;
        setCandidates(prev => {
          const copy = [...prev];
          // Persist any manual edits made to the currently viewed candidate
          if (copy[activeCandidate]) copy[activeCandidate] = { scenario: draft, lineage: draftLineage! };
          return [...copy, { scenario: res.scenario, lineage: res.lineage }];
        });
        setActiveCandidate(newIndex);
        setDraft(res.scenario);
        setDraftLineage(res.lineage);
        window.scrollTo(0, 0);
      },
      onError: (err) => {
        toast({ title: "Re-run failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleSelectCandidate = (index: number) => {
    if (index === activeCandidate || !candidates[index]) return;
    setCandidates(prev => {
      const copy = [...prev];
      if (copy[activeCandidate]) copy[activeCandidate] = { scenario: draft, lineage: draftLineage! };
      return copy;
    });
    setActiveCandidate(index);
    setDraft(candidates[index].scenario);
    setDraftLineage(candidates[index].lineage);
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

          {/* Synthesis Candidates Bar */}
          {synthesisRecipe && candidates.length > 0 && !currentScenarioId && (
            <div className="border border-secondary/40 bg-card shadow-sm">
              <div className="p-4 flex flex-wrap items-center gap-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-secondary flex items-center gap-2">
                  <GitMerge className="h-4 w-4" /> Candidates
                </span>
                <div className="flex flex-wrap gap-2">
                  {candidates.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectCandidate(i)}
                      className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border transition-colors ${
                        i === activeCandidate
                          ? 'bg-secondary text-secondary-foreground border-secondary'
                          : 'bg-background border-border text-muted-foreground hover:border-secondary hover:text-secondary'
                      }`}
                      title={c.scenario?.title}
                    >
                      #{i + 1}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {candidates.length > 1 && (
                    <button
                      onClick={() => setIsCompareOpen(o => !o)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-colors ${
                        isCompareOpen ? 'bg-muted border-border' : 'bg-background border-border hover:border-primary hover:text-primary'
                      }`}
                    >
                      <Search className="h-3 w-3" /> {isCompareOpen ? 'Hide Comparison' : 'Compare'}
                    </button>
                  )}
                  <button
                    onClick={handleReroll}
                    disabled={synthesizeScenario.isPending}
                    className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-1.5 text-xs font-bold border border-secondary transition-colors hover:bg-secondary/90 disabled:opacity-50"
                  >
                    {synthesizeScenario.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    {synthesizeScenario.isPending ? 'Re-rolling (takes ~1 min)...' : 'Re-run Same Ingredients'}
                  </button>
                </div>
              </div>
              {synthesizeScenario.isPending && (
                <div className="h-1 bg-secondary animate-pulse w-full"></div>
              )}
              {isCompareOpen && candidates.length > 1 && (
                <div className="border-t border-border p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/10">
                  {candidates.map((c, i) => {
                    const s = i === activeCandidate ? draft : c.scenario;
                    return (
                      <div key={i} className={`border p-4 flex flex-col gap-2 bg-card ${i === activeCandidate ? 'border-secondary' : 'border-border'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Candidate #{i + 1}{i === activeCandidate ? ' — VIEWING' : ''}</span>
                          {i !== activeCandidate && (
                            <button
                              onClick={() => handleSelectCandidate(i)}
                              className="text-[10px] font-mono font-bold uppercase tracking-wider text-secondary hover:underline"
                            >
                              View / Edit →
                            </button>
                          )}
                        </div>
                        <div className="font-bold text-sm">{s?.title || 'Untitled'}</div>
                        {s?.logline && <p className="text-xs text-muted-foreground font-serif leading-relaxed">{s.logline}</p>}
                        {s?.twist && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            <span className="font-mono font-bold uppercase text-[9px] tracking-wider text-primary mr-1">Twist</span>
                            {s.twist}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Editable Core Structure */}
            <div className="lg:col-span-7 space-y-6">
              <div className="border border-border bg-card p-6 shadow-sm space-y-4">
                <h2 className="text-sm font-mono font-bold text-primary uppercase tracking-wider mb-4 border-b border-border pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2"><Wand2 className="h-4 w-4" /> Core Scenario</span>
                  {currentScenarioId && (
                    <span className="bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold border border-primary/20">SAVED IN LIBRARY</span>
                  )}
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

              {/* Classification Panel (Only visible for saved scenarios) */}
              {currentScenarioId && (
                <div className="border border-border bg-card p-6 shadow-sm space-y-4">
                   <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2 flex items-center gap-2">
                    <Tag className="h-4 w-4" /> Categorization Mapping
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono mb-1 uppercase text-muted-foreground">Domain</label>
                      <select 
                        value={editedClassification.domain} 
                        onChange={e => setEditedClassification(p => ({...p, domain: e.target.value}))}
                        className="w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary appearance-none"
                      >
                        <option value="">(Select Domain)</option>
                        {uniqueDomains.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono mb-1 uppercase text-muted-foreground">Conflict Type</label>
                      <select 
                        value={editedClassification.conflictType} 
                        onChange={e => setEditedClassification(p => ({...p, conflictType: e.target.value}))}
                        className="w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary appearance-none"
                      >
                        <option value="">(Select Conflict)</option>
                        {uniqueConflicts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono mb-1 uppercase text-muted-foreground">Tone</label>
                      <select 
                        value={editedClassification.tone} 
                        onChange={e => setEditedClassification(p => ({...p, tone: e.target.value}))}
                        className="w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary appearance-none"
                      >
                        <option value="">(Select Tone)</option>
                        {uniqueTones.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono mb-1 uppercase text-muted-foreground">Tags (comma separated)</label>
                    <input 
                      type="text" 
                      value={editedClassification.tags}
                      onChange={e => setEditedClassification(p => ({...p, tags: e.target.value}))}
                      placeholder="e.g. survival, fast-paced"
                      className="w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  {showClassificationHint && (
                    <p className="text-[10px] text-orange-500 font-mono mt-2 uppercase tracking-wider">
                      Select all three axes and at least one tag to override auto-classification.
                    </p>
                  )}
                </div>
              )}

              {/* Lineage Panel */}
              {(currentScenario?.lineage || draftLineage) && (
                <div className="border border-border bg-card p-6 shadow-sm space-y-4">
                  <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2 flex items-center gap-2">
                    <GitMerge className="h-4 w-4" /> Synthesis Lineage
                  </h2>
                  <div className="space-y-4">
                    {(currentScenario?.lineage || draftLineage)?.parents.map((parent: any, i: number) => (
                      <div key={i} className="flex flex-col gap-1.5 p-3 bg-muted/20 border border-border">
                        <div className="text-sm font-bold">{parent.title}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {parent.elements.map((el: string) => (
                            <span key={el} className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono px-1.5 py-0.5 uppercase tracking-wider">
                              {el}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {(currentScenario?.lineage || draftLineage)?.instruction && (
                      <div className="text-xs text-muted-foreground italic border-l-2 border-border pl-3 mt-2">
                        "{((currentScenario?.lineage || draftLineage) as any).instruction}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Acts, Characters, Similar */}
            <div className="lg:col-span-5 space-y-6">
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

              {currentScenarioId && <SimilarScenariosPanel scenarioId={currentScenarioId} onOpen={handleOpenScenario} />}
            </div>
          </div>
        </main>

        {/* Floating Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-md border-t border-border z-50 flex items-center justify-between px-6">
          <button 
            onClick={() => {
              setStep('IDEA');
              setCurrentScenario(null);
              setDraftLineage(null);
              clearCandidates();
            }} 
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            <ArrowRight className="h-4 w-4 rotate-180" /> Back to Library / Idea
          </button>
          
          <div className="flex gap-3">
            <button 
              onClick={handleAmplify} 
              disabled={draftScenario.isPending}
              className="flex items-center justify-center gap-2 bg-muted text-foreground border border-border h-10 px-4 font-semibold text-sm transition-colors hover:bg-muted/80 disabled:opacity-50"
            >
              {draftScenario.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Re-Amplify
            </button>
            <button 
              onClick={handleSaveToLibrary}
              disabled={createScenario.isPending || updateScenario.isPending}
              className="flex items-center justify-center gap-2 bg-card text-foreground border border-border h-10 px-4 font-semibold text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              {createScenario.isPending || updateScenario.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
              {currentScenarioId ? "Save Changes" : "Save to Library"}
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

      <main className="relative z-10 max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Generator & Stats */}
        <div className="lg:col-span-4 space-y-6">
          
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
                  disabled={draftScenario.isPending}
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
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
                  disabled={draftScenario.isPending}
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none font-mono disabled:opacity-50"
                />
              </div>
              
              <button 
                type="submit"
                disabled={draftScenario.isPending || !prompt.trim()}
                className="w-full flex flex-col items-center justify-center gap-1 bg-primary text-primary-foreground h-12 px-4 font-semibold text-sm transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              >
                {draftScenario.isPending ? (
                  <>
                    <div className="flex items-center gap-2 z-10"><Loader2 className="h-4 w-4 animate-spin" /> Amplifying Idea...</div>
                    <div className="text-[10px] z-10 opacity-80 font-mono">This involves deep reasoning (takes ~30 seconds)</div>
                    <div className="absolute bottom-0 left-0 h-1 bg-white/30 animate-pulse w-full"></div>
                  </>
                ) : (
                  <div className="flex items-center gap-2"><Wand2 className="h-4 w-4" /> Amplify to Scenario</div>
                )}
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
                    <BookOpen className="h-3 w-3" /> Scenarios
                  </div>
                  <div className="text-2xl font-bold font-mono">{scenarios?.length || 0}</div>
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
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No telemetry available.</div>
            )}
          </div>
        </div>

        {/* Right Column: Library Tabs */}
        <div className="lg:col-span-8">
          <div className="border border-border bg-card flex flex-col h-full min-h-[600px] shadow-sm">
            
            <div className="flex border-b border-border">
              <button 
                onClick={() => setActiveTab('CONTENT')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-mono font-bold uppercase tracking-wider transition-colors ${activeTab === 'CONTENT' ? 'bg-background border-b-2 border-primary text-primary' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              >
                <Database className="h-4 w-4" />
                Content Library
                <span className="bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground border border-border rounded-sm">{contents?.length || 0}</span>
              </button>
              <button 
                onClick={() => setActiveTab('SCENARIOS')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-mono font-bold uppercase tracking-wider transition-colors ${activeTab === 'SCENARIOS' ? 'bg-background border-b-2 border-primary text-primary' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              >
                <BookOpen className="h-4 w-4" />
                Scenario Library
                <span className="bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground border border-border rounded-sm">{scenarios?.length || 0}</span>
              </button>
              <button 
                onClick={() => setActiveTab('LINEAGE')}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-mono font-bold uppercase tracking-wider transition-colors ${activeTab === 'LINEAGE' ? 'bg-background border-b-2 border-primary text-primary' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              >
                <GitMerge className="h-4 w-4" />
                Lineage
                <span className="bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground border border-border rounded-sm">{scenarios?.filter(s => s.lineage).length || 0}</span>
              </button>
            </div>

            {/* Filter Bar (Only shown for scenarios) */}
            {activeTab === 'SCENARIOS' && (
              <div className="border-b border-border bg-muted/10 p-3 flex flex-wrap items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Filter className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground uppercase">Filter:</span>
                </div>
                
                <select 
                  value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)}
                  className="bg-background border border-border px-2 py-1 focus:border-primary appearance-none cursor-pointer"
                >
                  <option value="All">Domain: All</option>
                  {uniqueDomains.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                <select 
                  value={filterConflict} onChange={(e) => setFilterConflict(e.target.value)}
                  className="bg-background border border-border px-2 py-1 focus:border-primary appearance-none cursor-pointer"
                >
                  <option value="All">Conflict: All</option>
                  {uniqueConflicts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                <select 
                  value={filterTone} onChange={(e) => setFilterTone(e.target.value)}
                  className="bg-background border border-border px-2 py-1 focus:border-primary appearance-none cursor-pointer"
                >
                  <option value="All">Tone: All</option>
                  {uniqueTones.map(d => <option key={d} value={d}>{d}</option>)}
                </select>

                <div className="ml-auto flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setIsSynthesizeMode(!isSynthesizeMode);
                      setSelectedForSynthesis([]);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 font-bold border transition-colors ${
                      isSynthesizeMode 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-background border-border hover:border-primary hover:text-primary'
                    }`}
                  >
                    <GitMerge className="h-3 w-3" />
                    {isSynthesizeMode ? 'Cancel Synthesis' : 'Synthesize Mode'}
                  </button>
                  {isSynthesizeMode && (
                    <button
                      disabled={selectedForSynthesis.length < 2}
                      onClick={() => setIsSynthesisPanelOpen(true)}
                      className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1 font-bold border border-secondary transition-colors disabled:opacity-50"
                    >
                      Synthesize ({selectedForSynthesis.length})
                    </button>
                  )}
                  <div className="w-px h-4 bg-border mx-1"></div>
                  <button 
                    onClick={handleReclassifyAll}
                    disabled={reclassifyScenarios.isPending}
                    className="flex items-center gap-1.5 bg-background border border-border px-2 py-1 hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
                  >
                    {reclassifyScenarios.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Reclassify All
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-auto bg-background/50 relative">
              {activeTab === 'CONTENT' && (
                isContentsLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <span className="font-mono text-sm">Fetching graphs...</span>
                  </div>
                ) : contents && contents.length > 0 ? (
                  <div className="divide-y divide-border">
                    {contents.map((item) => (
                      <Link key={item.id} href={`/content/${item.id}`} className="block group">
                        <div className="p-6 transition-colors hover:bg-muted hover:border-l-4 hover:border-l-primary hover:-ml-[1px] cursor-pointer">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{item.title}</h3>
                            <button 
                              onClick={(e) => handleDeleteContent(item.id, e)}
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
                          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-muted-foreground">
                            <span className="flex items-center gap-1.5"><Box className="h-3 w-3"/> {item.entityCount}</span>
                            <span className="flex items-center gap-1.5"><Network className="h-3 w-3"/> {item.relationshipCount}</span>
                            <span className="flex items-center gap-1.5 bg-border/50 px-1.5 py-0.5 border border-border">v{item.version}</span>
                            <span>{format(new Date(item.updatedAt), "yyyy-MM-dd HH:mm")}</span>
                            
                            <div className="ml-auto flex items-center text-primary opacity-0 group-hover:opacity-100 transition-opacity font-sans font-semibold text-sm">
                              Enter Workspace <ArrowRight className="ml-1 h-3 w-3" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 border-2 border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground mb-4">
                      <Database className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">No Graphs Found</h3>
                    <p className="text-muted-foreground text-sm max-w-md">
                      Generate graphs from scenarios to start populating your library.
                    </p>
                  </div>
                )
              )}

              {activeTab === 'SCENARIOS' && (
                isScenariosLoading || isCategoriesLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <span className="font-mono text-sm">Fetching scenarios...</span>
                  </div>
                ) : filteredScenarios && filteredScenarios.length > 0 ? (
                  <div className="divide-y divide-border">
                    {filteredScenarios.map((record) => (
                      <div 
                        key={record.id} 
                        className={`p-6 transition-colors group flex flex-col ${
                          isSynthesizeMode && selectedForSynthesis.includes(record.id) 
                            ? 'bg-secondary/10 border-l-4 border-secondary -ml-[1px]' 
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => {
                          if (isSynthesizeMode) {
                            setSelectedForSynthesis(prev => 
                              prev.includes(record.id) ? prev.filter(id => id !== record.id) : [...prev, record.id]
                            );
                          }
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                            {isSynthesizeMode && (
                              <input 
                                type="checkbox"
                                checked={selectedForSynthesis.includes(record.id)}
                                readOnly
                                className="h-4 w-4 rounded-none border-border text-secondary focus:ring-secondary cursor-pointer"
                              />
                            )}
                            <h3 className="text-lg font-bold group-hover:text-primary transition-colors cursor-pointer" onClick={(e) => {
                               if (!isSynthesizeMode) {
                                 handleOpenScenario(record);
                               }
                            }}>{record.title || "Untitled Scenario"}</h3>
                          </div>
                          <div className={`flex gap-2 transition-opacity ${isSynthesizeMode ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}>
                            <button 
                              onClick={(e) => handleReclassifySingle(record.id, e)}
                              disabled={classifyScenario.isPending}
                              className="text-xs font-mono text-muted-foreground hover:text-primary border border-transparent hover:border-primary/20 px-2 py-1 flex items-center gap-1 disabled:opacity-50"
                              title="Reclassify"
                            >
                              {classifyScenario.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                              Reclassify
                            </button>
                            <button 
                              onClick={(e) => handleDeleteScenario(record.id, e)}
                              className="text-muted-foreground hover:text-destructive p-2 -mr-2 transition-colors"
                              title="Delete Scenario"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          {record.lineage && (
                            <span className="bg-foreground text-background border border-foreground text-[10px] font-mono px-1.5 py-0.5 uppercase tracking-wider flex items-center gap-1">
                              <GitMerge className="h-2.5 w-2.5" /> SYNTHESIZED ({record.lineage.parents.length})
                            </span>
                          )}
                          {record.classification ? (
                            <>
                              <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono px-1.5 py-0.5 uppercase tracking-wider">{record.classification.domain}</span>
                              <span className="bg-secondary/10 text-secondary border border-secondary/20 text-[10px] font-mono px-1.5 py-0.5 uppercase tracking-wider">{record.classification.conflictType}</span>
                              <span className="bg-chart-3/10 text-chart-3 border border-chart-3/20 text-[10px] font-mono px-1.5 py-0.5 uppercase tracking-wider">{record.classification.tone}</span>
                              {record.classification.tags?.slice(0, 3).map(t => (
                                <span key={t} className="bg-muted text-muted-foreground border border-border text-[10px] font-mono px-1.5 py-0.5 flex items-center gap-1"><Tag className="h-2 w-2"/> {t}</span>
                              ))}
                            </>
                          ) : (
                            <span className="bg-destructive/10 text-destructive border border-destructive/20 text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase tracking-wider">UNCLASSIFIED</span>
                          )}
                        </div>

                        {record.scenario?.logline && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 font-serif">
                            {record.scenario.logline}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {format(new Date(record.updatedAt), "yyyy-MM-dd HH:mm")}
                          </span>
                          
                          {!isSynthesizeMode && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleOpenScenario(record); }}
                              className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary transition-colors"
                            >
                              <FileText className="h-3 w-3" /> Edit / Build Graph
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 border-2 border-dashed border-muted-foreground flex items-center justify-center text-muted-foreground mb-4">
                      <BookOpen className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">No Matching Scenarios</h3>
                    <p className="text-muted-foreground text-sm max-w-md mb-6">
                      Adjust your filters or amplify a new idea into a scenario.
                    </p>
                  </div>
                )
              )}

              {activeTab === 'LINEAGE' && (
                isScenariosLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <span className="font-mono text-sm">Fetching scenarios...</span>
                  </div>
                ) : (
                  <LineageTree scenarios={scenarios || []} onOpen={handleOpenScenario} />
                )
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Synthesis Panel Overlay */}
      {isSynthesisPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
          <div className="bg-card border border-border w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                <GitMerge className="h-4 w-4" /> Synthesize Scenarios
              </h2>
              <button 
                onClick={() => setIsSynthesisPanelOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 space-y-6">
              <p className="text-sm text-muted-foreground">
                Select the structural elements to extract from each source scenario. At least one element must be selected per source.
              </p>
              
              <div className="space-y-4">
                {selectedForSynthesis.map(id => {
                  const record = scenarios?.find(s => s.id === id);
                  if (!record) return null;
                  
                  const toggleElement = (el: SynthesisElement) => {
                    setSynthesisElements(prev => {
                      const current = prev[id] || [];
                      const updated = current.includes(el) ? current.filter(e => e !== el) : [...current, el];
                      return { ...prev, [id]: updated };
                    });
                  };
                  
                  const selectedCount = (synthesisElements[id] || []).length;
                  
                  return (
                    <div key={id} className="border border-border p-4">
                      <div className="font-bold text-sm mb-3 flex items-center justify-between">
                        <span>{record.title || "Untitled"}</span>
                        <span className={`text-[10px] font-mono ${selectedCount === 0 ? 'text-destructive' : 'text-primary'}`}>
                          {selectedCount} SELECTED
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(["characters", "conflict", "setting", "twist", "structure", "relationship", "goal", "event", "ending"] as const).map(el => {
                          const isSelected = (synthesisElements[id] || []).includes(el);
                          return (
                            <button
                              key={el}
                              onClick={() => toggleElement(el)}
                              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${
                                isSelected 
                                  ? 'bg-primary/20 border-primary text-primary' 
                                  : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                              }`}
                            >
                              {el}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase text-muted-foreground">Synthesis Instruction (Optional)</label>
                <textarea 
                  value={synthesisInstruction}
                  onChange={(e) => setSynthesisInstruction(e.target.value)}
                  placeholder="e.g. Combine the setting from Source A with the characters from Source B, but make the tone much darker..."
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none font-mono min-h-[80px]"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/10 flex justify-end gap-3">
              <button 
                onClick={() => setIsSynthesisPanelOpen(false)}
                className="px-4 py-2 text-sm font-semibold border border-transparent hover:bg-muted transition-colors"
                disabled={synthesizeScenario.isPending}
              >
                Cancel
              </button>
              <button 
                onClick={handleSynthesize}
                disabled={synthesizeScenario.isPending || selectedForSynthesis.some(id => (synthesisElements[id] || []).length === 0)}
                className="flex items-center gap-2 bg-secondary text-secondary-foreground px-6 py-2 text-sm font-bold border border-secondary transition-colors hover:bg-secondary/90 disabled:opacity-50"
              >
                {synthesizeScenario.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
                {synthesizeScenario.isPending ? 'Synthesizing (takes ~1 min)...' : 'Run Synthesis'}
              </button>
            </div>
            
            {synthesizeScenario.isPending && (
              <div className="absolute bottom-0 left-0 h-1 bg-secondary animate-pulse w-full"></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SimilarScenariosPanel({ scenarioId, onOpen }: { scenarioId: string, onOpen: (r: ScenarioRecord) => void }) {
  const { data: similar, isLoading } = useListSimilarScenarios(scenarioId);

  if (isLoading) {
    return (
      <div className="border border-border bg-card p-6 shadow-sm flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!similar || similar.length === 0) return null;

  return (
    <div className="border border-border bg-card shadow-sm">
      <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest border-b border-border p-4 bg-muted/10 flex items-center gap-2">
        <GitMerge className="h-4 w-4" /> Similar Scenarios in Library
      </h3>
      <div className="divide-y divide-border max-h-64 overflow-y-auto">
        {similar.map(record => (
          <div key={record.id} className="p-4 hover:bg-muted/50 transition-colors flex flex-col gap-2 group cursor-pointer" onClick={() => onOpen(record)}>
            <div className="font-bold text-sm group-hover:text-primary transition-colors">{record.title}</div>
            
            <div className="flex flex-wrap gap-1.5">
              {record.classification && (
                <>
                  <span className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-mono px-1 py-px uppercase truncate max-w-[100px]">{record.classification.domain}</span>
                  <span className="bg-secondary/10 text-secondary border border-secondary/20 text-[9px] font-mono px-1 py-px uppercase truncate max-w-[100px]">{record.classification.conflictType}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
