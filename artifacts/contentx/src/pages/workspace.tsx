import { Layout } from "@/components/layout";
import { StableGraph, GraphNode, GraphEdge } from "@/components/stable-graph";
import { computeWorldLayout } from "@/lib/graph-layout";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetContent, getGetContentQueryKey,
  useUpdateEntity, useUpdateRelationship,
  useValidateContent,
  useListVersions, getListVersionsQueryKey,
  useCreateVersion,
  useExportContent, getExportContentQueryKey,
  useProjectRoleplayX, getProjectRoleplayXQueryKey
} from "@workspace/api-client-react";
import type { Entity } from "@workspace/api-client-react";
import { 
  Terminal, ArrowLeft, GitCommit, CheckCircle, ShieldAlert,
  Download, Copy, Settings, Server, ChevronRight, Activity, FileJson,
  Loader2, Save, X, PlusCircle, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type PanelType = 'inspector' | 'validation' | 'versions' | 'export';
type SelectionType = { type: 'entity' | 'relationship', id: string } | null;

export default function Workspace() {
  const [, params] = useRoute("/content/:id");
  const id = params?.id || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: content, isLoading: isContentLoading } = useGetContent(id, { 
    query: { enabled: !!id, queryKey: getGetContentQueryKey(id) } 
  });
  
  const [activePanel, setActivePanel] = useState<PanelType>('inspector');
  const [selectionId, setSelectionId] = useState<string | null>(null);
  
  const selection: SelectionType = useMemo(() => {
    if (!selectionId || !content) return null;
    const isEntity = content.entities.some(e => e.id === selectionId);
    if (isEntity) return { type: 'entity', id: selectionId };
    const isRel = content.relationships.some(r => r.id === selectionId);
    if (isRel) return { type: 'relationship', id: selectionId };
    return null;
  }, [selectionId, content]);

  // Handlers for side panels
  const openPanel = (panel: PanelType) => setActivePanel(panel);
  const handleSelect = (type: 'entity' | 'relationship', objectId: string) => {
    setSelectionId(objectId);
    setActivePanel('inspector');
  };

  const { nodes, edges } = useMemo(() => {
    if (!content) return { nodes: [], edges: [] };
    return computeWorldLayout(content.entities, content.relationships);
  }, [content]);

  if (isContentLoading) {
    return (
      <Layout breadcrumbs={[{label: "ContentX"}, {label: "Workspace"}, {label: "Loading..."}]}>
        <div className="flex h-full w-full items-center justify-center bg-background">
          <div className="flex flex-col items-center text-primary">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <span className="font-mono text-sm tracking-widest uppercase">Initializing Workspace...</span>
          </div>
        </div>
      </Layout>
    );
  }

  if (!content) {
    return (
      <Layout breadcrumbs={[{label: "ContentX"}, {label: "Workspace"}, {label: "Not Found"}]}>
        <div className="flex h-full w-full items-center justify-center bg-background">
          <div className="text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Graph Not Found</h2>
            <Link href="/world" className="text-primary hover:underline font-mono text-sm">Return to World</Link>
          </div>
        </div>
      </Layout>
    );
  }

  const contextHeader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="font-bold text-xl truncate max-w-xl" title={content.title}>{content.title}</h1>
        <span className="px-2 py-0.5 bg-muted text-xs font-mono border border-border text-muted-foreground">
          v{content.version}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={() => openPanel('validation')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold border transition-colors ${activePanel === 'validation' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-muted'}`}
        >
          <CheckCircle className="h-3.5 w-3.5" /> Validate
        </button>
        <button 
          onClick={() => openPanel('versions')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold border transition-colors ${activePanel === 'versions' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-muted'}`}
        >
          <GitCommit className="h-3.5 w-3.5" /> Versions
        </button>
        <button 
          onClick={() => openPanel('export')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold border transition-colors ${activePanel === 'export' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-muted'}`}
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>
    </div>
  );

  return (
    <Layout 
      breadcrumbs={[{label: "ContentX"}, {label: "World", href: "/world"}, {label: "Content Workspace"}]}
      contextHeader={contextHeader}
    >
      <div className="flex h-full w-full bg-background overflow-hidden font-sans selection:bg-primary/20 text-foreground">

        {/* LEFT SIDEBAR: ENTITIES */}
        <div className="relative z-10 w-72 border-r border-border bg-card flex flex-col shadow-sm">
        
        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider mb-4">
            Entities ({content.entities.length})
          </h3>
          
          <EntityList 
            entities={content.entities} 
            selectedId={selection?.type === 'entity' ? selection.id : null}
            onSelect={(eid) => handleSelect('entity', eid)} 
          />
        </div>
      </div>

      {/* MAIN CONTENT: GRAPH */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* SVG GRAPH */}
        <div className="flex-1 relative bg-background overflow-hidden border-r border-border">
          <StableGraph 
            nodes={nodes} 
            edges={edges}
            selectionId={selectionId} 
            onSelectNode={(id) => handleSelect('entity', id)} 
            onSelectEdge={(id) => handleSelect('relationship', id)}
            onEmptyClick={() => setSelectionId(null)}
          />
        </div>
      </div>

      {/* RIGHT SIDEBAR: PANELS */}
      <div className="relative z-10 w-[400px] border-l border-border bg-card flex flex-col shadow-sm">
        <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-muted/30">
          <h2 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
            {activePanel === 'inspector' ? 'Object Inspector' : 
             activePanel === 'validation' ? 'Validation Report' :
             activePanel === 'versions' ? 'Version History' : 'Export Outputs'}
          </h2>
          {activePanel !== 'inspector' && selection && (
            <button 
              onClick={() => openPanel('inspector')}
              className="text-xs text-primary hover:underline font-mono"
            >
              Back to Inspector
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar">
          {activePanel === 'inspector' && (
            <InspectorPanel 
              contentId={id}
              selection={selection} 
              graph={content} 
            />
          )}
          {activePanel === 'validation' && (
            <ValidationPanel contentId={id} onSelectObject={handleSelect} />
          )}
          {activePanel === 'versions' && (
            <VersionsPanel contentId={id} currentVersion={content.version} />
          )}
          {activePanel === 'export' && (
            <ExportPanel contentId={id} />
          )}
        </div>
      </div>
    </div>
    </Layout>
  );
}

// --- SUB-COMPONENTS ---

function EntityList({ entities, selectedId, onSelect }: { entities: any[], selectedId: string | null, onSelect: (id: string) => void }) {
  // Group by kind
  const grouped = entities.reduce((acc, ent) => {
    if (!acc[ent.kind]) acc[ent.kind] = [];
    acc[ent.kind].push(ent);
    return acc;
  }, {} as Record<string, any[]>);

  const kinds = Object.keys(grouped).sort();

  return (
    <div className="space-y-6 pb-20">
      {kinds.map(kind => (
        <div key={kind} className="space-y-2">
          <div className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest px-2">
            {kind}
          </div>
          <div className="space-y-1">
            {grouped[kind].map((ent: Entity) => (
              <button
                key={ent.id}
                onClick={() => onSelect(ent.id)}
                className={`w-full text-left px-2 py-1.5 text-sm rounded-none border-l-2 transition-all ${
                  selectedId === ent.id 
                    ? 'border-primary bg-muted font-semibold text-foreground' 
                    : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <div className="truncate">{ent.name}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function InspectorPanel({ contentId, selection, graph }: { contentId: string, selection: SelectionType, graph: any }) {
  if (!selection) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-8 text-center">
        <Server className="h-8 w-8 mb-4 opacity-50" />
        <p className="text-sm font-mono">Select an entity or relationship from the graph or sidebar to inspect.</p>
      </div>
    );
  }

  const isEntity = selection.type === 'entity';
  const object = isEntity 
    ? graph.entities.find((e: Entity) => e.id === selection.id)
    : graph.relationships.find((r: { id: string }) => r.id === selection.id);

  if (!object) return <div className="p-4 text-sm text-destructive">Object not found in current graph version.</div>;

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-1 pb-4 border-b border-border">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          {isEntity ? `Entity • ${object.kind}` : 'Relationship'}
        </div>
        <div className="text-lg font-bold font-serif leading-tight">
          {isEntity ? object.name : object.type}
        </div>
        <div className="text-xs font-mono text-muted-foreground truncate" title={object.id}>
          ID: {object.id}
        </div>
      </div>

      {isEntity ? (
        <EntityEditor contentId={contentId} entity={object} />
      ) : (
        <RelationshipEditor contentId={contentId} relationship={object} graph={graph} />
      )}
    </div>
  );
}

function EntityEditor({ contentId, entity }: { contentId: string, entity: any }) {
  const updateEntity = useUpdateEntity();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [name, setName] = useState(entity.name);
  const [description, setDescription] = useState(entity.description || "");

  // Reset form when entity changes
  useEffect(() => {
    setName(entity.name);
    setDescription(entity.description || "");
  }, [entity]);

  const hasChanges = name !== entity.name || description !== (entity.description || "");

  const handleSave = () => {
    updateEntity.mutate(
      { id: contentId, entityId: entity.id, data: { name, description } },
      {
        onSuccess: (newGraph) => {
          toast({ title: "Entity updated" });
          queryClient.setQueryData(getGetContentQueryKey(contentId), newGraph);
        },
        onError: (err) => toast({ title: "Update failed", description: err.message, variant: "destructive" })
      }
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Name</label>
        <input 
          type="text" 
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Description</label>
        <textarea 
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={6}
          className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none leading-relaxed"
        />
      </div>
      
      {entity.attributes && Object.keys(entity.attributes).length > 0 && (
        <div>
          <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Attributes (Read-only)</label>
          <pre className="text-[10px] font-mono bg-muted p-3 border border-border overflow-auto">
            {JSON.stringify(entity.attributes, null, 2)}
          </pre>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!hasChanges || updateEntity.isPending}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground h-9 px-4 font-semibold text-xs transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {updateEntity.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Save Changes
      </button>
    </div>
  );
}

function RelationshipEditor({ contentId, relationship, graph }: { contentId: string, relationship: any, graph: any }) {
  const updateRel = useUpdateRelationship();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [type, setType] = useState(relationship.type);
  
  useEffect(() => {
    setType(relationship.type);
  }, [relationship]);

  const hasChanges = type !== relationship.type;

  const handleSave = () => {
    updateRel.mutate(
      { id: contentId, relationshipId: relationship.id, data: { type } },
      {
        onSuccess: (newGraph) => {
          toast({ title: "Relationship updated" });
          queryClient.setQueryData(getGetContentQueryKey(contentId), newGraph);
        },
        onError: (err) => toast({ title: "Update failed", description: err.message, variant: "destructive" })
      }
    );
  };

  const sourceEnt = graph.entities.find((e: Entity) => e.id === relationship.source);
  const targetEnt = graph.entities.find((e: Entity) => e.id === relationship.target);

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted border border-border text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground text-xs uppercase">Source</span>
          <span className="font-semibold">{sourceEnt?.name || relationship.source}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-xs uppercase">Target</span>
          <span className="font-semibold">{targetEnt?.name || relationship.target}</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Type</label>
        <input 
          type="text" 
          value={type}
          onChange={e => setType(e.target.value)}
          className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono transition-all"
        />
      </div>

      {relationship.attributes && Object.keys(relationship.attributes).length > 0 && (
        <div>
          <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Attributes</label>
          <pre className="text-[10px] font-mono bg-muted p-3 border border-border overflow-auto">
            {JSON.stringify(relationship.attributes, null, 2)}
          </pre>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!hasChanges || updateRel.isPending}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground h-9 px-4 font-semibold text-xs transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {updateRel.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Save Changes
      </button>
    </div>
  );
}

function ValidationPanel({ contentId, onSelectObject }: { contentId: string, onSelectObject: (type: 'entity'|'relationship', id: string) => void }) {
  const validateContent = useValidateContent();
  const { toast } = useToast();
  
  const handleValidate = () => {
    validateContent.mutate({ id: contentId }, {
      onSuccess: () => toast({ title: "Validation complete" }),
      onError: (err) => toast({ title: "Validation failed to run", description: err.message, variant: "destructive" })
    });
  };

  const report = validateContent.data;

  // Issue codes (e.g. "MISSING_REQUIRED_FIELD") are not check identifiers
  // (e.g. "schema:required-fields"), so a per-check ✓/✗ cannot be derived
  // faithfully from the report. Rule: a check is marked ✗ only on an EXACT
  // code match; if any issue cannot be attributed to a listed check, the
  // per-check list is hidden entirely (overall status + raw Diagnostics
  // remain) rather than showing an invented pass state. All-✓ therefore
  // appears only when the run produced zero issues.
  const issueCodes = report ? new Set(report.issues.map((i) => i.code)) : new Set<string>();
  const unattributedIssue = report
    ? report.issues.some((i) => !report.checks.includes(i.code))
    : false;
  const failedChecks = new Set(
    report ? report.checks.filter((c) => issueCodes.has(c)) : [],
  );

  return (
    <div className="p-4 space-y-6" data-testid="card-data-quality">
      <div>
        <h3 className="text-sm font-bold mb-1">Data Quality</h3>
        <p className="text-sm text-muted-foreground">
          Run a structural and semantic analysis of the content graph to identify logical inconsistencies, dangling references, or missing attributes.
        </p>
      </div>
      
      <button
        onClick={handleValidate}
        disabled={validateContent.isPending}
        data-testid="button-run-validation"
        className="w-full flex items-center justify-center gap-2 border border-primary text-primary h-10 px-4 font-bold text-sm transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {validateContent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
        Run validation
      </button>

      {report && (
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${report.valid ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-destructive/10 text-destructive'}`}>
              {report.valid ? <CheckCircle className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <div>
              <div className="font-bold text-lg">{report.valid ? 'Valid Structure' : 'Issues Detected'}</div>
              <div className="text-xs text-muted-foreground font-mono">Checked at {format(new Date(report.checkedAt), 'HH:mm:ss')}</div>
            </div>
          </div>

          {report.checks.length > 0 && !unattributedIssue && (
            <div className="space-y-1.5 mt-2" data-testid="list-validation-checks">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Checks</h4>
              {report.checks.map((check) => {
                const passed = !failedChecks.has(check);
                return (
                  <div key={check} className="flex items-center gap-2 text-sm" data-testid={`check-${check}`}>
                    {passed ? (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className={passed ? "text-foreground" : "text-destructive font-semibold"}>{check}</span>
                  </div>
                );
              })}
            </div>
          )}

          {report.issues.length > 0 && (
            <div className="space-y-2 mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Diagnostics</h4>
              {report.issues.map((issue, idx) => (
                <div key={idx} className={`p-3 border text-sm ${issue.severity === 'error' ? 'border-destructive/50 bg-destructive/5' : 'border-orange-500/50 bg-orange-500/5'}`}>
                  <div className="font-bold flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 font-mono text-white ${issue.severity === 'error' ? 'bg-destructive' : 'bg-orange-500'}`}>
                      {issue.severity.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs">{issue.code}</span>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">{issue.message}</p>
                  {issue.objectId && (
                    <button 
                      onClick={() => onSelectObject('entity', issue.objectId!)} // Assuming entity for simplicity if objectId exists
                      className="mt-2 text-xs font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      Inspect Object <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VersionsPanel({ contentId, currentVersion }: { contentId: string, currentVersion: number }) {
  const { data: versions, isLoading, refetch } = useListVersions(contentId, { query: { enabled: !!contentId, queryKey: getListVersionsQueryKey(contentId) } });
  const createVersion = useCreateVersion();
  const { toast } = useToast();
  
  const [note, setNote] = useState("");

  const handleSnapshot = () => {
    createVersion.mutate({ id: contentId, data: { note: note.trim() || undefined, author: "System User" } }, {
      onSuccess: () => {
        toast({ title: "Version snapshot created" });
        setNote("");
        refetch();
      },
      onError: (err) => toast({ title: "Failed to snapshot", description: err.message, variant: "destructive" })
    });
  };

  return (
    <div className="p-4 space-y-6">
      <div className="border border-border bg-muted/20 p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Create Snapshot</h4>
        <input 
          type="text" 
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Snapshot note (e.g. Added factions)"
          className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all"
        />
        <button
          onClick={handleSnapshot}
          disabled={createVersion.isPending}
          className="w-full bg-foreground text-background h-9 px-4 font-semibold text-xs transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {createVersion.isPending ? "Committing..." : "Commit Version"}
        </button>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">History Log</h4>
        
        {isLoading ? (
          <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : versions?.map((v) => (
          <div key={v.id} className="relative pl-4 border-l border-border pb-4 last:pb-0">
            <div className={`absolute -left-1.5 top-0 h-3 w-3 rounded-none border-2 ${v.version === currentVersion ? 'bg-primary border-primary' : 'bg-background border-border'}`}></div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-mono text-sm font-bold">v{v.version}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{format(new Date(v.createdAt), "MM/dd HH:mm")}</span>
            </div>
            {v.note && <p className="text-sm italic text-muted-foreground">"{v.note}"</p>}
            <div className="text-xs mt-1 text-muted-foreground">
              Objects: {v.entityCount} E, {v.relationshipCount} R
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportPanel({ contentId }: { contentId: string }) {
  const { data: canonical, isLoading: isCanonLoading } = useExportContent(contentId, { query: { enabled: !!contentId, queryKey: getExportContentQueryKey(contentId) } });
  const { data: roleplayX, isLoading: isRoleplayLoading } = useProjectRoleplayX(contentId, { query: { enabled: !!contentId, queryKey: getProjectRoleplayXQueryKey(contentId) } });
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'canonical' | 'roleplay'>('canonical');

  const activeData = activeTab === 'canonical' ? canonical : roleplayX;
  const isLoading = activeTab === 'canonical' ? isCanonLoading : isRoleplayLoading;

  const handleCopy = () => {
    if (!activeData) return;
    navigator.clipboard.writeText(JSON.stringify(activeData, null, 2));
    toast({ title: "Copied to clipboard" });
  };

  const handleDownload = () => {
    if (!activeData) return;
    const blob = new Blob([JSON.stringify(activeData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-${activeTab}-${contentId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border">
        <button 
          onClick={() => setActiveTab('canonical')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'canonical' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
        >
          Canonical
        </button>
        <button 
          onClick={() => setActiveTab('roleplay')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'roleplay' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
        >
          RoleplayX
        </button>
      </div>

      <div className="p-4 flex gap-2 border-b border-border bg-muted/10">
        <button onClick={handleCopy} disabled={isLoading || !activeData} className="flex-1 flex items-center justify-center gap-2 bg-background border border-border h-8 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-50">
          <Copy className="h-3 w-3" /> Copy
        </button>
        <button onClick={handleDownload} disabled={isLoading || !activeData} className="flex-1 flex items-center justify-center gap-2 bg-background border border-border h-8 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-50">
          <Download className="h-3 w-3" /> Download
        </button>
      </div>

      <div className="flex-1 p-4 overflow-auto bg-[#0A0A0A] text-[#E5E5E5]">
        {isLoading ? (
          <div className="flex justify-center mt-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : activeData ? (
          <pre className="text-[11px] font-mono whitespace-pre-wrap break-words leading-relaxed selection:bg-primary/50">
            {JSON.stringify(activeData, null, 2)}
          </pre>
        ) : (
          <div className="text-center text-muted-foreground mt-10 text-xs font-mono">No export data available</div>
        )}
      </div>
    </div>
  );
}
