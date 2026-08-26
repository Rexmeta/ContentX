import { useState, useRef, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Code, CheckCircle2, AlertCircle, Download, FileUp, Save, Play } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  useListJsonFormats,
  useCreateJsonFormat,
  useInferJsonFormat,
  useGetJsonFormatVersion,
  useUpdateJsonFormatVersion,
  useCreateJsonFormatVersion,
  useActivateJsonFormatVersion,
  usePreviewJsonExport,
  useCreateJsonExport,
  useListContent,
  useListSimulations,
  getListJsonFormatsQueryKey,
  getGetJsonFormatVersionQueryKey,
  JsonFormat,
  JsonFormatStatus,
  JsonFormatInference,
  JsonExport,
} from "@workspace/api-client-react";
import { parseJsonFile, parseJsonString, downloadJsonBlob, getStatusLabel } from "@/utils/format-helpers";
function CreateFormatDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inputType, setInputType] = useState<"example" | "jsonSchema">("example");
  const [inputMode, setInputMode] = useState<"upload" | "paste">("paste");
  const [jsonText, setJsonText] = useState("");
  const [inferred, setInferred] = useState<JsonFormatInference | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inferMutation = useInferJsonFormat();
  const createMutation = useCreateJsonFormat();
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseJsonFile(file);
      setJsonText(JSON.stringify(data, null, 2));
    } catch (err: any) {
      toast({ title: "파일 오류", description: err.message, variant: "destructive" });
    }
  };

  const handleInfer = async () => {
    if (!name.trim()) {
      toast({ title: "오류", description: "포맷 이름을 입력하세요.", variant: "destructive" });
      return;
    }
    try {
      const parsed = parseJsonString(jsonText);
      const payload = {
        name,
        description: description || undefined,
        ...(inputType === "example" ? { example: parsed } : { jsonSchema: parsed })
      };
      const result = await inferMutation.mutateAsync({ data: payload });
      setInferred(result);
    } catch (err: any) {
      toast({ title: "분석 실패", description: err.message, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    try {
      const parsed = parseJsonString(jsonText);
      const payload = {
        name,
        description: description || undefined,
        ...(inputType === "example" ? { example: parsed } : { jsonSchema: parsed })
      };
      await createMutation.mutateAsync({ data: payload });
      toast({ title: "포맷 생성 완료" });
      queryClient.invalidateQueries({ queryKey: getListJsonFormatsQueryKey() });
      onOpenChange(false);
      setName(""); setDescription(""); setJsonText(""); setInferred(null);
    } catch (err: any) {
      toast({ title: "생성 실패", description: err.message || "오류가 발생했습니다.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>새 JSON 포맷</DialogTitle>
          <DialogDescription>
            예시 JSON이나 JSON Schema를 입력하면 매핑 스키마를 자동 분석합니다.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 py-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">포맷 이름</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="예: Unity Dialog Export" data-testid="input-format-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">입력 유형</Label>
                <Select value={inputType} onValueChange={(v: "example" | "jsonSchema") => setInputType(v)}>
                  <SelectTrigger id="type" data-testid="select-format-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="example">예시 JSON</SelectItem>
                    <SelectItem value="jsonSchema">JSON Schema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="desc">설명 (선택)</Label>
              <Input id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="포맷의 용도나 특징을 설명해주세요" data-testid="input-format-desc" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>JSON 데이터</Label>
                <div className="flex gap-2">
                  <Button variant={inputMode === "paste" ? "default" : "outline"} size="sm" onClick={() => setInputMode("paste")} data-testid="button-input-paste">붙여넣기</Button>
                  <Button variant={inputMode === "upload" ? "default" : "outline"} size="sm" onClick={() => setInputMode("upload")} data-testid="button-input-upload">파일 업로드</Button>
                </div>
              </div>
              
              {inputMode === "paste" ? (
                <Textarea 
                  className="font-mono text-xs min-h-[150px]" 
                  value={jsonText} 
                  onChange={e => setJsonText(e.target.value)}
                  placeholder="JSON을 여기에 붙여넣으세요..."
                  data-testid="textarea-format-json"
                />
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2">
                  <FileUp className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">최대 512KB의 .json 파일</span>
                  <Input type="file" accept=".json" onChange={handleFileChange} className="max-w-[250px]" data-testid="input-format-file" />
                </div>
              )}
            </div>

            {inferred && (
              <div className="mt-6 border border-primary/20 bg-primary/5 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> 분석 완료
                </h3>
                <Tabs defaultValue="mapping">
                  <TabsList className="h-8">
                    <TabsTrigger value="mapping" className="text-xs">초기 매핑</TabsTrigger>
                    <TabsTrigger value="schema" className="text-xs">스키마</TabsTrigger>
                    <TabsTrigger value="catalog" className="text-xs">출처 카탈로그 ({inferred.sourceCatalog.length})</TabsTrigger>
                    <TabsTrigger value="unresolved" className="text-xs">미해결 경로 ({inferred.unresolvedPaths.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="mapping" className="mt-2">
                    <pre className="text-xs font-mono bg-muted p-2 rounded max-h-40 overflow-auto">{JSON.stringify(inferred.mapping, null, 2)}</pre>
                  </TabsContent>
                  <TabsContent value="schema" className="mt-2">
                    <pre className="text-xs font-mono bg-muted p-2 rounded max-h-40 overflow-auto">{JSON.stringify(inferred.jsonSchema, null, 2)}</pre>
                  </TabsContent>
                  <TabsContent value="catalog" className="mt-2">
                    <ul className="text-xs space-y-1 bg-muted p-2 rounded max-h-40 overflow-auto list-disc pl-5">
                      {inferred.sourceCatalog.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </TabsContent>
                  <TabsContent value="unresolved" className="mt-2">
                    {inferred.unresolvedPaths.length > 0 ? (
                      <ul className="text-xs space-y-1 bg-destructive/10 text-destructive p-2 rounded max-h-40 overflow-auto list-disc pl-5">
                        {inferred.unresolvedPaths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    ) : (
                      <div className="text-xs text-muted-foreground p-2">모든 경로가 해석 가능합니다.</div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          {!inferred ? (
            <Button onClick={handleInfer} disabled={inferMutation.isPending} data-testid="button-infer-format">
              {inferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              분석하기
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setInferred(null)}>다시 분석</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-create-format">
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                초안 생성
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormatPreviewExport({ formatId, version }: { formatId: string, version: number }) {
  const { data: contents } = useListContent();
  const { data: simulations } = useListSimulations();
  
  const [contentId, setContentId] = useState<string>("none");
  const [simulationId, setSimulationId] = useState<string>("none");
  
  const previewMutation = usePreviewJsonExport();
  const exportMutation = useCreateJsonExport();
  const { toast } = useToast();
  
  const [previewResult, setPreviewResult] = useState<JsonExport | null>(null);

  const canPreview = contentId !== "none" || simulationId !== "none";

  const buildPayload = () => ({
    formatId,
    formatVersion: version,
    contentId: contentId === "none" ? undefined : contentId,
    contentVersion:
      contentId === "none"
        ? undefined
        : contents?.find((content) => content.id === contentId)?.version,
    simulationId: simulationId === "none" ? undefined : simulationId
  });

  useEffect(() => {
    setPreviewResult(null);
  }, [contentId, simulationId, formatId, version]);

  const handlePreview = async () => {
    try {
      const res = await previewMutation.mutateAsync({ data: buildPayload() });
      setPreviewResult(res);
    } catch (err: any) {
      toast({ title: "미리보기 실패", description: err.message, variant: "destructive" });
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportMutation.mutateAsync({ data: buildPayload() });
      downloadJsonBlob(res.payload, `export-${formatId}-v${version}.json`);
      toast({ title: "내보내기 완료" });
    } catch (err: any) {
      toast({ title: "내보내기 실패", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="h-full flex flex-col shadow-none border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Play className="h-4 w-4 text-primary" /> 미리보기 & 내보내기
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="space-y-4 shrink-0">
          <div className="space-y-2">
            <Label>콘텐츠 소스</Label>
            <Select value={contentId} onValueChange={setContentId}>
              <SelectTrigger data-testid="select-preview-content">
                <SelectValue placeholder="선택 안함" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안함</SelectItem>
                {contents?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.title || c.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>시뮬레이션 소스</Label>
            <Select value={simulationId} onValueChange={setSimulationId}>
              <SelectTrigger data-testid="select-preview-simulation">
                <SelectValue placeholder="선택 안함" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안함</SelectItem>
                {simulations?.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name || s.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button className="w-full" onClick={handlePreview} disabled={!canPreview || previewMutation.isPending} data-testid="button-preview">
            {previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "미리보기 생성"}
          </Button>
        </div>

        <div className="flex-1 min-h-0 border rounded-md overflow-hidden bg-muted/30 flex flex-col relative">
          {previewResult ? (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {!previewResult.validation.valid && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded p-3">
                    <h4 className="text-xs font-bold text-destructive mb-2 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> 유효성 검사 실패
                    </h4>
                    <ul className="text-xs text-destructive space-y-1 list-disc pl-4">
                      {previewResult.validation.issues.map((iss: any, i: number) => (
                        <li key={i}>{JSON.stringify(iss)}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground">페이로드</div>
                  <pre className="text-xs font-mono bg-card border rounded p-3 overflow-x-auto">
                    {JSON.stringify(previewResult.payload, null, 2)}
                  </pre>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground">출처 증명 (Provenance)</div>
                  <pre className="text-xs font-mono bg-card border rounded p-3 overflow-x-auto text-muted-foreground">
                    {JSON.stringify(previewResult.provenance, null, 2)}
                  </pre>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              소스를 선택하고 미리보기를 생성하세요.
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button 
          variant="secondary" 
          className="w-full" 
          onClick={handleExport} 
          disabled={!previewResult?.validation.valid || exportMutation.isPending}
          data-testid="button-export"
        >
          {exportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Download className="mr-2 h-4 w-4" /> 내보내기 (다운로드)</>}
        </Button>
      </CardFooter>
    </Card>
  );
}

function FormatEditor({ formatInfo, onNextDraft }: { formatInfo: JsonFormat, onNextDraft: () => void }) {
  const { data: format, isLoading } = useGetJsonFormatVersion(formatInfo.formatId, formatInfo.version);
  const updateMutation = useUpdateJsonFormatVersion();
  const activateMutation = useActivateJsonFormatVersion();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mappingText, setMappingText] = useState("");

  // Only init once per formatId+version to avoid overwriting edits if refetched
  const initializedRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (format && initializedRef.current !== `${format.formatId}-${format.version}`) {
      initializedRef.current = `${format.formatId}-${format.version}`;
      setName(format.name);
      setDescription(format.description || "");
      setMappingText(JSON.stringify(format.mapping, null, 2));
    }
  }, [format]);

  if (isLoading || !format) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isDraft = format.status === "draft";
  const isActive = format.status === "active";
  
  const handleSave = async () => {
    try {
      const mapping = parseJsonString(mappingText);
      await updateMutation.mutateAsync({
        formatId: format.formatId,
        version: format.version,
        data: { name, description: description || null, mapping }
      });
      toast({ title: "저장 완료" });
      queryClient.invalidateQueries({ queryKey: getListJsonFormatsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetJsonFormatVersionQueryKey(format.formatId, format.version) });
    } catch (err: any) {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    }
  };

  const handleActivate = async () => {
    if (!confirm("이 버전을 활성화하시겠습니까? 이전 활성 버전은 대체됩니다.")) return;
    try {
      await activateMutation.mutateAsync({ formatId: format.formatId, version: format.version });
      toast({ title: "활성화 완료" });
      queryClient.invalidateQueries({ queryKey: getListJsonFormatsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetJsonFormatVersionQueryKey(format.formatId, format.version) });
    } catch (err: any) {
      toast({ title: "활성화 실패", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="h-full flex flex-col shadow-none border-border bg-card">
      <CardHeader className="pb-4 flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            포맷 편집기
            <Badge variant={isActive ? "default" : isDraft ? "secondary" : "outline"} className="text-[10px]">
              {getStatusLabel(format.status)}
            </Badge>
          </CardTitle>
          <div className="text-xs text-muted-foreground mt-1">
            {format.formatId} • v{format.version}
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-format">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} 저장
              </Button>
              <Button size="sm" onClick={handleActivate} disabled={activateMutation.isPending} data-testid="button-activate-format">
                활성화
              </Button>
            </>
          )}
          {!isDraft && (
            <Button size="sm" onClick={onNextDraft} data-testid="button-next-draft">
              <Plus className="h-4 w-4 mr-1" /> 다음 버전 초안
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 shrink-0">
          <div className="space-y-1.5">
            <Label>이름</Label>
            <Input value={name} onChange={e => setName(e.target.value)} disabled={!isDraft} data-testid="input-edit-name" />
          </div>
          <div className="space-y-1.5">
            <Label>설명</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} disabled={!isDraft} data-testid="input-edit-desc" />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-[200px]">
          <Label className="mb-1.5">매핑 (Mapping JSON)</Label>
          <Textarea 
            className="flex-1 font-mono text-xs resize-none" 
            value={mappingText}
            onChange={e => setMappingText(e.target.value)}
            disabled={!isDraft}
            data-testid="textarea-edit-mapping"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function FormatsPage() {
  const { data: formats, isLoading } = useListJsonFormats();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<JsonFormat | null>(null);
  
  const createVersionMutation = useCreateJsonFormatVersion();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleNextDraft = async () => {
    if (!selectedFormat) return;
    try {
      await createVersionMutation.mutateAsync({ 
        formatId: selectedFormat.formatId, 
        data: { sourceVersion: selectedFormat.version }
      });
      toast({ title: "새 버전 초안 생성됨" });
      queryClient.invalidateQueries({ queryKey: getListJsonFormatsQueryKey() });
    } catch (err: any) {
      toast({ title: "버전 생성 실패", description: err.message, variant: "destructive" });
    }
  };

  // Group formats by formatId just for visual clustering if needed, 
  // but for simplicity we can just list them all sorted by updatedAt, 
  // or group by formatId and show versions.
  // The API returns all versions or latest? The array is flat `JsonFormat[]`.
  // Let's sort by formatId, then version desc.
  const sortedFormats = useMemo(() => {
    if (!formats) return [];
    return [...formats].sort((a, b) => {
      if (a.formatId === b.formatId) return b.version - a.version;
      return a.formatId.localeCompare(b.formatId);
    });
  }, [formats]);

  // Keep selection up-to-date with list
  useEffect(() => {
    if (selectedFormat && formats) {
      const updated = formats.find(f => f.formatId === selectedFormat.formatId && f.version === selectedFormat.version);
      if (updated && updated.status !== selectedFormat.status) {
        setSelectedFormat(updated);
      }
    }
  }, [formats, selectedFormat]);

  return (
    <Layout 
      breadcrumbs={[{ label: "고급 도구" }, { label: "JSON 포맷", href: "/formats" }]}
      title={
        <Button onClick={() => setCreateOpen(true)} size="sm" data-testid="button-new-format">
          <Plus className="h-4 w-4 mr-2" /> 새 포맷
        </Button>
      }
    >
      <div className="flex h-full flex-col overflow-auto lg:flex-row lg:overflow-hidden">
        {/* Left List */}
        <div className="w-full shrink-0 border-b border-border bg-card/30 flex max-h-64 flex-col lg:w-80 lg:max-h-none lg:border-b-0 lg:border-r">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-sm">포맷 버전 목록</h2>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sortedFormats.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                저장된 포맷이 없습니다.
              </div>
            ) : (
              <div className="flex flex-col p-2 gap-1">
                {sortedFormats.map((f: JsonFormat) => {
                  const isSelected = selectedFormat?.formatId === f.formatId && selectedFormat?.version === f.version;
                  return (
                    <button
                      key={`${f.formatId}-${f.version}`}
                      onClick={() => setSelectedFormat(f)}
                      className={cn(
                        "text-left p-3 rounded-md transition-colors border",
                        isSelected 
                          ? "bg-primary/10 border-primary/30" 
                          : "bg-card border-transparent hover:bg-muted/50 hover:border-border/50"
                      )}
                      data-testid={`format-item-${f.formatId}-${f.version}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{f.name}</span>
                        <Badge 
                          variant={f.status === 'active' ? 'default' : f.status === 'draft' ? 'secondary' : 'outline'}
                          className="text-[10px] px-1.5 shrink-0"
                        >
                          {getStatusLabel(f.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-mono truncate">{f.formatId}</span>
                        <span>v{f.version}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right content: Split into Editor and Preview */}
        <div className="flex min-h-[900px] flex-1 min-w-0 flex-col bg-muted/10 p-4 gap-4 xl:min-h-0 xl:flex-row">
          {selectedFormat ? (
            <>
              <div className="min-h-[520px] flex-1 min-w-0">
                <FormatEditor formatInfo={selectedFormat} onNextDraft={handleNextDraft} />
              </div>
              <div className="min-h-[520px] flex-1 min-w-0">
                <FormatPreviewExport formatId={selectedFormat.formatId} version={selectedFormat.version} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Code className="h-12 w-12 mb-4 opacity-20" />
              <p>왼쪽 목록에서 편집할 포맷 버전을 선택하세요.</p>
            </div>
          )}
        </div>
      </div>

      <CreateFormatDialog open={createOpen} onOpenChange={setCreateOpen} />
    </Layout>
  );
}
